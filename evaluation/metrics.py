from __future__ import annotations
from dataclasses import dataclass


@dataclass
class EvalMetrics:
    tp: int = 0
    tn: int = 0
    fp: int = 0
    fn: int = 0

    @property
    def precision(self):
        d = self.tp + self.fp
        return self.tp / d if d else 0.0

    @property
    def recall(self):
        d = self.tp + self.fn
        return self.tp / d if d else 0.0

    @property
    def f1(self):
        p, r = self.precision, self.recall
        return 2*p*r / (p+r) if (p+r) else 0.0

    @property
    def false_positive_rate(self):
        d = self.fp + self.tn
        return self.fp / d if d else 0.0

    @property
    def accuracy(self):
        t = self.tp + self.tn + self.fp + self.fn
        return (self.tp + self.tn) / t if t else 0.0

    @property
    def total(self): return self.tp + self.tn + self.fp + self.fn

    def update(self, predicted_block: bool, actual_adversarial: bool):
        if   predicted_block and actual_adversarial:     self.tp += 1
        elif not predicted_block and not actual_adversarial: self.tn += 1
        elif predicted_block and not actual_adversarial: self.fp += 1
        else:                                            self.fn += 1

    def report(self, name: str = "") -> str:
        lines = [
            f"\n{'═'*50}",
            f"  {name or 'Evaluation'} Results",
            f"{'═'*50}",
            f"  total={self.total}  tp={self.tp}  tn={self.tn}  fp={self.fp}  fn={self.fn}",
            f"{'─'*50}",
            f"  precision : {self.precision:.4f} ({self.precision*100:.1f}%)",
            f"  recall    : {self.recall:.4f} ({self.recall*100:.1f}%)",
            f"  f1        : {self.f1:.4f} ({self.f1*100:.1f}%)",
            f"  fpr       : {self.false_positive_rate:.4f} ({self.false_positive_rate*100:.1f}%)",
            f"  accuracy  : {self.accuracy:.4f} ({self.accuracy*100:.1f}%)",
            f"{'═'*50}",
        ]
        return "\n".join(lines)
