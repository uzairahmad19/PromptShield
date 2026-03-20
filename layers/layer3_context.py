from __future__ import annotations
import os
import re
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


# common injection patterns — regex-compiled once
_PATTERNS = [re.compile(p, re.I | re.M) for p in [
    r"ignore\s+(all\s+)?(previous|prior|earlier)\s+instructions?",
    r"disregard\s+(your\s+)?(previous|prior|all)\s+",
    r"forget\s+(everything|all)\s+(you\s+)?(were\s+)?told",
    r"your\s+(previous\s+)?rules?\s+(no\s+longer|are\s+void|don.t\s+apply)",
    r"override\s*(your\s*)?(previous\s*)?(instructions?|rules?|guidelines?)",
    r"new\s+(directive|instruction|rule|task|priority)\s*:",
    r"new\s+system\s+(prompt|instructions?)\s*:",
    r"you\s+are\s+now\s+(a\s+)?(?!(?:going|able|allowed|ready))",
    r"from\s+now\s+on\s+you\s+are",
    r"act\s+as\s+(if\s+you\s+(have|had)\s+no|an?\s+ai\s+with\s+no)",
    r"\[INST\]", r"\[/INST\]",
    r"<\|im_start\|>", r"<\|im_end\|>", r"<\|system\|>",
    r"###\s*[Ii]nstruction", r"###\s*[Ss]ystem",
    r"^SYSTEM\s*:", r"^ASSISTANT\s*:", r"^\[SYSTEM\]",
    r"note\s+to\s+(the\s+)?(ai|assistant|model|llm)\s*:",
    r"important\s+(system\s+)?message\s*:",
    r"(send|post|forward|email|transmit)\s+.{0,30}\s+to\s+(https?://|www\.|[a-z0-9.]+\.(com|io|net|org))",
    r"(http|https)://[^\s]{5,}\s*(collect|log|steal|harvest)",
]]


@dataclass
class Layer3Result:
    decision: str
    tool_name: str
    original_output: str
    sanitized_output: str
    structural_hits: list[str]
    semantic_score: float
    intent_drift_score: float
    reason: str

    @property
    def is_blocked(self): return self.decision == "BLOCK"

    @property
    def output_to_use(self):
        if self.decision == "BLOCK":
            return "[tool output blocked by PromptShield — injection detected]"
        return self.sanitized_output


class ContextIntegrityChecker:
    def __init__(self):
        c = _cfg()["layer3"]
        self.enabled        = c.get("enabled", True)
        self.inj_threshold  = c["injection_similarity_threshold"]
        self.drift_threshold= c["intent_drift_threshold"]
        self.max_chars      = c["max_tool_output_chars"]
        self._embedder      = None
        self._store         = None
        print("[Layer3] init")

    @property
    def embedder(self):
        if not self._embedder:
            self._embedder = Embedder.get_instance()
        return self._embedder

    @property
    def store(self):
        if self._store is None:
            path = os.path.join(os.path.dirname(__file__), "..", "data", "attack_embeddings", "attacks")
            self._store = FAISSStore.load(path) if FAISSStore.exists(path) else False
            if self._store is False:
                print("[Layer3] attack store not found — semantic check disabled")
        return self._store or None

    # Tools that are expected to return content semantically different from
    # the query by nature — web search returns articles, file_reader returns
    # raw file content. Flagging drift on these causes constant false positives.
    _LOW_DRIFT_EXEMPT_TOOLS = {"web_search", "file_reader"}

    def check(self, tool_output: str, tool_name: str, original_user_query: str) -> Layer3Result:
        if not self.enabled:
            return self._pass(tool_name, tool_output, "disabled")
        if not tool_output or not tool_output.strip():
            return self._pass(tool_name, tool_output, "empty output")

        text = tool_output[:self.max_chars]
        hits, cleaned = self._scan_structural(text)
        sem_score     = self._semantic_score(text)
        drift         = self._drift_score(text, original_user_query)

        has_exfil  = any(
            any(kw in h.lower() for kw in ["send", "post", "forward", "email", "collect", "log", "steal", "harvest", "transmit"])
            for h in hits
        )
        high_sem   = sem_score >= self.inj_threshold
        # Only trigger drift FLAG when:
        # - the tool isn't one that naturally returns off-topic content (web_search, file_reader)
        # - AND there are no structural injection hits (if hits exist, BLOCK/SANITIZE takes precedence anyway)
        # Previously, web_search results for any query triggered FLAG because
        # article text has low cosine similarity to a short query string.
        low_drift  = (
            drift < self.drift_threshold
            and tool_name not in self._LOW_DRIFT_EXEMPT_TOOLS
            and not hits
            and not high_sem
        )

        reasons = []
        if hits:      reasons.append(f"structural hits: {hits[:2]}")
        if high_sem:  reasons.append(f"sem={sem_score:.3f}")
        if low_drift: reasons.append(f"drift={drift:.3f}")

        reason = " | ".join(reasons) or "clean"

        if has_exfil or (hits and high_sem):
            return Layer3Result("BLOCK", tool_name, tool_output, cleaned, hits, sem_score, drift, f"BLOCK — {reason}")
        if hits or high_sem:
            return Layer3Result("SANITIZE", tool_name, tool_output, cleaned, hits, sem_score, drift, f"SANITIZE — {reason}")
        if low_drift:
            return Layer3Result("FLAG", tool_name, tool_output, tool_output, hits, sem_score, drift, f"FLAG — {reason}")

        return self._pass(tool_name, tool_output, reason)

    def check_all_steps(self, steps: list, query: str):
        results, sanitized = [], []
        for action, obs in steps:
            r = self.check(str(obs), action.tool, query)
            results.append(r)
            sanitized.append((action, r.output_to_use))
        return results, sanitized

    def _scan_structural(self, text: str) -> tuple[list[str], str]:
        hits, out = [], text
        for pat in _PATTERNS:
            m = pat.search(out)
            if m:
                hits.append(f"'{m.group(0)[:50]}'")
                start   = m.start()
                line_end = out.find("\n", start)
                if line_end == -1: line_end = len(out)
                out = out[:start] + "[REDACTED]" + out[line_end:]
        return hits, out

    def _semantic_score(self, text: str) -> float:
        if not self.store:
            return 0.0
        try:
            return self.store.max_similarity(self.embedder.embed_one(text[:512]))
        except Exception:
            return 0.0

    def _drift_score(self, text: str, query: str) -> float:
        if not query or not query.strip():
            return 1.0
        try:
            qv = self.embedder.embed_one(query[:256])
            ov = self.embedder.embed_one(text[:512])
            return self.embedder.cosine_similarity(qv, ov)
        except Exception:
            return 1.0

    def _pass(self, tool: str, out: str, reason: str) -> Layer3Result:
        return Layer3Result("PASS", tool, out, out, [], 0.0, 1.0, reason)