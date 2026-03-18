"""
evaluation/metrics.py
----------------------
Shared evaluation metrics for all PromptShield layers.

Metrics used:
  - Precision    : Of all inputs we blocked, what fraction were truly adversarial?
                   (Low precision = too many false positives — blocking legit users)
  - Recall       : Of all truly adversarial inputs, what fraction did we catch?
                   (Low recall = too many false negatives — missing attacks)
  - F1 Score     : Harmonic mean of precision and recall
  - FPR          : False Positive Rate — how often we block benign inputs
  - Accuracy     : Overall correctness across all inputs

In security, RECALL is more important than PRECISION —
missing an attack is worse than occasionally blocking a benign query.
We optimize for F1 with a slight bias toward recall.
"""

from __future__ import annotations
from dataclasses import dataclass


@dataclass
class EvalMetrics:
    """Evaluation metrics for a single layer or full pipeline."""
    tp: int = 0   # True Positives  (correctly blocked attacks)
    tn: int = 0   # True Negatives  (correctly passed benign inputs)
    fp: int = 0   # False Positives (benign inputs incorrectly blocked)
    fn: int = 0   # False Negatives (attacks that slipped through)

    @property
    def precision(self) -> float:
        """Of everything we blocked, how many were actual attacks?"""
        denom = self.tp + self.fp
        return self.tp / denom if denom > 0 else 0.0

    @property
    def recall(self) -> float:
        """Of all real attacks, how many did we catch?"""
        denom = self.tp + self.fn
        return self.tp / denom if denom > 0 else 0.0

    @property
    def f1(self) -> float:
        p, r = self.precision, self.recall
        return 2 * p * r / (p + r) if (p + r) > 0 else 0.0

    @property
    def false_positive_rate(self) -> float:
        """How often do we wrongly block benign users?"""
        denom = self.fp + self.tn
        return self.fp / denom if denom > 0 else 0.0

    @property
    def accuracy(self) -> float:
        total = self.tp + self.tn + self.fp + self.fn
        return (self.tp + self.tn) / total if total > 0 else 0.0

    @property
    def total(self) -> int:
        return self.tp + self.tn + self.fp + self.fn

    def update(self, predicted_block: bool, actual_adversarial: bool) -> None:
        """Update counts based on one prediction."""
        if predicted_block and actual_adversarial:
            self.tp += 1
        elif not predicted_block and not actual_adversarial:
            self.tn += 1
        elif predicted_block and not actual_adversarial:
            self.fp += 1
        else:
            self.fn += 1

    def report(self, layer_name: str = "Layer") -> str:
        lines = [
            f"\n{'═' * 50}",
            f"  {layer_name} Evaluation Report",
            f"{'═' * 50}",
            f"  Total samples : {self.total}",
            f"  True Positives : {self.tp}  (attacks correctly blocked)",
            f"  True Negatives : {self.tn}  (benign inputs correctly passed)",
            f"  False Positives: {self.fp}  (benign inputs wrongly blocked)",
            f"  False Negatives: {self.fn}  (attacks that slipped through)",
            f"{'─' * 50}",
            f"  Precision  : {self.precision:.4f}  ({self.precision*100:.1f}%)",
            f"  Recall     : {self.recall:.4f}  ({self.recall*100:.1f}%)",
            f"  F1 Score   : {self.f1:.4f}  ({self.f1*100:.1f}%)",
            f"  FPR        : {self.false_positive_rate:.4f}  ({self.false_positive_rate*100:.1f}%)",
            f"  Accuracy   : {self.accuracy:.4f}  ({self.accuracy*100:.1f}%)",
            f"{'═' * 50}",
        ]
        return "\n".join(lines)
