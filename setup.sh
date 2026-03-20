#!/usr/bin/env bash
set -e

echo "=== PromptShield Setup ==="

# 1. Install Python dependencies
echo "[1/4] Installing Python dependencies..."
pip install -r requirements.txt

# 2. Download spaCy model (required for NER/PII detection in Layer 4)
echo "[2/4] Downloading spaCy model (en_core_web_sm)..."
python -m spacy download en_core_web_sm

# 3. Copy .env.example to .env if not already present
if [ ! -f .env ]; then
    echo "[3/4] Creating .env from .env.example..."
    cp .env.example .env
    echo "      Edit .env if your Ollama runs on a different host/port."
else
    echo "[3/4] .env already exists, skipping."
fi

# 4. Build FAISS vector stores (seed-only, no dataset download needed)
echo "[4/4] Building vector stores (seed attacks + policies)..."
python vectorstore/build_stores.py --max-samples 0

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "  1. Start Ollama:       ollama serve"
echo "  2. Pull the LLM:       ollama pull llama3.2"
echo "  3. Run demo:           python main.py --demo benign"
echo "  4. Run API server:     python api/app.py"
echo ""
