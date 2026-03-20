from __future__ import annotations
import os
import sys
from dataclasses import dataclass, field

import yaml

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models.embedder import Embedder
from models.ner_model import PIIDetector, PIIResult
from models.toxicity_model import ToxicityClassifier
from agent.prompt_templates import SYSTEM_PROMPT


def _cfg():
    p = os.path.join(os.path.dirname(__file__), "..", "config.yaml")
    with open(p) as f:
        return yaml.safe_load(f)


@dataclass
class Layer4Result:
    decision: str
    final_response: str
    original_response: str
    pii_result: PIIResult | None   = None
    system_prompt_leak_score: float = 0.0
    intent_fidelity_score: float    = 1.0
    toxicity_score: float           = 0.0
    flags: list[str]                = field(default_factory=list)
    reason: str                     = ""

    @property
    def is_blocked(self): return self.decision == "BLOCK"

    @property
    def was_modified(self): return self.final_response != self.original_response


class ResponseAuditor:
    _sys_vec = None  # cached system prompt embedding

    def __init__(self):
        c = _cfg()["layer4"]
        self.enabled          = c.get("enabled", True)
        self.leak_threshold   = c["system_prompt_leak_threshold"]
        self.fidelity_threshold = c["intent_fidelity_threshold"]
        self.tox_threshold    = c["toxicity_threshold"]
        self.pii_entities     = c.get("pii_entities", None)
        self._embedder        = None
        self._pii             = None
        self._tox             = None
        print("[Layer4] init")

    @property
    def embedder(self):
        if not self._embedder:
            self._embedder = Embedder.get_instance()
        return self._embedder

    @property
    def pii(self):
        if not self._pii:
            self._pii = PIIDetector()
        return self._pii

    @property
    def tox(self):
        if not self._tox:
            self._tox = ToxicityClassifier(threshold=self.tox_threshold)
        return self._tox

    def _sys_prompt_vec(self):
        if ResponseAuditor._sys_vec is None:
            ResponseAuditor._sys_vec = self.embedder.embed_one(SYSTEM_PROMPT)
        return ResponseAuditor._sys_vec

    def check(self, response: str, original_query: str) -> Layer4Result:
        if not self.enabled:
            return Layer4Result("PASS", response, response, reason="disabled")
        if not response or not response.strip():
            return Layer4Result("PASS", response, response, reason="empty")

        flags   = []
        current = response

        # PII check
        pii = self.pii.analyze(current, self.pii_entities)
        if pii.found:
            flags.append(f"PII: {pii.summary()}")
            current = pii.redacted_text

        # system prompt leak
        try:
            leak = float(self.embedder.cosine_similarity(
                self._sys_prompt_vec(), self.embedder.embed_one(response[:512])
            ))
        except Exception:
            leak = 0.0

        if leak >= self.leak_threshold:
            flags.append(f"system prompt leak (sim={leak:.3f})")
            current = "I can't share my internal instructions."

        # intent fidelity — skip for short/error responses to avoid false-positive FLAGs.
        # A parse-error string or "agent stopped" message always scores near 0 against any
        # real query, causing the layer to FLAG legitimate (but failed) agent runs.
        _skip_fidelity = (
            not original_query
            or not original_query.strip()
            or len(response.strip()) < 30
            or "invalid format" in response.lower()
            or "agent stopped" in response.lower()
            or "wasn't able to complete" in response.lower()
        )
        try:
            fidelity = 1.0 if _skip_fidelity else float(self.embedder.cosine_similarity(
                self.embedder.embed_one(original_query[:256]),
                self.embedder.embed_one(response[:512])
            ))
        except Exception:
            fidelity = 1.0

        if fidelity < self.fidelity_threshold:
            flags.append(f"intent drift (fidelity={fidelity:.3f})")

        # toxicity
        tox_res = self.tox.score(response)
        if tox_res.is_toxic:
            flags.append(f"toxic: {tox_res.reason}")

        # decision
        reason = " | ".join(flags) if flags else "all clear"

        if tox_res.is_toxic:
            return Layer4Result("BLOCK", "I can't provide that response.", response,
                                pii, leak, fidelity, tox_res.toxicity_score, flags, f"BLOCK — {reason}")
        if pii.found or leak >= self.leak_threshold:
            return Layer4Result("REDACT", current, response,
                                pii, leak, fidelity, tox_res.toxicity_score, flags, f"REDACT — {reason}")
        if fidelity < self.fidelity_threshold:
            return Layer4Result("FLAG", current, response,
                                pii, leak, fidelity, tox_res.toxicity_score, flags, f"FLAG — {reason}")

        return Layer4Result("PASS", current, response,
                            pii, leak, fidelity, tox_res.toxicity_score, flags, reason)