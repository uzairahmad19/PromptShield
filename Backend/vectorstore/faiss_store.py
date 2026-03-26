from __future__ import annotations
import os
import pickle
from pathlib import Path

import faiss
import numpy as np


class FAISSStore:
    def __init__(self, dim: int):
        self.dim = dim
        self.index: faiss.Index | None = None
        self.metadata: list[dict] = []

    def build(self, vectors: np.ndarray, metadata: list[dict], use_ivf: bool | None = None):
        assert vectors.ndim == 2 and vectors.shape[1] == self.dim
        vectors = vectors.astype(np.float32)
        n = len(vectors)

        if use_ivf is None:
            use_ivf = n >= 50_000

        if use_ivf:
            nlist = min(max(1, int(np.sqrt(n))), n)
            q = faiss.IndexFlatIP(self.dim)
            self.index = faiss.IndexIVFFlat(q, self.dim, nlist, faiss.METRIC_INNER_PRODUCT)
            print(f"[FAISS] training IVF index (n={n}, nlist={nlist})")
            self.index.train(vectors)
        else:
            self.index = faiss.IndexFlatIP(self.dim)
            print(f"[FAISS] building flat index (n={n})")

        self.index.add(vectors)
        self.metadata = metadata
        print(f"[FAISS] done — {self.index.ntotal} vectors")

    def add_item(self, vector: np.ndarray, metadata: dict):
        """Dynamically adds a single vector and its metadata to the index."""
        assert self.index is not None, "call build() or load() first"
        
        # Ensure the vector is correctly shaped (1, dim) and typed
        if vector.ndim == 1:
            vector = vector.reshape(1, -1)
        assert vector.shape[1] == self.dim, f"expected dim {self.dim}, got {vector.shape[1]}"
        vector = vector.astype(np.float32)

        # Add to FAISS index and local metadata
        self.index.add(vector)
        self.metadata.append(metadata)
        print(f"[FAISS] added 1 dynamic vector, total is now {self.index.ntotal}")

    def search(self, q: np.ndarray, top_k: int = 5) -> tuple[np.ndarray, list[dict]]:
        assert self.index is not None, "call build() or load() first"
        q = q.astype(np.float32).reshape(1, -1)

        if hasattr(self.index, "nprobe"):
            self.index.nprobe = min(10, self.index.nlist)

        scores, idxs = self.index.search(q, top_k)
        scores, idxs = scores[0], idxs[0]

        valid = [(s, i) for s, i in zip(scores, idxs) if i != -1]
        if not valid:
            return np.array([]), []

        return np.array([s for s, _ in valid]), [self.metadata[i] for _, i in valid]

    def max_similarity(self, q: np.ndarray) -> float:
        scores, _ = self.search(q, top_k=1)
        return float(scores[0]) if len(scores) else 0.0

    def save(self, path: str):
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        faiss.write_index(self.index, str(p.with_suffix(".index")))
        with open(p.with_suffix(".meta"), "wb") as f:
            pickle.dump({"metadata": self.metadata, "dim": self.dim}, f)
        print(f"[FAISS] saved → {p.with_suffix('.index')}")

    @classmethod
    def load(cls, path: str) -> "FAISSStore":
        p = Path(path).with_suffix("")
        if not p.with_suffix(".index").exists():
            raise FileNotFoundError(f"no index at {p.with_suffix('.index')}")

        with open(p.with_suffix(".meta"), "rb") as f:
            saved = pickle.load(f)

        store = cls(dim=saved["dim"])
        store.index = faiss.read_index(str(p.with_suffix(".index")))
        store.metadata = saved["metadata"]
        print(f"[FAISS] loaded {store.index.ntotal} vectors, dim={store.dim}")
        return store

    @classmethod
    def exists(cls, path: str) -> bool:
        p = Path(path).with_suffix("")
        return p.with_suffix(".index").exists() and p.with_suffix(".meta").exists()

    def __len__(self): return self.index.ntotal if self.index else 0
    def __repr__(self): return f"FAISSStore(n={len(self)}, dim={self.dim})"
