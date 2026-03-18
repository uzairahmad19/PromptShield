# PromptShield: Intent Verification for Agentic AI Pipelines

> A multi-layered semantic guardrail system that detects and neutralizes  
> both direct and indirect prompt injection attacks in agentic AI systems.

**B.Tech Final Year Major Project** | Jamia Hamdard, New Delhi  
**Student**: Uzair Ahmad | **Tech Stack**: Python, LangChain, Ollama, SentenceTransformers, FAISS

---

## What PromptShield Does

Modern agentic AI systems (like ReAct agents) are vulnerable to **prompt injection attacks** — attempts to hijack an AI agent's behavior by embedding malicious instructions in user input or in external data the agent retrieves.

PromptShield wraps a LangChain ReAct agent with **4 semantic defense layers**:

```
User Input → [Layer 1: Intent Classifier] → [Layer 2: Policy Check]
          → [Agent + Tools] → [Layer 3: Context Integrity] → [Layer 4: Response Auditor]
          → Safe Response
```

| Layer | Name | Guards Against |
|-------|------|----------------|
| 1 | Intent Classifier | Direct jailbreaks, role overrides, prompt extraction |
| 2 | Semantic Policy Check | Policy-violating requests in any paraphrase |
| 3 | Context Integrity Check | **Indirect injection** via tool outputs (web, files, DBs) |
| 4 | Response Auditor | PII leaks, system prompt exposure, hijacked responses |

---

## Quick Start

```bash
# 1. Clone and install
git clone <repo>
cd promptshield
pip install -r requirements.txt
python -m spacy download en_core_web_sm

# 2. Start Ollama
ollama serve
ollama pull llama3.2

# 3. Copy env template
cp .env.example .env

# 4. Run the agent (unguarded — tests Ollama connection)
python main.py --demo benign
python main.py --demo attack_direct   # See what gets through without guardrails

# 5. Build vector stores (required before running guarded pipeline)
python vectorstore/build_stores.py

# 6. Run the full guarded pipeline (after layers are built)
# python main.py --guarded --query "Your query here"
```

---

## Project Structure

```
promptshield/
├── main.py                    # Entry point
├── config.yaml                # All thresholds and model settings
├── agent/                     # LangChain ReAct agent + tools
├── layers/                    # The 4 guardrail layers
├── models/                    # Shared ML model wrappers
├── vectorstore/               # FAISS vector stores for fast similarity search
├── pipeline/                  # Orchestrator + audit logger + sanitizer
├── data/                      # Attack embeddings, policy rules, datasets
├── evaluation/                # Benchmarking against HackAPrompt + TensorTrust
└── api/                       # Flask REST API
```

---

## Evaluation Benchmarks

- **HackAPrompt** (`hackaprompt/hackaprompt-dataset`) — ~600K adversarial prompts
- **TensorTrust** (`tensortrust/tensortrust-data`) — ~126K attack/defense pairs

---

## Key Technologies

| Library | Role |
|---------|------|
| `langchain` + `langchain-ollama` | ReAct agent framework |
| `sentence-transformers` | Text → semantic embeddings (core of all 4 layers) |
| `faiss-cpu` | Fast nearest-neighbor search over attack embedding library |
| `transformers` (BART) | Zero-shot NLI for intent classification |
| `presidio-analyzer` | PII detection and redaction |
| `detoxify` | Toxicity classification |
| `spacy` | Named Entity Recognition |
