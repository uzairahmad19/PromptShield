"""
api/schemas.py
---------------
Request/response schema documentation for the PromptShield Flask API.
No code — just reference for the frontend and any API consumers.

POST /check
  Request:  { "query": "string" }
  Response: { "success": true, "data": { "blocked": bool, "blocked_at_layer": int|null,
              "layer_results": { "layer1": {...}, "layer2": {...} },
              "elapsed_seconds": float } }

POST /analyze
  Request:  { "query": "string" }
  Response: { "success": true, "data": { "output": "string", "blocked": bool,
              "blocked_at_layer": int|null, "layer_results": {...},
              "audit_session": "string", "elapsed_seconds": float } }

POST /layer1
  Request:  { "query": "string" }
  Response: { "success": true, "data": { "decision": "BLOCK"|"PASS",
              "risk_score": float, "faiss_score": float, "nli_score": float,
              "top_attack_match": "string", "top_attack_label": "string",
              "reason": "string", "top_k_matches": [...] } }

POST /layer2
  Request:  { "query": "string" }
  Response: { "success": true, "data": { "decision": "BLOCK"|"PASS",
              "violation_score": float, "violated_policy_id": "string",
              "violated_policy_name": "string", "reason": "string" } }

POST /layer3
  Request:  { "tool_output": "string", "tool_name": "string", "original_query": "string" }
  Response: { "success": true, "data": { "decision": "PASS"|"SANITIZE"|"BLOCK"|"FLAG",
              "semantic_score": float, "drift_score": float,
              "structural_hits": [...], "sanitized_output": "string", "reason": "string" } }

POST /layer4
  Request:  { "response": "string", "original_query": "string" }
  Response: { "success": true, "data": { "decision": "PASS"|"REDACT"|"FLAG"|"BLOCK",
              "pii_found": bool, "pii_entities": [...], "leak_score": float,
              "fidelity_score": float, "toxicity_score": float,
              "flags": [...], "final_response": "string", "was_modified": bool } }
"""
