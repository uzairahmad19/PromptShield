from __future__ import annotations
import json
import os
import sys
from dataclasses import dataclass, field

import yaml

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models.embedder import Embedder
from vectorstore.faiss_store import FAISSStore


def _cfg():
    p = os.path.join(os.path.dirname(__file__), "..", "config.yaml")
    with open(p) as f:
        return yaml.safe_load(f)


@dataclass
class Layer2Result:
    decision: str
    violation_score: float
    violated_policy_id: str
    violated_policy_name: str
    violated_policy_severity: str
    closest_violation_example: str
    reason: str
    all_policy_scores: list[dict] = field(default_factory=list)

    @property
    def is_blocked(self): return self.decision == "BLOCK"


class PolicyChecker:
    def __init__(self):
        c = _cfg()["layer2"]
        self.enabled   = c.get("enabled", True)
        self.threshold = c["policy_violation_threshold"]
        self._embedder = None
        self._store    = None
        self._policies = None
        print(f"[Layer2] init (threshold={self.threshold})")

    @property
    def embedder(self):
        if not self._embedder:
            self._embedder = Embedder.get_instance()
        return self._embedder

    @property
    def store(self):
        if not self._store:
            path = os.path.join(os.path.dirname(__file__), "..", "data", "attack_embeddings", "policy_embeddings")
            if not FAISSStore.exists(path):
                raise FileNotFoundError("policy store missing — run: python vectorstore/build_stores.py")
            self._store = FAISSStore.load(path)
        return self._store

    @property
    def policies(self):
        if not self._policies:
            p = os.path.join(os.path.dirname(__file__), "..", "data", "policy_rules", "policies.json")
            with open(p) as f:
                self._policies = {x["id"]: x for x in json.load(f)["policies"]}
        return self._policies

    def check(self, text: str) -> Layer2Result:
        if not self.enabled:
            return self._pass("layer 2 disabled")
        if not text or not text.strip():
            return self._pass("empty input")

        try:
            vec = self.embedder.embed_one(text)
        except Exception as e:
            return self._pass(f"embed error: {e}")

        try:
            scores, results = self.store.search(vec, top_k=20)
        except FileNotFoundError:
            return self._fallback(text)
        except Exception as e:
            return self._pass(f"store error: {e}")

        if not len(scores):
            return self._pass("no matches")

        # group by policy, keep max score per policy
        best: dict[str, dict] = {}
        for score, meta in zip(scores, results):
            pid = meta.get("policy_id", "?")
            if pid not in best or float(score) > best[pid]["score"]:
                best[pid] = {
                    "score":    float(score),
                    "example":  meta.get("text", ""),
                    "name":     meta.get("policy_name", ""),
                    "severity": meta.get("severity", "HIGH"),
                    "id":       pid,
                }

        sev_weight = {"CRITICAL": 1.1, "HIGH": 1.0}
        ranked = sorted(best.values(), key=lambda x: x["score"] * sev_weight.get(x["severity"], 1.0), reverse=True)

        all_scores = [{"policy_id": x["id"], "policy_name": x["name"],
                       "score": round(x["score"], 4), "severity": x["severity"],
                       "closest_example": x["example"][:60]} for x in ranked]

        top = ranked[0]
        thresh = self.threshold - (0.05 if top["severity"] == "CRITICAL" else 0)

        if top["score"] >= thresh:
            reason = f"policy '{top['name']}' [{top['id']}] violated (sim={top['score']:.3f})"
            return Layer2Result("BLOCK", top["score"], top["id"], top["name"],
                                top["severity"], top["example"], reason, all_scores)

        return Layer2Result("PASS", top["score"], top["id"], top["name"],
                            top["severity"], top["example"],
                            f"max score {top['score']:.3f} < threshold {self.threshold}",
                            all_scores)

    def _fallback(self, text: str) -> Layer2Result:
        print("[Layer2] store missing, doing on-the-fly check")
        vec = self.embedder.embed_one(text)
        best_score, best_meta = 0.0, {}
        for pol in self.policies.values():
            examples = pol.get("violation_examples", [])
            if not examples:
                continue
            vecs = self.embedder.embed_batch(examples)
            sims = self.embedder.cosine_similarity_matrix(vec, vecs)
            i = int(sims.argmax())
            if float(sims[i]) > best_score:
                best_score = float(sims[i])
                best_meta  = {**pol, "example": examples[i]}

        thresh = self.threshold - (0.05 if best_meta.get("severity") == "CRITICAL" else 0)
        dec = "BLOCK" if best_score >= thresh else "PASS"
        return Layer2Result(dec, best_score, best_meta.get("id",""),
                            best_meta.get("name",""), best_meta.get("severity","HIGH"),
                            best_meta.get("example",""),
                            f"fallback check: {dec} (score={best_score:.3f})")

    def _pass(self, reason: str) -> Layer2Result:
        return Layer2Result("PASS", 0.0, "", "", "", "", reason)
