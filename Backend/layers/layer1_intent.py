from __future__ import annotations
import os
import sys
import yaml
from dataclasses import dataclass, field
from dotenv import load_dotenv 

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models.embedder import Embedder
from models.classifier import ZeroShotClassifier
from vectorstore.faiss_store import FAISSStore

# Load the .env file
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

def _cfg():
    p = os.path.join(os.path.dirname(__file__), "..", "config.yaml")
    with open(p, "r") as f:
        yaml_content = f.read()
    
    # Expand ${VAR} syntax in the string using environment variables
    expanded_content = os.path.expandvars(yaml_content)
    return yaml.safe_load(expanded_content)


@dataclass
class Layer1Result:
    decision: str
    risk_score: float
    faiss_score: float
    nli_score: float
    top_attack_match: str
    top_attack_label: str
    nli_hypothesis: str
    reason: str
    top_k_matches: list[dict] = field(default_factory=list)

    @property
    def is_blocked(self): return self.decision == "BLOCK"


class IntentClassifier:
    def __init__(self, use_nli: bool = True):
        c = _cfg()["layer1"]
        self.enabled = c.get("enabled", True)
        self.use_nli = use_nli
        self.sim_thresh  = c["similarity_threshold"]
        self.nli_thresh  = c["nli_threshold"]
        self.risk_thresh = c["risk_threshold"]
        
        # NEW: High confidence threshold to prevent data poisoning
        self.auto_update_thresh = c["auto_update_threshold"] 
        
        self.top_k       = c["top_k"]
        self._embedder   = None
        self._nli        = None
        self._store      = None
        print(f"[Layer1] init (nli={'on' if use_nli else 'off'})")

    # NEW: Property to hold the path for saving updates
    @property
    def store_path(self):
        return os.path.join(os.path.dirname(__file__), "..", "data", "attack_embeddings", "attacks")

    @property
    def store(self):
        if not self._store:
            path = self.store_path
            if not FAISSStore.exists(path):
                raise FileNotFoundError(f"attack store missing — run: python vectorstore/build_stores.py")
            self._store = FAISSStore.load(path)
        return self._store

    @property
    def embedder(self):
        if not self._embedder:
            self._embedder = Embedder.get_instance()
        return self._embedder

    @property
    def nli(self):
        if not self.use_nli:
            return None
        if not self._nli:
            try:
                self._nli = ZeroShotClassifier.get_instance()
            except Exception as e:
                print(f"[Layer1] NLI load failed: {e}, falling back to FAISS-only")
                self.use_nli = False
        return self._nli

    def check(self, text: str) -> Layer1Result:
        if not self.enabled:
            return self._pass("layer 1 disabled")
        if not text or not text.strip():
            return self._pass("empty input")

        faiss_score, top_match, top_label, top_k = self._faiss_check(text)
        nli_score, nli_hyp = self._nli_check(text)

        if self.use_nli and nli_score > 0:
            risk = 0.6 * faiss_score + 0.4 * nli_score
        else:
            risk = faiss_score
        risk = min(1.0, max(0.0, risk))

        if risk >= self.risk_thresh:
            reasons = []
            if faiss_score >= self.sim_thresh:
                reasons.append(f"similarity {faiss_score:.3f} to '{top_label}' pattern")
            if nli_score >= self.nli_thresh:
                reasons.append(f"NLI {nli_score:.3f}")
            reason = " | ".join(reasons) or f"risk {risk:.3f} >= threshold"

            # --- AUTO-UPDATE LOGIC ---
            if risk >= self.auto_update_thresh:
                print(f"[Layer1] High confidence attack detected (risk={risk:.3f}). Auto-updating FAISS store.")
                try:
                    # Re-embed the text to ensure we have the exact vector
                    vec = self.embedder.embed_one(text)
                    new_meta = {
                        "text": text, 
                        "label": "auto_blocked", 
                        "source": "dynamic_update"
                    }
                    self.store.add_item(vec, new_meta)
                    self.store.save(self.store_path)
                except Exception as e:
                    print(f"[Layer1] Failed to auto-update FAISS store: {e}")

            return Layer1Result("BLOCK", risk, faiss_score, nli_score,
                                top_match, top_label, nli_hyp, reason, top_k)

        return Layer1Result("PASS", risk, faiss_score, nli_score,
                            top_match, top_label, nli_hyp,
                            f"risk {risk:.3f} < {self.risk_thresh}", top_k)

    def check_fast(self, text: str) -> Layer1Result:
        orig = self.use_nli
        self.use_nli = False
        r = self.check(text)
        self.use_nli = orig
        return r

    def _faiss_check(self, text: str):
        try:
            vec = self.embedder.embed_one(text)
            scores, results = self.store.search(vec, self.top_k)
            if not len(scores):
                return 0.0, "", "", []
            top_k = [{"rank": i+1, "score": round(float(s), 4),
                       "text": r.get("text","")[:80], "label": r.get("label",""),
                       "source": r.get("source","")}
                     for i, (s, r) in enumerate(zip(scores, results))]
            return float(scores[0]), results[0].get("text",""), results[0].get("label",""), top_k
        except FileNotFoundError:
            return self._seed_fallback(text)
        except Exception as e:
            print(f"[Layer1] FAISS error: {e}")
            return 0.0, "", "", []

    def _seed_fallback(self, text: str):
        from vectorstore.build_stores import get_seed_attacks
        seeds = get_seed_attacks()
        vecs  = self.embedder.embed_batch([s["text"] for s in seeds])
        q     = self.embedder.embed_one(text)
        sims  = self.embedder.cosine_similarity_matrix(q, vecs)
        i     = int(sims.argmax())
        return float(sims[i]), seeds[i]["text"], seeds[i]["label"], \
               [{"rank":1, "score": round(float(sims[i]),4),
                 "text": seeds[i]["text"][:80], "label": seeds[i]["label"], "source":"seed"}]

    def _nli_check(self, text: str):
        if not self.use_nli or not self.nli:
            return 0.0, ""
        try:
            return self.nli.adversarial_score(text)
        except Exception as e:
            print(f"[Layer1] NLI error: {e}")
            return 0.0, ""

    def _pass(self, reason: str) -> Layer1Result:
        return Layer1Result("PASS", 0.0, 0.0, 0.0, "", "", "", reason)
