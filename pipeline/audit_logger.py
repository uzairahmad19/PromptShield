"""
pipeline/audit_logger.py
-------------------------
Structured audit logger for PromptShield.

Every decision made by every layer is written to a JSONL file
(one JSON object per line). This is your audit trail — essential for:
  - Debugging false positives/negatives
  - Academic evaluation (which attacks did each layer catch?)
  - Production monitoring (attack frequency, patterns)

Log format (each line is a JSON object):
{
    "timestamp":       "2024-01-15T10:23:45.123456",
    "session_id":      "abc123",          # unique per pipeline run
    "event_type":      "layer1_decision", # see EVENT_TYPES below
    "layer":           1,
    "decision":        "BLOCK",           # BLOCK | PASS | SANITIZE | FLAG
    "reason":          "High similarity to known jailbreak pattern",
    "risk_score":      0.87,
    "input_preview":   "Ignore all prev...",  # first 100 chars only
    "metadata":        { ... }            # layer-specific extra data
}
"""

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import yaml


def load_config() -> dict:
    config_path = os.path.join(os.path.dirname(__file__), "..", "config.yaml")
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


# ── Event Types ───────────────────────────────────────────────────────────────
EVENT_TYPES = {
    "pipeline_start":    "User query entered the pipeline",
    "layer1_decision":   "Intent Classifier decision",
    "layer2_decision":   "Semantic Policy Check decision",
    "agent_start":       "Agent execution started",
    "tool_call":         "Agent made a tool call",
    "layer3_decision":   "Context Integrity Check on tool output",
    "agent_end":         "Agent execution completed",
    "layer4_decision":   "Response Auditor decision",
    "pipeline_end":      "Pipeline completed, response delivered",
    "error":             "An error occurred in the pipeline",
}

# ── Decisions ─────────────────────────────────────────────────────────────────
BLOCK    = "BLOCK"      # Input rejected, not passed to agent
PASS     = "PASS"       # Input approved, continues through pipeline
SANITIZE = "SANITIZE"   # Tool output cleaned before LLM sees it
FLAG     = "FLAG"       # Response flagged but delivered with warning
REDACT   = "REDACT"     # PII or sensitive content removed from response
ERROR    = "ERROR"      # Something went wrong


class AuditLogger:
    """
    Thread-safe structured logger that writes JSONL audit entries.
    One instance is created per pipeline run (unique session_id).
    """

    def __init__(self, session_id: str | None = None):
        config = load_config()
        log_cfg = config.get("logging", {})

        self.session_id = session_id or str(uuid.uuid4())[:8]
        self.log_dir = Path(log_cfg.get("log_dir", "logs"))
        self.log_file = self.log_dir / log_cfg.get("log_file", "promptshield_audit.jsonl")
        self.log_inputs = log_cfg.get("log_inputs", True)
        self.log_tool_outputs = log_cfg.get("log_tool_outputs", True)
        self.log_final_response = log_cfg.get("log_final_response", True)

        # Create log directory if it doesn't exist
        self.log_dir.mkdir(parents=True, exist_ok=True)

        # Also set up Python's standard logger for console output
        self.console_logger = logging.getLogger(f"promptshield.{self.session_id}")
        if not self.console_logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(logging.Formatter(
                "[%(asctime)s] [%(name)s] %(levelname)s: %(message)s",
                datefmt="%H:%M:%S"
            ))
            self.console_logger.addHandler(handler)
        self.console_logger.setLevel(
            getattr(logging, log_cfg.get("log_level", "INFO"))
        )

    def _write(self, entry: dict) -> None:
        """Write a single audit entry to the JSONL file."""
        entry["timestamp"] = datetime.now(timezone.utc).isoformat()
        entry["session_id"] = self.session_id

        with open(self.log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    def _preview(self, text: str, max_chars: int = 100) -> str:
        """Return a safe preview of text for logging (avoids logging full prompts)."""
        if not text:
            return ""
        preview = text[:max_chars].replace("\n", " ").strip()
        return preview + ("..." if len(text) > max_chars else "")

    # ── Public Logging Methods ─────────────────────────────────────────────────

    def log_pipeline_start(self, user_input: str) -> None:
        entry = {
            "event_type": "pipeline_start",
            "input_preview": self._preview(user_input) if self.log_inputs else "[redacted]",
        }
        self._write(entry)
        self.console_logger.info(f"Pipeline START | input: '{self._preview(user_input, 60)}'")

    def log_layer_decision(
        self,
        layer: int,
        decision: str,
        reason: str,
        risk_score: float | None = None,
        metadata: dict | None = None,
    ) -> None:
        entry = {
            "event_type": f"layer{layer}_decision",
            "layer": layer,
            "decision": decision,
            "reason": reason,
            "risk_score": round(risk_score, 4) if risk_score is not None else None,
            "metadata": metadata or {},
        }
        self._write(entry)

        score_str = f" | score={risk_score:.3f}" if risk_score is not None else ""
        log_fn = self.console_logger.warning if decision in (BLOCK, FLAG, REDACT) else self.console_logger.info
        log_fn(f"Layer {layer}: {decision}{score_str} | {reason}")

    def log_tool_call(self, tool_name: str, tool_input: str, tool_output: str) -> None:
        entry = {
            "event_type": "tool_call",
            "tool_name": tool_name,
            "tool_input_preview": self._preview(tool_input),
            "tool_output_preview": (
                self._preview(tool_output) if self.log_tool_outputs else "[redacted]"
            ),
        }
        self._write(entry)
        self.console_logger.info(f"Tool call: {tool_name}('{self._preview(tool_input, 40)}')")

    def log_pipeline_end(self, final_response: str, was_blocked: bool = False) -> None:
        entry = {
            "event_type": "pipeline_end",
            "was_blocked": was_blocked,
            "response_preview": (
                self._preview(final_response) if self.log_final_response else "[redacted]"
            ),
        }
        self._write(entry)
        status = "BLOCKED" if was_blocked else "DELIVERED"
        self.console_logger.info(f"Pipeline END | status: {status}")

    def log_error(self, error_msg: str, layer: int | None = None) -> None:
        entry = {
            "event_type": "error",
            "layer": layer,
            "error": error_msg,
        }
        self._write(entry)
        self.console_logger.error(f"ERROR (layer={layer}): {error_msg}")
