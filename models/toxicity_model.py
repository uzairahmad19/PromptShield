from __future__ import annotations
from dataclasses import dataclass


@dataclass
class ToxicityResult:
    is_toxic: bool
    toxicity_score: float
    scores: dict
    reason: str


class ToxicityClassifier:
    _instance: "ToxicityClassifier | None" = None

    def __init__(self, threshold: float = 0.75):
        self.threshold  = threshold
        self._model     = None
        self._available = False
        try:
            from detoxify import Detoxify
            self._model     = Detoxify("original")
            self._available = True
            print("[Toxicity] detoxify loaded")
        except ImportError:
            print("[Toxicity] detoxify not installed — skipping toxicity checks")
        except Exception as e:
            print(f"[Toxicity] load error: {e}")

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def score(self, text: str) -> ToxicityResult:
        if not text or not text.strip():
            return ToxicityResult(False, 0.0, {}, "empty")
        if not self._available:
            return ToxicityResult(False, 0.0, {}, "model unavailable")
        try:
            raw    = self._model.predict(text[:512])
            scores = {k: round(float(v), 4) for k, v in raw.items()}
            top    = scores.get("toxicity", 0.0)
            triggered = [f"{k}={v:.3f}" for k, v in scores.items() if v >= self.threshold]
            reason = ", ".join(triggered) if triggered else f"max={top:.3f}"
            return ToxicityResult(top >= self.threshold, top, scores, reason)
        except Exception as e:
            print(f"[Toxicity] inference error: {e}")
            return ToxicityResult(False, 0.0, {}, f"error: {e}")
