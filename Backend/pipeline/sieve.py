from __future__ import annotations
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pipeline.audit_logger import AuditLogger, BLOCK, PASS

_BLOCK_MSG = {
    1: "Request blocked — detected adversarial intent.",
    2: "Request blocked — policy violation detected.",
    3: "Request blocked — injected content found in tool output.",
    4: "Response withheld — failed safety audit.",
}


class PromptShieldPipeline:
    def __init__(self, verbose: bool = True, use_nli: bool = True):
        self.verbose = verbose
        self.use_nli = use_nli
        self._l1 = self._l2 = self._l3 = self._l4 = None

    def _layer1(self):
        if not self._l1:
            from layers.layer1_intent import IntentClassifier
            self._l1 = IntentClassifier(use_nli=self.use_nli)
        return self._l1

    def _layer2(self):
        if not self._l2:
            from layers.layer2_policy import PolicyChecker
            self._l2 = PolicyChecker()
        return self._l2

    def _layer3(self):
        if not self._l3:
            from layers.layer3_context import ContextIntegrityChecker
            self._l3 = ContextIntegrityChecker()
        return self._l3

    def _layer4(self):
        if not self._l4:
            from layers.layer4_auditor import ResponseAuditor
            self._l4 = ResponseAuditor()
        return self._l4

    def run(self, query: str) -> dict:
        log = AuditLogger()
        log.log_pipeline_start(query)
        lr  = {}

        # L1
        r1 = self._layer1().check(query)
        lr["layer1"] = {"decision": r1.decision, "risk_score": round(r1.risk_score, 4),
                         "faiss_score": round(r1.faiss_score, 4), "nli_score": round(r1.nli_score, 4),
                         "reason": r1.reason}
        log.log_layer_decision(1, r1.decision, r1.reason, r1.risk_score,
                               {"faiss": r1.faiss_score, "nli": r1.nli_score, "label": r1.top_attack_label})
        if r1.is_blocked:
            log.log_pipeline_end(_BLOCK_MSG[1], True)
            return self._blocked(_BLOCK_MSG[1], 1, log.session_id, lr)

        # L2
        r2 = self._layer2().check(query)
        lr["layer2"] = {"decision": r2.decision, "violation_score": round(r2.violation_score, 4),
                         "violated_policy": r2.violated_policy_id, "severity": r2.violated_policy_severity,
                         "reason": r2.reason}
        log.log_layer_decision(2, r2.decision, r2.reason, r2.violation_score,
                               {"policy": r2.violated_policy_id, "severity": r2.violated_policy_severity})
        if r2.is_blocked:
            log.log_pipeline_end(_BLOCK_MSG[2], True)
            return self._blocked(_BLOCK_MSG[2], 2, log.session_id, lr)

        # agent
        try:
            from agent.react_agent import run_agent
            agent_out = run_agent(query, verbose=self.verbose)
            response  = agent_out.get("output", "")
            steps     = agent_out.get("intermediate_steps", [])
        except Exception as e:
            log.log_error(str(e))
            response, steps = f"Agent error: {e}", []

        # L3 — check each tool output
        l3  = self._layer3()
        l3_results = []
        blocked_l3 = False

        for action, obs in steps:
            r3 = l3.check(str(obs), action.tool, query)
            l3_results.append({"tool": r3.tool_name, "decision": r3.decision,
                                "semantic_score": round(r3.semantic_score, 4),
                                "drift_score": round(r3.intent_drift_score, 4),
                                "structural_hits": len(r3.structural_hits),
                                "reason": r3.reason[:80]})
            log.log_tool_call(action.tool, str(action.tool_input), str(obs))
            log.log_layer_decision(3, r3.decision, r3.reason, r3.semantic_score,
                                   {"tool": r3.tool_name, "drift": r3.intent_drift_score})
            if r3.is_blocked:
                blocked_l3 = True
                break

        lr["layer3"] = l3_results
        if blocked_l3:
            log.log_pipeline_end(_BLOCK_MSG[3], True)
            return self._blocked(_BLOCK_MSG[3], 3, log.session_id, lr)

        # L4
        r4 = self._layer4().check(response, query)
        lr["layer4"] = {"decision": r4.decision,
                         "pii_found": r4.pii_result.found if r4.pii_result else False,
                         "leak_score": round(r4.system_prompt_leak_score, 4),
                         "fidelity_score": round(r4.intent_fidelity_score, 4),
                         "toxicity_score": round(r4.toxicity_score, 4),
                         "flags": r4.flags, "reason": r4.reason}
        log.log_layer_decision(4, r4.decision, r4.reason, r4.toxicity_score,
                               {"pii": r4.pii_result.found if r4.pii_result else False,
                                "leak": r4.system_prompt_leak_score,
                                "fidelity": r4.intent_fidelity_score})
        if r4.is_blocked:
            log.log_pipeline_end(_BLOCK_MSG[4], True)
            return self._blocked(_BLOCK_MSG[4], 4, log.session_id, lr)

        final = r4.final_response
        log.log_pipeline_end(final, False)
        return {"output": final, "blocked": False, "blocked_at_layer": None,
                "audit_session": log.session_id, "layer_results": lr}

    def check_only(self, query: str) -> dict:
        lr = {}
        r1 = self._layer1().check(query)
        lr["layer1"] = {"decision": r1.decision, "risk_score": round(r1.risk_score, 4), "reason": r1.reason}
        if r1.is_blocked:
            return {"blocked": True, "blocked_at_layer": 1, "layer_results": lr}

        r2 = self._layer2().check(query)
        lr["layer2"] = {"decision": r2.decision, "violation_score": round(r2.violation_score, 4), "reason": r2.reason}
        if r2.is_blocked:
            return {"blocked": True, "blocked_at_layer": 2, "layer_results": lr}

        return {"blocked": False, "blocked_at_layer": None, "layer_results": lr}

    @staticmethod
    def _blocked(msg, layer, sid, lr):
        return {"output": msg, "blocked": True, "blocked_at_layer": layer,
                "audit_session": sid, "layer_results": lr}
