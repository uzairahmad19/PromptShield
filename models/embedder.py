"""
models/embedder.py
------------------
Shared Sentence Transformer wrapper used by ALL four PromptShield layers.

Why a shared wrapper?
  - Loads the model once into memory (expensive operation) and reuses it
  - All layers call the same interface: embed_one() or embed_batch()
  - Swapping embedding models only requires changing config.yaml
"""

from __future__ import annotations

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity as sklearn_cosine

import yaml
import os


def load_config() -> dict:
    config_path = os.path.join(os.path.dirname(__file__), "..", "config.yaml")
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


class Embedder:
    """
    Wraps SentenceTransformer to provide:
      - embed_one(text)        → np.ndarray of shape (dim,)
      - embed_batch(texts)     → np.ndarray of shape (n, dim)
      - cosine_similarity(a,b) → float in [-1, 1]
    """

    _instance: "Embedder | None" = None  # Singleton pattern

    def __init__(self, model_name: str | None = None, device: str | None = None):
        config = load_config()
        emb_cfg = config["embedder"]

        self.model_name = model_name or emb_cfg["model_name"]
        self.device = device or emb_cfg.get("device", "cpu")

        print(f"[Embedder] Loading model '{self.model_name}' on {self.device} ...")
        self.model = SentenceTransformer(self.model_name, device=self.device)
        print(f"[Embedder] Ready. Embedding dim: {self.model.get_sentence_embedding_dimension()}")

    @classmethod
    def get_instance(cls) -> "Embedder":
        """Singleton: return the shared instance, creating it on first call."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def embed_one(self, text: str) -> np.ndarray:
        """
        Embed a single string.
        Returns a 1-D numpy array of shape (embedding_dim,).
        Normalized to unit length (required for cosine similarity via dot product).
        """
        vec = self.model.encode(
            text,
            normalize_embeddings=True,   # L2-normalize → dot product == cosine similarity
            show_progress_bar=False,
        )
        return vec  # shape: (dim,)

    def embed_batch(self, texts: list[str]) -> np.ndarray:
        """
        Embed a list of strings efficiently using batching.
        Returns a 2-D numpy array of shape (n, embedding_dim).
        """
        vecs = self.model.encode(
            texts,
            normalize_embeddings=True,
            batch_size=32,
            show_progress_bar=len(texts) > 50,
        )
        return vecs  # shape: (n, dim)

    def cosine_similarity(self, vec_a: np.ndarray, vec_b: np.ndarray) -> float:
        """
        Compute cosine similarity between two embedding vectors.
        Both vectors must already be L2-normalized (which embed_one/embed_batch ensure).
        In that case: cosine_sim = dot(a, b)

        Returns a float in [-1.0, 1.0].
          1.0  = identical meaning
          0.0  = unrelated
         -1.0  = opposite meaning
        """
        # If already normalized: dot product == cosine similarity
        sim = float(np.dot(vec_a, vec_b))
        return sim

    def cosine_similarity_matrix(
        self, query_vec: np.ndarray, corpus_vecs: np.ndarray
    ) -> np.ndarray:
        """
        Compute cosine similarity between one query vector and a matrix of corpus vectors.
        Used in FAISS-free similarity search over small corpora.

        Args:
            query_vec:   shape (dim,)
            corpus_vecs: shape (n, dim)

        Returns:
            similarities: shape (n,) — one score per corpus entry
        """
        # query_vec reshaped to (1, dim) for sklearn's cosine_similarity
        sims = sklearn_cosine(query_vec.reshape(1, -1), corpus_vecs)[0]
        return sims  # shape: (n,)

    @property
    def embedding_dim(self) -> int:
        return self.model.get_sentence_embedding_dimension()
