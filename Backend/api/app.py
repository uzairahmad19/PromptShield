import logging
import os
import sys
import threading
import time
import traceback
import json as _json
from pathlib import Path as _Path

from flask import Flask, jsonify, request
from flask_cors import CORS

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

_LOG_FILE = _Path(__file__).resolve().parent.parent / "logs" / "promptshield_audit.jsonl"

# ── MongoDB helpers (lazy, optional) ─────────────────────────────────────────
def _mongo():
    try:
        from database.mongo import get_collection
        return get_collection()
    except Exception:
        return None

def _mongo_available():
    try:
        from database.mongo import is_available
        return is_available()
    except Exception:
        return False


def _warmup_nli():
    try:
        logger.info("NLI warmup: loading bart-large-mnli in background...")
        from models.classifier import ZeroShotClassifier
        ZeroShotClassifier.get_instance()
        logger.info("NLI warmup: ready.")
    except Exception as e:
        logger.warning("NLI warmup failed (NLI will be skipped): %s", e)

threading.Thread(target=_warmup_nli, daemon=True).start()

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
    if not data or field not in data or not str(data[field]).strip():
        return err(f"missing field: '{field}'")
    return None


# ── Core endpoints ────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    return ok({"status": "ok", "mongo": _mongo_available()})


@app.route("/status")
def status():
    return ok({
        "name": "PromptShield", "version": "1.0.0",
        "mongo": _mongo_available(),
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
    # Log to MongoDB so stats are accurate
    try:
        from pipeline.audit_logger import AuditLogger
        log = AuditLogger()
        log.log_pipeline_start(d["query"])
        log.log_layer_decision(1, r.decision, r.reason, r.risk_score,
                               {"faiss": r.faiss_score, "nli": r.nli_score, "label": r.top_attack_label})
        log.log_pipeline_end("layer1 only", r.decision == "BLOCK")
    except Exception as _le:
        logger.debug("audit log failed (non-fatal): %s", _le)
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
    # Log to MongoDB so stats are accurate
    try:
        from pipeline.audit_logger import AuditLogger
        log = AuditLogger()
        log.log_pipeline_start(d["query"])
        log.log_layer_decision(2, r.decision, r.reason, r.violation_score,
                               {"policy": r.violated_policy_id, "severity": r.violated_policy_severity})
        log.log_pipeline_end("layer2 only", r.decision == "BLOCK")
    except Exception as _le:
        logger.debug("audit log failed (non-fatal): %s", _le)
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
    # Log to MongoDB so stats are accurate
    try:
        from pipeline.audit_logger import AuditLogger
        log = AuditLogger()
        log.log_pipeline_start(d.get("original_query", d["tool_output"]))
        log.log_layer_decision(3, r.decision, r.reason, r.semantic_score,
                               {"tool": r.tool_name, "drift": r.intent_drift_score})
        log.log_pipeline_end("layer3 only", r.decision == "BLOCK")
    except Exception as _le:
        logger.debug("audit log failed (non-fatal): %s", _le)
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
    # Log to MongoDB so stats are accurate
    try:
        from pipeline.audit_logger import AuditLogger
        log = AuditLogger()
        log.log_pipeline_start(d.get("original_query", d["response"]))
        log.log_layer_decision(4, r.decision, r.reason, r.toxicity_score,
                               {"pii": r.pii_result.found if r.pii_result else False,
                                "leak": r.system_prompt_leak_score,
                                "fidelity": r.intent_fidelity_score})
        log.log_pipeline_end("layer4 only", r.decision == "BLOCK")
    except Exception as _le:
        logger.debug("audit log failed (non-fatal): %s", _le)
    return ok({"decision": r.decision,
               "pii_found": r.pii_result.found if r.pii_result else False,
               "pii_entities": r.pii_result.entities if r.pii_result else [],
               "leak_score": round(r.system_prompt_leak_score, 4),
               "fidelity_score": round(r.intent_fidelity_score, 4),
               "toxicity_score": round(r.toxicity_score, 4),
               "flags": r.flags, "final_response": r.final_response[:500],
               "was_modified": r.was_modified, "reason": r.reason}, time.time() - t)


# ── Log endpoints — MongoDB-primary with JSONL fallback ───────────────────────

def _read_jsonl(n=100, session=None):
    """JSONL fallback reader."""
    if not _LOG_FILE.exists():
        return []
    lines = _LOG_FILE.read_text(encoding="utf-8").splitlines()
    entries = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            obj = _json.loads(line)
        except Exception:
            continue
        if session and obj.get("session_id") != session:
            continue
        entries.append(obj)
    return entries[-n:]


@app.route("/logs")
def get_logs():
    """Return the last N log entries, optionally filtered by ?session=<id>."""
    n       = int(request.args.get("n", 100))
    session = request.args.get("session", None)
    event   = request.args.get("event", None)
    decision = request.args.get("decision", None)

    if _mongo_available():
        try:
            from database.mongo import get_logs as mongo_get_logs
            entries = mongo_get_logs(n=n, session_id=session, event=event, decision=decision)
            # Convert datetime objects to ISO strings for JSON serialisation
            for e in entries:
                if "ts" in e and hasattr(e["ts"], "isoformat"):
                    e["ts"] = e["ts"].isoformat()
            return ok({"entries": entries, "source": "mongodb"})
        except Exception as ex:
            logger.warning("MongoDB get_logs failed, falling back to JSONL: %s", ex)

    return ok({"entries": _read_jsonl(n, session), "source": "jsonl"})


@app.route("/logs/stats")
def logs_stats():
    """Return aggregated statistics. MongoDB only."""
    if not _mongo_available():
        return ok({"available": False, "message": "MongoDB not connected"})
    try:
        from database.mongo import get_stats
        stats = get_stats()
        # Convert any datetime values to strings
        for s in stats.get("recent_sessions", []):
            if "last_ts" in s and hasattr(s["last_ts"], "isoformat"):
                s["last_ts"] = s["last_ts"].isoformat()
        return ok(stats)
    except Exception as ex:
        return err(str(ex), 500)


@app.route("/logs", methods=["DELETE"])
def delete_logs():
    """Delete logs. ?session=<id> to delete one session, else all."""
    session = request.args.get("session", None)
    if _mongo_available():
        try:
            from database.mongo import delete_logs as mongo_del
            count = mongo_del(session_id=session)
            return ok({"deleted": count, "source": "mongodb"})
        except Exception as ex:
            return err(str(ex), 500)
    return ok({"deleted": 0, "message": "MongoDB not available"})

@app.route("/eval/results")
def eval_results():
    """Serves the evaluation metrics from the local JSON files."""
    import json
    
    results_dir = _Path(__file__).resolve().parent.parent / "evaluation" / "results"
    data = {}
    
    # Load individual layers
    for layer in [1, 2, 3, 4]:
        file_path = results_dir / f"layer{layer}_results.json"
        if file_path.exists():
            try:
                data[f"layer{layer}"] = json.loads(file_path.read_text(encoding="utf-8"))
            except Exception as e:
                logger.error("Failed to parse %s: %s", file_path.name, e)
                
    # Load full pipeline
    full_path = results_dir / "full_pipeline.json"
    if full_path.exists():
        try:
            data["full_pipeline"] = json.loads(full_path.read_text(encoding="utf-8"))
        except Exception as e:
            logger.error("Failed to parse full_pipeline.json: %s", e)
    
    if not data:
        return err("Evaluation results not found. Run the eval script first.", 404)
        
    return ok(data)

@app.route("/logs/stream")
def stream_logs():
    """
    Server-Sent Events: streams log entries.
    Prefers MongoDB (polls every 0.5s for new docs), falls back to JSONL tail.
    Filter with ?session=<id>.
    """
    import time as _time

    session  = request.args.get("session", None)
    use_mongo = _mongo_available()

    def generate_mongo():
        from database.mongo import get_collection
        from bson import ObjectId

        coll = get_collection()
        # Find the last _id already in the collection so we only tail new docs
        last = coll.find_one(sort=[("_id", -1)])
        last_id = last["_id"] if last else ObjectId("000000000000000000000000")

        # Replay recent entries for this session first (last 200)
        query = {}
        if session:
            query["session_id"] = session
        for doc in coll.find(query, {"_id": 0}).sort("ts", 1).limit(200):
            if "ts" in doc and hasattr(doc["ts"], "isoformat"):
                doc["ts"] = doc["ts"].isoformat()
            yield f"data: {_json.dumps(doc)}\n\n"

        # Tail indefinitely
        while True:
            tail_q = {"_id": {"$gt": last_id}}
            if session:
                tail_q["session_id"] = session
            cursor = coll.find(tail_q).sort("_id", 1)
            found = False
            for doc in cursor:
                last_id = doc["_id"]
                doc.pop("_id", None)
                if "ts" in doc and hasattr(doc["ts"], "isoformat"):
                    doc["ts"] = doc["ts"].isoformat()
                yield f"data: {_json.dumps(doc)}\n\n"
                found = True
            if not found:
                _time.sleep(0.5)
                yield ": ping\n\n"

    def generate_jsonl():
        if not _LOG_FILE.exists():
            _LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
            _LOG_FILE.touch()

        existing = _LOG_FILE.read_text(encoding="utf-8").splitlines()
        for line in existing:
            line = line.strip()
            if not line:
                continue
            try:
                obj = _json.loads(line)
            except Exception:
                continue
            if session and obj.get("session_id") != session:
                continue
            yield f"data: {_json.dumps(obj)}\n\n"

        with open(_LOG_FILE, "r", encoding="utf-8") as f:
            f.seek(0, 2)
            while True:
                line = f.readline()
                if not line:
                    _time.sleep(0.15)
                    yield ": ping\n\n"
                    continue
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = _json.loads(line)
                except Exception:
                    continue
                if session and obj.get("session_id") != session:
                    continue
                yield f"data: {_json.dumps(obj)}\n\n"

    generator = generate_mongo if use_mongo else generate_jsonl

    return app.response_class(
        generator(),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    print("\n[PromptShield] Flask API on http://localhost:5000\n")
    app.run(host="0.0.0.0", port=5000, debug=False)
