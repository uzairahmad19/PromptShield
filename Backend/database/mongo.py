"""
database/mongo.py
─────────────────
MongoDB connection manager for PromptShield.

Provides a lazy-initialised MongoClient singleton and helpers
to access the `audit_logs` collection.

Environment variables:
  MONGO_URI       MongoDB connection string  (default: mongodb://localhost:27017)
  MONGO_DB        Database name              (default: promptshield)
  MONGO_COLL      Collection name            (default: audit_logs)

Indexes created on first access:
  session_id      (for per-session queries)
  ts (descending) (for latest-N queries)
  event + decision (compound, for analytics)
"""

from __future__ import annotations

import logging
import os
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger("promptshield.db")

# ── configuration from environment ─────────────────────────────────────────
MONGO_URI  = os.getenv("MONGO_URI",  "mongodb://localhost:27017")
MONGO_DB   = os.getenv("MONGO_DB",   "promptshield")
MONGO_COLL = os.getenv("MONGO_COLL", "audit_logs")

_client   = None
_db       = None
_coll     = None
_lock     = threading.Lock()
_indexed  = False


def _ensure_indexes(coll) -> None:
    """Create indexes once per process lifetime."""
    global _indexed
    if _indexed:
        return
    try:
        from pymongo import ASCENDING, DESCENDING, IndexModel
        coll.create_indexes([
            IndexModel([("session_id", ASCENDING)]),
            IndexModel([("ts", DESCENDING)]),
            IndexModel([("event", ASCENDING), ("decision", ASCENDING)]),
        ])
        _indexed = True
        logger.info("MongoDB indexes ensured on '%s'", MONGO_COLL)
    except Exception as e:
        logger.warning("Could not create MongoDB indexes: %s", e)


def get_collection():
    """Return the audit_logs collection, creating the client on first call."""
    global _client, _db, _coll
    if _coll is not None:
        return _coll
    with _lock:
        if _coll is not None:
            return _coll
        try:
            from pymongo import MongoClient
            _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
            # Trigger connection check
            _client.admin.command("ping")
            _db   = _client[MONGO_DB]
            _coll = _db[MONGO_COLL]
            _ensure_indexes(_coll)
            logger.info("Connected to MongoDB: %s / %s / %s", MONGO_URI, MONGO_DB, MONGO_COLL)
        except Exception as e:
            logger.error("MongoDB connection failed: %s", e)
            raise
    return _coll


def is_available() -> bool:
    """Return True if MongoDB is reachable."""
    try:
        get_collection()
        return True
    except Exception:
        return False


# ── CRUD helpers ────────────────────────────────────────────────────────────

def insert_log(entry: Dict[str, Any]) -> Optional[str]:
    """
    Insert a single audit log entry.
    Returns the inserted _id as string, or None on failure.
    """
    try:
        coll = get_collection()
        # Ensure ts is a real datetime (not string) for proper Mongo sorting
        if "ts" in entry and isinstance(entry["ts"], str):
            entry = dict(entry)
            try:
                entry["ts"] = datetime.fromisoformat(entry["ts"])
            except ValueError:
                entry["ts"] = datetime.now(timezone.utc)
        elif "ts" not in entry:
            entry = dict(entry)
            entry["ts"] = datetime.now(timezone.utc)

        result = coll.insert_one(entry)
        return str(result.inserted_id)
    except Exception as e:
        logger.error("insert_log failed: %s", e)
        return None


def get_logs(
    n: int = 100,
    session_id: Optional[str] = None,
    event: Optional[str] = None,
    decision: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Return up to `n` log entries (most recent first).

    Filters:
      session_id  – restrict to one session
      event       – e.g. 'layer1', 'end'
      decision    – e.g. 'BLOCK', 'PASS'
    """
    coll = get_collection()
    query: Dict[str, Any] = {}
    if session_id:
        query["session_id"] = session_id
    if event:
        query["event"] = event
    if decision:
        query["decision"] = decision

    cursor = coll.find(query, {"_id": 0}).sort("ts", -1).limit(n)
    return list(reversed(list(cursor)))


def get_stats() -> Dict[str, Any]:
    """
    Return aggregated statistics for the audit log.

    Returns:
      total           – total number of log entries
      sessions        – distinct session count
      blocked         – entries with decision == 'BLOCK'
      passed          – entries with decision == 'PASS'
      block_rate      – float 0-1
      by_layer        – {1: {total, blocked}, 2: …, 3: …, 4: …}
      recent_sessions – last 10 session IDs with block flag
    """
    coll = get_collection()

    pipeline_overview = [
        {"$group": {
            "_id": "$session_id",
            "events": {"$sum": 1},
            "blocked": {"$sum": {"$cond": [{"$eq": ["$decision", "BLOCK"]}, 1, 0]}},
            "last_ts": {"$max": "$ts"},
        }},
        {"$sort": {"last_ts": -1}},
    ]

    sessions_cursor = list(coll.aggregate(pipeline_overview))
    total_sessions  = len(sessions_cursor)
    total_blocked   = sum(1 for s in sessions_cursor if s["blocked"] > 0)
    block_rate      = round(total_blocked / total_sessions, 4) if total_sessions else 0.0

    # per-layer stats — string keys so JSON matches frontend's by_layer[String(n)] lookup
    by_layer: Dict[str, Dict[str, int]] = {str(i): {"total": 0, "blocked": 0} for i in range(1, 5)}
    layer_cursor = coll.aggregate([
        {"$match": {"event": {"$in": ["layer1", "layer2", "layer3", "layer4"]}}},
        {"$group": {
            "_id": {"layer": "$layer", "decision": "$decision"},
            "count": {"$sum": 1},
        }},
    ])
    for doc in layer_cursor:
        layer = doc["_id"].get("layer")
        decision = doc["_id"].get("decision")
        key = str(layer) if layer is not None else None
        if key in by_layer:
            by_layer[key]["total"] += doc["count"]
            if decision == "BLOCK":
                by_layer[key]["blocked"] += doc["count"]

    total_entries = coll.count_documents({})

    recent_sessions = [
        {
            "session_id": s["_id"],
            "blocked": s["blocked"] > 0,
            "events": s["events"],
            "last_ts": s["last_ts"].isoformat() if isinstance(s["last_ts"], datetime) else s["last_ts"],
        }
        for s in sessions_cursor[:10]
    ]

    return {
        "total_entries":   total_entries,
        "total_sessions":  total_sessions,
        "blocked_sessions": total_blocked,
        "passed_sessions":  total_sessions - total_blocked,
        "block_rate":       block_rate,
        "by_layer":         by_layer,
        "recent_sessions":  recent_sessions,
    }


def delete_logs(session_id: Optional[str] = None) -> int:
    """
    Delete log entries.
    If session_id is given, delete only that session.
    Otherwise delete ALL entries. Returns count deleted.
    """
    coll = get_collection()
    query = {"session_id": session_id} if session_id else {}
    result = coll.delete_many(query)
    return result.deleted_count
