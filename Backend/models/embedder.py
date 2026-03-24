from __future__ import annotations
import os
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity as cos_sim
import yaml


def _cfg():
    p = os.path.join(os.path.dirname(__file__), "..", "config.yaml")
    with open(p) as f:
        return yaml.safe_load(f)


class Embedder:
    _instance: "Embedder | None" = None

    def __init__(self, model_name: str | None = None, device: str | None = None):
        c = _cfg()["embedder"]
        self.model_name = model_name or c["model_name"]
        self.device = device or c.get("device", "cpu")
        print(f"[Embedder] loading {self.model_name} on {self.device}")
        self.model = SentenceTransformer(self.model_name, device=self.device)
        print(f"[Embedder] ready (dim={self.model.get_sentence_embedding_dimension()})")

    @classmethod
    def get_instance(cls) -> "Embedder":
        if cls._instance is None:
            try:
                cls._instance = cls()
            except Exception as e:
                cls._instance = None  # don't cache a broken instance
                raise RuntimeError(f"[Embedder] failed to load model: {e}") from e
        return cls._instance

    def embed_one(self, text: str) -> np.ndarray:
        return self.model.encode(text, normalize_embeddings=True, show_progress_bar=False)

    def embed_batch(self, texts: list[str]) -> np.ndarray:
        return self.model.encode(
            texts, normalize_embeddings=True,
            batch_size=32, show_progress_bar=len(texts) > 50
        )

    def cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        # Vectors from embed_one/embed_batch are L2-normalised, so dot == cosine similarity.
        # Clip to [-1, 1] to guard against floating-point drift.
        return float(np.clip(np.dot(a, b), -1.0, 1.0))

    def cosine_similarity_matrix(self, q: np.ndarray, corpus: np.ndarray) -> np.ndarray:
        return cos_sim(q.reshape(1, -1), corpus)[0]

    @property
    def embedding_dim(self) -> int:
        return self.model.get_sentence_embedding_dimension()
