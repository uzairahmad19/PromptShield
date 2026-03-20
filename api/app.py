import logging
import os
import sys
import threading
import time
import traceback

from flask import Flask, jsonify, request
from flask_cors import CORS

# Load .env file if present (fixes: dotenv values like OLLAMA_BASE_URL were silently ignored)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except ImportError:
    pass

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

app = Flask(__name__)
CORS(app)

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("promptshield.api")


def _warmup_nli():
    """
    Load the NLI model (facebook/bart-large-mnli, ~1.6 GB) in a background
    thread at startup so the first real request doesn't pay the load penalty.
    NLI was previously disabled everywhere (use_nli=False), which caused
    nli_score to always be 0 and risk to be computed from FAISS alone.
    """
    try:
        logger.info("NLI warmup: loading bart-large-mnli in background...")
        from models.classifier import ZeroShotClassifier
        ZeroShotClassifier.get_instance()
        logger.info("NLI warmup: ready.")
    except Exception as e:
        logger.warning("NLI warmup failed (NLI will be skipped): %s", e)

threading.Thread(target=_warmup_nli, daemon=True).start()

# Thread-safe lazy-init locks (fixes: race condition when multiple requests
# arrive before a singleton is initialised under concurrent load)
_pipeline = _l1 = _l2 = _l3 = _l4 = None
_lock_pipeline = threading.Lock()
_lock_l1 = threading.Lock()
_lock_l2 = threading.Lock()
_lock_l3 = threading.Lock()
_lock_l4 = threading.Lock()


def pipeline():
    global _pipeline
    if not _pipeline:
        with _lock_pipeline:
            if not _pipeline:
                from pipeline.sieve import PromptShieldPipeline
                _pipeline = PromptShieldPipeline(verbose=False, use_nli=True)
    return _pipeline

def l1():
    global _l1
    if not _l1:
        with _lock_l1:
            if not _l1:
                from layers.layer1_intent import IntentClassifier
                _l1 = IntentClassifier(use_nli=True)
    return _l1

def l2():
    global _l2
    if not _l2:
        with _lock_l2:
            if not _l2:
                from layers.layer2_policy import PolicyChecker
                _l2 = PolicyChecker()
    return _l2

def l3():
    global _l3
    if not _l3:
        with _lock_l3:
            if not _l3:
                from layers.layer3_context import ContextIntegrityChecker
                _l3 = ContextIntegrityChecker()
    return _l3

def l4():
    global _l4
    if not _l4:
        with _lock_l4:
            if not _l4:
                from layers.layer4_auditor import ResponseAuditor
                _l4 = ResponseAuditor()
    return _l4


def ok(data, elapsed=None):
    if elapsed is not None:
        data["elapsed_seconds"] = round(elapsed, 3)
    return jsonify({"success": True, "data": data})

def err(msg, code=400):
    return jsonify({"success": False, "error": msg}), code

def need(data, field):
    # FIX: was missing `return None`, so callers' `if e: return e` never fired
    if not data or field not in data or not str(data[field]).strip():
        return err(f"missing field: '{field}'")
    return None


@app.route("/health")
def health():
    return ok({"status": "ok"})


@app.route("/status")
def status():
    return ok({
        "name": "PromptShield", "version": "1.0.0",
        "layers": {
            "1": "Intent Classifier (FAISS + NLI)",
            "2": "Semantic Policy Check",
            "3": "Context Integrity (indirect injection)",
            "4": "Response Auditor (PII + toxicity + leak)",
        }
    })


@app.route("/analyze", methods=["POST"])
def analyze():
    d = request.get_json()
    e = need(d, "query")
    if e: return e
    t = time.time()
    try:
        return ok(pipeline().run(d["query"].strip()), time.time() - t)
    except Exception as ex:
        logger.error("Error in /analyze:\n%s", traceback.format_exc())
        return err(str(ex), 500)


@app.route("/check", methods=["POST"])
def check():
    d = request.get_json()
    e = need(d, "query")
    if e: return e
    t = time.time()
    try:
        return ok(pipeline().check_only(d["query"].strip()), time.time() - t)
    except Exception as ex:
        logger.error("Error in /check:\n%s", traceback.format_exc())
        return err(str(ex), 500)


@app.route("/layer1", methods=["POST"])
def layer1():
    d = request.get_json()
    e = need(d, "query")
    if e: return e
    t = time.time()
    r = l1().check(d["query"])
    return ok({"decision": r.decision, "risk_score": round(r.risk_score, 4),
               "faiss_score": round(r.faiss_score, 4), "nli_score": round(r.nli_score, 4),
               "top_attack_match": r.top_attack_match[:80], "top_attack_label": r.top_attack_label,
               "reason": r.reason, "top_k_matches": r.top_k_matches}, time.time() - t)


@app.route("/layer2", methods=["POST"])
def layer2():
    d = request.get_json()
    e = need(d, "query")
    if e: return e
    t = time.time()
    r = l2().check(d["query"])
    return ok({"decision": r.decision, "violation_score": round(r.violation_score, 4),
               "violated_policy_id": r.violated_policy_id, "violated_policy_name": r.violated_policy_name,
               "violated_policy_severity": r.violated_policy_severity,
               "closest_example": r.closest_violation_example[:80],
               "reason": r.reason, "all_policy_scores": r.all_policy_scores}, time.time() - t)


@app.route("/layer3", methods=["POST"])
def layer3():
    d = request.get_json()
    e = need(d, "tool_output")
    if e: return e
    t = time.time()
    r = l3().check(d["tool_output"], d.get("tool_name","unknown"), d.get("original_query",""))
    return ok({"decision": r.decision, "semantic_score": round(r.semantic_score, 4),
               "drift_score": round(r.intent_drift_score, 4),
               "structural_hits": r.structural_hits,
               "sanitized_output": r.sanitized_output[:300], "reason": r.reason}, time.time() - t)


@app.route("/layer4", methods=["POST"])
def layer4():
    d = request.get_json()
    e = need(d, "response")
    if e: return e
    t = time.time()
    r = l4().check(d["response"], d.get("original_query",""))
    return ok({"decision": r.decision,
               "pii_found": r.pii_result.found if r.pii_result else False,
               "pii_entities": r.pii_result.entities if r.pii_result else [],
               "leak_score": round(r.system_prompt_leak_score, 4),
               "fidelity_score": round(r.intent_fidelity_score, 4),
               "toxicity_score": round(r.toxicity_score, 4),
               "flags": r.flags, "final_response": r.final_response[:500],
               "was_modified": r.was_modified, "reason": r.reason}, time.time() - t)


if __name__ == "__main__":
    print("\n[PromptShield] Flask API on http://localhost:5000\n")
    app.run(host="0.0.0.0", port=5000, debug=False)