"""
pipeline/sieve.py
------------------
PromptShield Pipeline Orchestrator.

Chains all 4 layers together. Layers 1 and 2 are now active.
Layers 3 and 4 will be activated as they are built.

Flow:
    User Input
        → Layer 1: IntentClassifier        → BLOCK or continue
        → Layer 2: PolicyChecker           → BLOCK or continue
        → Agent runs (tool outputs collected)
        → Layer 3: ContextIntegrityChecker → SANITIZE or continue  [coming]
        → LLM generates response
        → Layer 4: ResponseAuditor         → REDACT/FLAG or deliver [coming]
        → Return safe response + audit log
"""

from __future__ import annotations
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pipeline.audit_logger import AuditLogger, BLOCK, PASS

BLOCK_MESSAGES = {
    1: (
        "I'm unable to process this request. It appears to contain patterns "
        "associated with prompt injection or adversarial intent."
    ),
    2: (
        "This request cannot be processed because it appears to violate "
        "one or more of the system's security policies."
    ),
    3: (
        "A tool response contained potentially injected instructions and has "
        "been blocked to protect the integrity of this session."
    ),
    4: (
        "The generated response was flagged by the safety auditor and has "
        "been withheld. Please rephrase your request."
    ),
}


class PromptShieldPipeline:
    """
    PromptShield Pipeline — orchestrates all 4 guardrail layers.

    Active layers:   1 (Intent Classifier), 2 (Policy Checker)
    Pending layers:  3 (Context Integrity), 4 (Response Auditor)
    """

    def __init__(self, verbose: bool = True, use_nli: bool = True):
        self.verbose = verbose
        self.use_nli = use_nli
        self._layer1 = None
        self._layer2 = None
        self._layer3 = None
        self._layer4 = None

    def _get_layer1(self):
        if self._layer1 is None:
            from layers.layer1_intent import IntentClassifier
            self._layer1 = IntentClassifier(use_nli=self.use_nli)
        return self._layer1

    def _get_layer2(self):
        if self._layer2 is None:
            from layers.layer2_policy import PolicyChecker
            self._layer2 = PolicyChecker()
        return self._layer2

    def run(self, user_input: str) -> dict:
        """
        Run a user input through the full PromptShield pipeline.

        Returns:
            {
                "output":           str       — final response or block message
                "blocked":          bool      — was the request blocked?
                "blocked_at_layer": int|None  — which layer blocked it
                "audit_session":    str       — session ID for audit log lookup
                "layer_results":    dict      — per-layer scores and decisions
            }
        """
        logger = AuditLogger()
        logger.log_pipeline_start(user_input)
        layer_results = {}

        # Layer 1: Intent Classifier
        l1 = self._get_layer1()
        l1_result = l1.check(user_input)

        layer_results["layer1"] = {
            "decision":    l1_result.decision,
            "risk_score":  round(l1_result.risk_score, 4),
            "faiss_score": round(l1_result.faiss_score, 4),
            "nli_score":   round(l1_result.nli_score, 4),
            "reason":      l1_result.reason,
        }

        logger.log_layer_decision(
            layer=1,
            decision=l1_result.decision,
            reason=l1_result.reason,
            risk_score=l1_result.risk_score,
            metadata={
                "faiss_score":      l1_result.faiss_score,
                "nli_score":        l1_result.nli_score,
                "top_attack_label": l1_result.top_attack_label,
                "top_attack_match": l1_result.top_attack_match[:60],
            },
        )

        if l1_result.is_blocked:
            msg = BLOCK_MESSAGES[1]
            logger.log_pipeline_end(msg, was_blocked=True)
            return self._blocked_response(msg, 1, logger.session_id, layer_results)

        # Layer 2: Semantic Policy Check
        l2 = self._get_layer2()
        l2_result = l2.check(user_input)

        layer_results["layer2"] = {
            "decision":          l2_result.decision,
            "violation_score":   round(l2_result.violation_score, 4),
            "violated_policy":   l2_result.violated_policy_id,
            "violated_severity": l2_result.violated_policy_severity,
            "reason":            l2_result.reason,
        }

        logger.log_layer_decision(
            layer=2,
            decision=l2_result.decision,
            reason=l2_result.reason,
            risk_score=l2_result.violation_score,
            metadata={
                "violated_policy_id":       l2_result.violated_policy_id,
                "violated_policy_name":     l2_result.violated_policy_name,
                "violated_policy_severity": l2_result.violated_policy_severity,
                "closest_example":          l2_result.closest_violation_example[:60],
            },
        )

        if l2_result.is_blocked:
            msg = BLOCK_MESSAGES[2]
            logger.log_pipeline_end(msg, was_blocked=True)
            return self._blocked_response(msg, 2, logger.session_id, layer_results)

        # Layer 3 placeholder: tool output inspection (coming in next session)

        # Run Agent
        try:
            from agent.react_agent import run_agent
            agent_result = run_agent(user_input, verbose=self.verbose)
            final_response = agent_result.get("output", "No response generated.")
            intermediate_steps = agent_result.get("intermediate_steps", [])

            for action, observation in intermediate_steps:
                logger.log_tool_call(
                    tool_name=action.tool,
                    tool_input=str(action.tool_input),
                    tool_output=str(observation),
                )

        except Exception as e:
            logger.log_error(str(e))
            final_response = f"An error occurred while processing your request: {str(e)}"

        # Layer 4 placeholder: response auditor (coming in next session)

        logger.log_pipeline_end(final_response, was_blocked=False)

        return {
            "output":           final_response,
            "blocked":          False,
            "blocked_at_layer": None,
            "audit_session":    logger.session_id,
            "layer_results":    layer_results,
        }

    def check_only(self, user_input: str) -> dict:
        """Run only Layers 1 + 2 without executing the agent. For testing."""
        layer_results = {}

        l1_result = self._get_layer1().check(user_input)
        layer_results["layer1"] = {
            "decision": l1_result.decision,
            "risk_score": round(l1_result.risk_score, 4),
            "reason": l1_result.reason,
        }
        if l1_result.is_blocked:
            return {"blocked": True, "blocked_at_layer": 1, "layer_results": layer_results}

        l2_result = self._get_layer2().check(user_input)
        layer_results["layer2"] = {
            "decision": l2_result.decision,
            "violation_score": round(l2_result.violation_score, 4),
            "reason": l2_result.reason,
        }
        if l2_result.is_blocked:
            return {"blocked": True, "blocked_at_layer": 2, "layer_results": layer_results}

        return {"blocked": False, "blocked_at_layer": None, "layer_results": layer_results}

    @staticmethod
    def _blocked_response(message, layer, session_id, layer_results):
        return {
            "output":           message,
            "blocked":          True,
            "blocked_at_layer": layer,
            "audit_session":    session_id,
            "layer_results":    layer_results,
        }
