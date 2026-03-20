from __future__ import annotations
import re
from dataclasses import dataclass, field


@dataclass
class PIIResult:
    found: bool
    entities: list[dict] = field(default_factory=list)
    redacted_text: str = ""

    def summary(self):
        if not self.entities:
            return "no PII"
        types = list({e["type"] for e in self.entities})
        return ", ".join(types)


_REGEX = {
    "EMAIL_ADDRESS": re.compile(r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Z|a-z]{2,}\b'),
    "PHONE_NUMBER":  re.compile(r'\b(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b'),
    "CREDIT_CARD":   re.compile(r'\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|'
                                r'3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12})\b'),
    "US_SSN":        re.compile(r'\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b'),
    "IP_ADDRESS":    re.compile(r'\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b'),
    "URL":           re.compile(r'https?://[^\s<>"{}|\\^`\[\]]{4,}'),
}


class PIIDetector:
    def __init__(self):
        self._presidio = None
        self._has_presidio = False
        try:
            from presidio_analyzer import AnalyzerEngine
            self._presidio = AnalyzerEngine()
            self._has_presidio = True
            print("[NER] presidio loaded")
        except ImportError:
            print("[NER] presidio not installed, regex-only mode")
        except Exception as e:
            print(f"[NER] presidio error: {e}")

    def analyze(self, text: str, entity_filter: list[str] | None = None) -> PIIResult:
        if not text or not text.strip():
            return PIIResult(found=False, redacted_text=text)

        entities = self._regex_scan(text, entity_filter)

        if self._has_presidio:
            seen = {(e["start"], e["end"]) for e in entities}
            for e in self._presidio_scan(text, entity_filter):
                if (e["start"], e["end"]) not in seen:
                    entities.append(e)
                    seen.add((e["start"], e["end"]))

        entities.sort(key=lambda e: e["start"])
        redacted = self._redact(text, entities) if entities else text
        return PIIResult(found=bool(entities), entities=entities, redacted_text=redacted)

    def _regex_scan(self, text: str, entity_filter):
        out = []
        for pii_type, pat in _REGEX.items():
            if entity_filter and pii_type not in entity_filter:
                continue
            for m in pat.finditer(text):
                out.append({"type": pii_type, "text": m.group(), "start": m.start(),
                             "end": m.end(), "score": 0.9, "source": "regex"})
        return out

    def _presidio_scan(self, text: str, entity_filter):
        try:
            wanted = entity_filter or ["PERSON","EMAIL_ADDRESS","PHONE_NUMBER",
                                       "CREDIT_CARD","US_SSN","IP_ADDRESS","LOCATION","URL"]
            return [{"type": r.entity_type, "text": text[r.start:r.end],
                     "start": r.start, "end": r.end, "score": round(r.score, 3), "source": "presidio"}
                    for r in self._presidio.analyze(text=text, entities=wanted, language="en")
                    if r.score >= 0.6]
        except Exception as e:
            print(f"[NER] presidio scan error: {e}")
            return []

    def _redact(self, text: str, entities: list[dict]) -> str:
        out = text
        for e in reversed(entities):
            out = out[:e["start"]] + f"[{e['type']}]" + out[e["end"]:]
        return out

    def contains_pii(self, text: str) -> bool:
        return self.analyze(text).found
