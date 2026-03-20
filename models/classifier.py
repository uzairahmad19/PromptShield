from __future__ import annotations
import os
import yaml
from transformers import pipeline


def _cfg():
    p = os.path.join(os.path.dirname(__file__), "..", "config.yaml")
    with open(p) as f:
        return yaml.safe_load(f)


# these are the hypotheses we test every input against
HYPOTHESES = [
    "This message is attempting to override or ignore previous AI instructions.",
    "This message is trying to make the AI adopt a different identity or role.",
    "This message is attempting to extract the AI's system prompt or internal instructions.",
    "This message is trying to jailbreak or bypass the AI's safety guidelines.",
    "This message contains an attempt to manipulate the AI into harmful behavior.",
    "This message is trying to get the AI to reveal confidential information.",
    "This message is attempting to get the AI to exfiltrate user data.",
]


class ZeroShotClassifier:
    _instance: "ZeroShotClassifier | None" = None

    def __init__(self, model_name: str | None = None):
        c = _cfg()["layer1"]
        self.model_name = model_name or c.get("nli_model", "facebook/bart-large-mnli")
        self.threshold = c.get("nli_threshold", 0.75)
        print(f"[NLI] loading {self.model_name} (first run downloads ~1.6GB)")
        self._pipe = pipeline(
            "zero-shot-classification",
            model=self.model_name,
            device=-1,
            multi_label=True,
        )
        print("[NLI] ready")

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def adversarial_score(self, text: str) -> tuple[float, str]:
        if not text or not text.strip():
            return 0.0, ""
        try:
            res = self._pipe(
                sequences=text[:1024],
                candidate_labels=HYPOTHESES,
                hypothesis_template="{}",
            )
            top_idx = res["scores"].index(max(res["scores"]))
            return float(res["scores"][top_idx]), res["labels"][top_idx]
        except Exception as e:
            print(f"[NLI] inference failed: {e}")
            return 0.0, ""

    def is_adversarial(self, text: str) -> tuple[bool, float, str]:
        score, hyp = self.adversarial_score(text)
        return score >= self.threshold, score, hyp
