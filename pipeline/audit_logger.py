import json
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import yaml

BLOCK    = "BLOCK"
PASS     = "PASS"
SANITIZE = "SANITIZE"
FLAG     = "FLAG"
ERROR    = "ERROR"

# Project root — one level up from pipeline/
_PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _cfg():
    p = _PROJECT_ROOT / "config.yaml"
    with open(p) as f:
        return yaml.safe_load(f)


class AuditLogger:
    def __init__(self, session_id: str | None = None):
        c = _cfg().get("logging", {})
        self.session_id   = session_id or str(uuid.uuid4())[:8]

        # Resolve log_dir relative to project root, not CWD
        log_dir_cfg = c.get("log_dir", "logs")
        if not os.path.isabs(log_dir_cfg):
            self.log_dir = _PROJECT_ROOT / log_dir_cfg
        else:
            self.log_dir = Path(log_dir_cfg)

        self.log_file     = self.log_dir / c.get("log_file", "promptshield_audit.jsonl")
        self.log_inputs   = c.get("log_inputs", True)
        self.log_tool_out = c.get("log_tool_outputs", True)
        self.log_dir.mkdir(parents=True, exist_ok=True)

        self._log = logging.getLogger(f"ps.{self.session_id}")
        if not self._log.handlers:
            h = logging.StreamHandler()
            h.setFormatter(logging.Formatter("[%(asctime)s] %(name)s %(levelname)s: %(message)s", "%H:%M:%S"))
            self._log.addHandler(h)
        self._log.setLevel(getattr(logging, c.get("log_level", "INFO")))

    def _write(self, entry: dict):
        entry["ts"]         = datetime.now(timezone.utc).isoformat()
        entry["session_id"] = self.session_id
        with open(self.log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    def _preview(self, text: str, n: int = 100) -> str:
        if not text: return ""
        return text[:n].replace("\n", " ").strip() + ("..." if len(text) > n else "")

    def log_pipeline_start(self, user_input: str):
        self._write({"event": "start", "input": self._preview(user_input) if self.log_inputs else "[redacted]"})
        self._log.info(f"START | '{self._preview(user_input, 60)}'")

    def log_layer_decision(self, layer: int, decision: str, reason: str,
                           risk_score: float | None = None, metadata: dict | None = None):
        self._write({"event": f"layer{layer}", "layer": layer, "decision": decision,
                     "reason": reason, "risk_score": round(risk_score, 4) if risk_score is not None else None,
                     "metadata": metadata or {}})
        score_str = f" score={risk_score:.3f}" if risk_score is not None else ""
        log_fn = self._log.warning if decision in (BLOCK, FLAG) else self._log.info
        log_fn(f"L{layer}: {decision}{score_str} | {reason}")

    def log_tool_call(self, tool_name: str, tool_input: str, tool_output: str):
        self._write({"event": "tool_call", "tool": tool_name,
                     "input": self._preview(tool_input),
                     "output": self._preview(tool_output) if self.log_tool_out else "[redacted]"})
        self._log.info(f"tool: {tool_name}('{self._preview(tool_input, 40)}')")

    def log_pipeline_end(self, response: str, was_blocked: bool = False):
        self._write({"event": "end", "blocked": was_blocked, "response": self._preview(response)})
        self._log.info(f"END | {'BLOCKED' if was_blocked else 'OK'}")

    def log_error(self, msg: str, layer: int | None = None):
        self._write({"event": "error", "layer": layer, "error": msg})
        self._log.error(f"layer={layer} | {msg}")
