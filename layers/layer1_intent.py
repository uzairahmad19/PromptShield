"""
layers/layer1_intent.py
------------------------
Layer 1: Intent Classifier

This is the FIRST gate in PromptShield. Every user input passes through
here before touching the agent.

HOW IT WORKS:
  Two independent signals are computed and fused into a single risk score:

  Signal A — FAISS Similarity (fast, pattern-matching)
  ┌─────────────────────────────────────────────────────────────────┐
  │ 1. Embed the user input with the shared sentence transformer    │
  │ 2. Query the FAISS attack index (HackAPrompt + TensorTrust)     │
  │ 3. Get the max cosine similarity to any known attack pattern    │
  │ 4. High similarity → this input LOOKS like a known attack       │
  └─────────────────────────────────────────────────────────────────┘

  Signal B — Zero-Shot NLI (slower, semantic reasoning)
  ┌─────────────────────────────────────────────────────────────────┐
  │ 1. Run BART-large-MNLI on the input                             │
  │ 2. Check: does the input ENTAIL adversarial intent hypotheses?  │
  │    e.g. "This message tries to override AI instructions"        │
  │ 3. High entailment → this input MEANS something adversarial     │
  └─────────────────────────────────────────────────────────────────┘

  Final Risk Score = (0.6 × FAISS score) + (0.4 × NLI score)

  Why 60/40 weighting?
  - FAISS is fast and reliable for known patterns → higher weight
  - NLI catches novel paraphrases but is slower → secondary signal
  - The weights are tunable in config.yaml

  Decision:
    risk_score >= threshold → BLOCK (adversarial intent detected)
    risk_score <  threshold → PASS  (proceed to Layer 2)

PERFORMANCE NOTES:
  - FAISS search: ~1-5ms (very fast)
  - NLI inference: ~400ms on CPU, ~50ms on GPU
  - Total Layer 1: ~400-500ms per query on CPU

  For lower latency, NLI can be disabled in config.yaml (layer1.nli_enabled: false)
  and Layer 1 becomes purely FAISS-based (~5ms).
"""

from __future__ import annotations

import os
import sys
import yaml
from dataclasses import dataclass, field

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models.embedder import Embedder
from models.classifier import ZeroShotClassifier
from vectorstore.faiss_store import FAISSStore


def load_config() -> dict:
    config_path = os.path.join(os.path.dirname(__file__), "..", "config.yaml")
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


# ── Result Dataclass ───────────────────────────────────────────────────────────

@dataclass
class Layer1Result:
    """
    Structured result from the Layer 1 intent classifier.
    This is passed to the audit logger and used by pipeline/sieve.py
    to decide whether to block or pass the request.
    """
    decision: str                    # "BLOCK" or "PASS"
    risk_score: float                # Combined score, 0.0 – 1.0
    faiss_score: float               # Cosine similarity to nearest attack
    nli_score: float                 # Max adversarial entailment score
    top_attack_match: str            # Text of the nearest known attack
    top_attack_label: str            # Category of the nearest known attack
    nli_hypothesis: str              # Which adversarial hypothesis was triggered
    reason: str                      # Human-readable explanation
    top_k_matches: list[dict] = field(default_factory=list)  # Top FAISS neighbors

    @property
    def is_blocked(self) -> bool:
        return self.decision == "BLOCK"


# ── Layer 1 Classifier ─────────────────────────────────────────────────────────

