# PromptShield — Bug Fix Changelog

## Files Changed

### `api/app.py` *(3 fixes)*
- **`need()` missing `return None`** — The validation helper never returned `None`
  on success, so every route's `if e: return e` guard was dead code. Missing
  required fields were silently ignored, crashing deeper in the stack instead of
  returning a clean 400 error.
- **Thread-unsafe singletons** — `_pipeline`, `_l1`…`_l4` had no locks. Under
  concurrent load two threads could race to initialise the same singleton.
  Fixed with double-checked `threading.Lock()` on each.
- **Errors silently swallowed** — `except Exception as ex: return err(str(ex), 500)`
  discarded the full traceback. Added `logger.error(traceback.format_exc())`.

### `main.py` *(1 fix)*
- **`.env` never loaded** — `load_dotenv()` was never called, so values in `.env`
  like `OLLAMA_BASE_URL` were always ignored. Fixed by calling `load_dotenv()` at
  startup. Also now respects `OLLAMA_BASE_URL` env override in `check_ollama()`.

### `config.yaml` *(1 fix)*
- **Wrong `policy_embeddings_file` extension** — value was
  `policy_embeddings.pkl` but FAISS stores are saved as `.index`/`.meta`.
  `FAISSStore.load()` strips the extension itself, so the correct value is the
  base path `data/attack_embeddings/policy_embeddings` (no extension).

### `requirements.txt` *(1 fix)*
- **Non-existent package `ddgs>=9.0.0`** — this package name doesn't exist on
  PyPI. The correct package is `duckduckgo-search>=6.0.0`.

### `agent/react_agent.py` *(1 fix)*
- **`AgentExecutor` rebuilt on every query** — `build_agent()` was called inside
  `run_agent()` with no caching, reconnecting to Ollama from scratch every time.
  Fixed with a thread-safe cached singleton (double-checked lock).

### `pipeline/audit_logger.py` *(1 fix)*
- **`risk_score=0.0` treated as falsy** — `if risk_score` evaluates `0.0` as
  `False`, causing `round(None, 4)` to be called (TypeError) and logging `null`
  instead of `0.0`. Fixed with `if risk_score is not None`.

---

## Setup (correct order)

```bash
# 1. Create and activate virtual environment
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Download spaCy model  ← REQUIRED, not automatic
python -m spacy download en_core_web_sm

# 4. Copy and edit .env
cp .env.example .env
# Edit .env if Ollama runs on a different host/port

# 5. Start Ollama  (in a separate terminal)
ollama serve
ollama pull llama3.2

# 6. Build FAISS vector stores  ← REQUIRED before first run
python vectorstore/build_stores.py

# 7a. Run the CLI demo
python main.py --demo benign
python main.py --demo attack_direct

# 7b. OR run the Flask API
python api/app.py
# Then: curl -X POST http://localhost:5000/check \
#            -H "Content-Type: application/json" \
#            -d '{"query": "Ignore all previous instructions"}'
```
