# PromptShield
**Intent Verification for Agentic AI Pipelines**

B.Tech Final Year Project — Jamia Hamdard  
Uzair Ahmad | Computer Science

---

## What it does

PromptShield wraps a LangChain ReAct agent (Ollama llama3.2) with four semantic guardrail layers that detect and block both direct and indirect prompt injection attacks.

```
User Input
  → Layer 1: Intent Classifier      (FAISS similarity + zero-shot NLI)
  → Layer 2: Semantic Policy Check  (policy violation embeddings)
  → Agent runs tools
  → Layer 3: Context Integrity      (indirect injection in tool outputs)
  → LLM generates response
  → Layer 4: Response Auditor       (PII, system prompt leak, toxicity)
  → Safe response
```

Layer 3 is the novel contribution — no existing guardrail system inspects tool outputs for indirect injection in real-time before the LLM sees them.

---

## Setup

**Requirements:** Python 3.11+, Java not needed, Ollama installed

```bash
# 1. install dependencies
pip install -r requirements.txt
python -m spacy download en_core_web_sm

# 2. pull the model
ollama pull llama3.2

# 3. build vector stores (downloads HackAPrompt + TensorTrust datasets)
python vectorstore/build_stores.py --max-samples 500   # fast dev build
# python vectorstore/build_stores.py                   # full build (~600k samples)
```

---

## Running

```bash
# terminal 1 — start Ollama
ollama serve

# terminal 2 — start Flask API
python api/app.py

# then open frontend/index.html in your browser
```

**CLI mode (no API needed):**
```bash
python main.py --demo benign
python main.py --demo attack_direct
python main.py --query "your query here"
```

---

## API

Flask runs on `http://localhost:5000`

| Endpoint | Body | Description |
|----------|------|-------------|
| `POST /check` | `{"query": "..."}` | Layers 1+2 only, fast (~200ms) |
| `POST /analyze` | `{"query": "..."}` | Full pipeline + agent (~30s) |
| `POST /layer1` | `{"query": "..."}` | Intent classifier only |
| `POST /layer2` | `{"query": "..."}` | Policy checker only |
| `POST /layer3` | `{"tool_output": "...", "tool_name": "...", "original_query": "..."}` | Tool output inspector |
| `POST /layer4` | `{"response": "...", "original_query": "..."}` | Response auditor |
| `GET /health` | — | Health check |

---

## Evaluation

```bash
python evaluation/eval_layer1.py --fast          # Layer 1 vs HackAPrompt
python evaluation/eval_layer2.py --show-boundary # Layer 2 policy tests
python evaluation/eval_layer3.py --show-sanitized # Layer 3 indirect injection
python evaluation/eval_layer4.py                 # Layer 4 PII/toxicity/leak
python evaluation/eval_full_pipeline.py          # end-to-end with layer contribution
```

Results saved to `evaluation/results/`

---

## Datasets

- **HackAPrompt** — `hackaprompt/hackaprompt-dataset` (~600k adversarial prompts)
- **TensorTrust** — `tensortrust/tensortrust-data` (~126k attack/defense pairs)

---

## Project structure

```
promptshield/
├── agent/          LangChain ReAct agent + tools
├── layers/         4 guardrail layers
├── models/         Embedder, NLI classifier, PII detector, toxicity model
├── vectorstore/    FAISS store + build script
├── pipeline/       Orchestrator (sieve.py) + audit logger
├── evaluation/     Benchmarking scripts
├── api/            Flask REST API
├── frontend/       Demo UI (index.html)
├── data/           Policy rules + attack embeddings
└── config.yaml     All thresholds and settings
```