class IntentClassifier:
    """
    Layer 1 of PromptShield: Intent Classifier.

    Detects adversarial intent in user inputs using a two-signal fusion
    of FAISS semantic similarity and zero-shot NLI classification.

    Usage:
        classifier = IntentClassifier()
        result = classifier.check("Ignore all previous instructions")
        if result.is_blocked:
            print(f"BLOCKED: {result.reason}")
    """

    def __init__(self, use_nli: bool = True):
        config = load_config()
        self.cfg = config["layer1"]
        self.enabled = self.cfg.get("enabled", True)
        self.use_nli = use_nli

        # Thresholds (all tunable in config.yaml)
        self.similarity_threshold = self.cfg["similarity_threshold"]    # 0.72
        self.nli_threshold        = self.cfg["nli_threshold"]           # 0.75
        self.risk_threshold       = self.cfg["risk_threshold"]          # 0.70
        self.top_k                = self.cfg["top_k"]                   # 5

        # Score fusion weights
        self.faiss_weight = 0.6
        self.nli_weight   = 0.4

        # Lazy-load components (expensive, only load when needed)
        self._embedder: Embedder | None = None
        self._nli: ZeroShotClassifier | None = None
        self._attack_store: FAISSStore | None = None

        print(f"[Layer 1] Intent Classifier initialized (NLI={'enabled' if use_nli else 'disabled'})")

    # ── Lazy Loading ───────────────────────────────────────────────────────────

    @property
    def embedder(self) -> Embedder:
        if self._embedder is None:
            self._embedder = Embedder.get_instance()
        return self._embedder

    @property
    def nli(self) -> ZeroShotClassifier | None:
        if not self.use_nli:
            return None
        if self._nli is None:
            try:
                self._nli = ZeroShotClassifier.get_instance()
            except Exception as e:
                print(f"[Layer 1] WARNING: NLI model failed to load: {e}")
                print("[Layer 1] Falling back to FAISS-only mode.")
                self.use_nli = False
        return self._nli

    @property
    def attack_store(self) -> FAISSStore:
        if self._attack_store is None:
            store_path = os.path.join(
                os.path.dirname(__file__), "..", "data", "attack_embeddings", "attacks"
            )
            if not FAISSStore.exists(store_path):
                raise FileNotFoundError(
                    f"Attack vector store not found at {store_path}.\n"
                    f"Run: python vectorstore/build_stores.py"
                )
            self._attack_store = FAISSStore.load(store_path)
        return self._attack_store

    # ── Core Check Method ──────────────────────────────────────────────────────

    def check(self, user_input: str) -> Layer1Result:
        """
        Run the full Layer 1 check on a user input.

        Args:
            user_input: The raw user query to check

        Returns:
            Layer1Result with decision, scores, and explanation
        """
        if not self.enabled:
            return Layer1Result(
                decision="PASS", risk_score=0.0, faiss_score=0.0, nli_score=0.0,
                top_attack_match="", top_attack_label="", nli_hypothesis="",
                reason="Layer 1 disabled in config",
            )

        if not user_input or not user_input.strip():
            return Layer1Result(
                decision="PASS", risk_score=0.0, faiss_score=0.0, nli_score=0.0,
                top_attack_match="", top_attack_label="", nli_hypothesis="",
                reason="Empty input",
            )

        # ── Signal A: FAISS Similarity ─────────────────────────────────────────
        faiss_score, top_match, top_label, top_k_matches = self._run_faiss(user_input)

        # ── Signal B: Zero-Shot NLI ────────────────────────────────────────────
        nli_score, nli_hypothesis = self._run_nli(user_input)

        # ── Fuse Scores ────────────────────────────────────────────────────────
        if self.use_nli and nli_score > 0:
            risk_score = (self.faiss_weight * faiss_score) + (self.nli_weight * nli_score)
        else:
            # NLI disabled or failed — use FAISS score alone, rescaled
            risk_score = faiss_score

        risk_score = min(1.0, max(0.0, risk_score))  # Clamp to [0, 1]

        # ── Decision ───────────────────────────────────────────────────────────
        decision, reason = self._make_decision(
            risk_score, faiss_score, nli_score, top_match, top_label, nli_hypothesis
        )

        return Layer1Result(
            decision=decision,
            risk_score=risk_score,
            faiss_score=faiss_score,
            nli_score=nli_score,
            top_attack_match=top_match,
            top_attack_label=top_label,
            nli_hypothesis=nli_hypothesis,
            reason=reason,
            top_k_matches=top_k_matches,
        )

    # ── Private Helpers ────────────────────────────────────────────────────────

    def _run_faiss(self, text: str) -> tuple[float, str, str, list[dict]]:
        """
        Embed text and search the attack vector store.
        Returns: (max_score, top_match_text, top_match_label, top_k_list)
        """
        try:
            query_vec = self.embedder.embed_one(text)
            scores, results = self.attack_store.search(query_vec, top_k=self.top_k)

            if len(scores) == 0:
                return 0.0, "", "", []

            max_score = float(scores[0])
            top_match = results[0].get("text", "") if results else ""
            top_label = results[0].get("label", "") if results else ""

            top_k_list = [
                {
                    "rank": i + 1,
                    "score": round(float(s), 4),
                    "text": r.get("text", "")[:80],
                    "label": r.get("label", ""),
                    "source": r.get("source", ""),
                }
                for i, (s, r) in enumerate(zip(scores, results))
            ]
            return max_score, top_match, top_label, top_k_list

        except FileNotFoundError as e:
            # Attack store not built yet — degrade gracefully
            print(f"[Layer 1] WARNING: {e}")
            print("[Layer 1] Running in seed-only fallback mode.")
            return self._run_seed_fallback(text)

        except Exception as e:
            print(f"[Layer 1] FAISS search error: {e}")
            return 0.0, "", "", []

    def _run_seed_fallback(self, text: str) -> tuple[float, str, str, list[dict]]:
        """
        Fallback when FAISS store isn't built yet.
        Embeds the seed attack patterns on-the-fly and does exact cosine search.
        Slower than FAISS but works without the vector store.
        """
        from vectorstore.build_stores import get_seed_attacks
        import numpy as np

        seeds = get_seed_attacks()
        seed_texts = [s["text"] for s in seeds]

        query_vec = self.embedder.embed_one(text)
        seed_vecs = self.embedder.embed_batch(seed_texts)

        sims = self.embedder.cosine_similarity_matrix(query_vec, seed_vecs)
        top_idx = int(sims.argmax())
        max_score = float(sims[top_idx])

        return (
            max_score,
            seeds[top_idx]["text"],
            seeds[top_idx]["label"],
            [{"rank": 1, "score": round(max_score, 4),
              "text": seeds[top_idx]["text"][:80],
              "label": seeds[top_idx]["label"],
              "source": "seed_fallback"}]
        )

    def _run_nli(self, text: str) -> tuple[float, str]:
        """
        Run zero-shot NLI on the text.
        Returns: (adversarial_score, top_hypothesis)
        """
        if not self.use_nli or self.nli is None:
            return 0.0, ""
        try:
            score, hypothesis = self.nli.adversarial_score(text)
            return score, hypothesis
        except Exception as e:
            print(f"[Layer 1] NLI inference error: {e}")
            return 0.0, ""

    def _make_decision(
        self,
        risk_score: float,
        faiss_score: float,
        nli_score: float,
        top_match: str,
        top_label: str,
        nli_hypothesis: str,
    ) -> tuple[str, str]:
        """
        Determine BLOCK or PASS and build a human-readable reason.
        """
        if risk_score >= self.risk_threshold:
            # Build a detailed reason for the audit log
            reasons = []

            if faiss_score >= self.similarity_threshold:
                reasons.append(
                    f"High similarity ({faiss_score:.3f}) to known '{top_label}' attack pattern"
                )

            if nli_score >= self.nli_threshold:
                short_hyp = nli_hypothesis.replace(
                    "This message is ", ""
                ).replace("attempting to ", "").strip().rstrip(".")
                reasons.append(f"NLI entailment ({nli_score:.3f}): {short_hyp}")

            if not reasons:
                reasons.append(f"Combined risk score ({risk_score:.3f}) exceeds threshold")

            return "BLOCK", " | ".join(reasons)

        else:
            # Explain why it passed (useful for debugging false negatives)
            return "PASS", (
                f"Risk score {risk_score:.3f} below threshold {self.risk_threshold} "
                f"(FAISS={faiss_score:.3f}, NLI={nli_score:.3f})"
            )

    # ── Fast Mode (FAISS only, no NLI) ────────────────────────────────────────

    def check_fast(self, user_input: str) -> Layer1Result:
        """
        FAISS-only check — skips NLI for ~100x speedup.
        Use in high-throughput scenarios where latency is critical.
        Still catches most known attacks from the corpus.
        """
        original_use_nli = self.use_nli
        self.use_nli = False
        result = self.check(user_input)
        self.use_nli = original_use_nli
        return result
