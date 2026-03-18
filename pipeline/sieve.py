"""
pipeline/sieve.py
------------------
PromptShield Pipeline Orchestrator.

This is the main controller that chains all 4 layers together.
Currently a stub — will be fully implemented after all 4 layers are built.

Final flow:
    User Input
        → Layer 1: IntentClassifier.check(input)         → BLOCK or continue
        → Layer 2: PolicyChecker.check(input)            → BLOCK or continue
        → Agent runs, tool outputs collected
        → Layer 3: ContextIntegrityChecker.check(output) → SANITIZE or continue
        → LLM generates response
        → Layer 4: ResponseAuditor.check(response)       → REDACT/FLAG or deliver
        → Return safe response + audit log
"""

from __future__ import annotations
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pipeline.audit_logger import AuditLogger, BLOCK, PASS


# ── Blocked Response Templates ─────────────────────────────────────────────────

BLOCK_MESSAGES = {
    1: "I'm sorry, but I can't process this request. It appears to contain patterns associated with prompt injection or adversarial intent.",
    2: "This request appears to violate the system's security policies and cannot be processed.",
    3: "A tool response contained potentially injected content and has been blocked for your safety.",
    4: "The generated response was flagged by the safety auditor and has been withheld.",
}


class PromptShieldPipeline:
    """
    PromptShield Pipeline — orchestrates all 4 layers.
    Stub implementation — layers will be activated as they are built.
    """

    def __init__(self, verbose: bool = True):
        self.verbose = verbose
        # Layers will be lazy-loaded as they are implemented
        self._layer1 = None
        self._layer2 = None
        self._layer3 = None
        self._layer4 = None

    def run(self, user_input: str) -> dict:
        """
        Run a user input through the full PromptShield pipeline.

        Returns:
            {
                "output": str,          — final response (or block message)
                "blocked": bool,        — was the request blocked?
                "blocked_at_layer": int|None,
                "audit_session": str,   — session ID for log lookup
            }
        """
        logger = AuditLogger()
        logger.log_pipeline_start(user_input)

        # ── Layer 1 ────────────────────────────────────────────────────────────
        if self._layer1 is not None:
            result = self._layer1.check(user_input)
            logger.log_layer_decision(
                layer=1,
                decision=result.decision,
                reason=result.reason,
                risk_score=result.risk_score,
                metadata={"faiss_score": result.faiss_score, "nli_score": result.nli_score},
            )
            if result.is_blocked:
                logger.log_pipeline_end(BLOCK_MESSAGES[1], was_blocked=True)
                return {
                    "output": BLOCK_MESSAGES[1],
                    "blocked": True,
                    "blocked_at_layer": 1,
                    "audit_session": logger.session_id,
                }

        # ── Layer 2, 3, 4 will be added here as they are built ────────────────

        # ── Run agent (unguarded until all layers built) ───────────────────────
        try:
            from agent.react_agent import run_agent
            agent_result = run_agent(user_input, verbose=self.verbose)
            final_response = agent_result.get("output", "No response generated.")
        except Exception as e:
            logger.log_error(str(e))
            final_response = f"An error occurred: {str(e)}"

        logger.log_pipeline_end(final_response, was_blocked=False)
        return {
            "output": final_response,
            "blocked": False,
            "blocked_at_layer": None,
            "audit_session": logger.session_id,
        }
