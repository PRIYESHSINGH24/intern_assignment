"""
Duplicate Detection Service
Implements exact and near-duplicate detection using SHA-256 and SimHash.
"""

import hashlib
import logging
import re
from typing import Optional, Tuple, List

logger = logging.getLogger(__name__)


class DuplicateDetector:
    """
    Detects exact and near-duplicate documents.
    
    Exact duplicates: Same SHA-256 hash (byte-identical files)
    Near-duplicates: SimHash hamming distance within threshold (similar content)
    """

    def __init__(self, hamming_threshold: int = 3):
        self.hamming_threshold = hamming_threshold

    def compute_file_hash(self, file_path: str) -> str:
        """Compute SHA-256 hash of a file for exact duplicate detection."""
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()

    def compute_simhash(self, text: str) -> int:
        """
        Compute SimHash of text content for near-duplicate detection.
        Uses a simple but effective implementation based on character n-grams.
        """
        if not text or len(text.strip()) < 10:
            return 0

        # Normalize text
        text = text.lower()
        text = re.sub(r"[^\w\s]", "", text)
        text = re.sub(r"\s+", " ", text).strip()

        # Generate shingles (3-word n-grams)
        words = text.split()
        if len(words) < 3:
            return hash(text) & ((1 << 64) - 1)

        shingles = []
        for i in range(len(words) - 2):
            shingle = " ".join(words[i:i + 3])
            shingles.append(shingle)

        # Compute SimHash
        hash_bits = 64
        v = [0] * hash_bits

        for shingle in shingles:
            h = int(hashlib.md5(shingle.encode("utf-8")).hexdigest(), 16)
            for i in range(hash_bits):
                if h & (1 << i):
                    v[i] += 1
                else:
                    v[i] -= 1

        simhash = 0
        for i in range(hash_bits):
            if v[i] > 0:
                simhash |= (1 << i)

        return simhash

    def hamming_distance(self, hash1: int, hash2: int) -> int:
        """Compute hamming distance between two SimHash values."""
        xor = hash1 ^ hash2
        distance = 0
        while xor:
            distance += 1
            xor &= xor - 1  # Clear least significant bit
        return distance

    def check_exact_duplicate(self, file_hash: str, existing_hashes: dict) -> Optional[str]:
        """
        Check if file is an exact duplicate.
        Returns the document_id of the original if duplicate, None otherwise.
        
        Args:
            file_hash: SHA-256 hash of the file
            existing_hashes: Dict of {hash: document_id} for existing documents
        """
        return existing_hashes.get(file_hash)

    def check_near_duplicate(
        self, simhash: int, existing_simhashes: dict
    ) -> Optional[Tuple[str, float]]:
        """
        Check if document content is a near-duplicate of existing content.
        Returns (document_id, similarity_score) if near-duplicate found, None otherwise.
        
        Args:
            simhash: SimHash value of the document text
            existing_simhashes: Dict of {simhash_value: document_id}
        """
        if simhash == 0:
            return None

        best_match = None
        best_distance = float("inf")

        for existing_hash, doc_id in existing_simhashes.items():
            if existing_hash == 0:
                continue
            distance = self.hamming_distance(simhash, existing_hash)
            if distance <= self.hamming_threshold and distance < best_distance:
                best_distance = distance
                # Convert hamming distance to similarity score (0-1)
                similarity = 1.0 - (distance / 64.0)
                best_match = (doc_id, similarity)

        return best_match

    def find_duplicates_batch(
        self,
        documents: List[dict],
        existing_hashes: dict,
        existing_simhashes: dict
    ) -> dict:
        """
        Batch duplicate detection for multiple documents.
        
        Returns dict of {doc_id: {"type": "exact"|"near", "original_id": str, "similarity": float}}
        """
        duplicates = {}

        for doc in documents:
            doc_id = doc["id"]
            file_hash = doc.get("file_hash")
            simhash = doc.get("simhash")

            # Check exact duplicate first
            if file_hash:
                exact_match = self.check_exact_duplicate(file_hash, existing_hashes)
                if exact_match:
                    duplicates[doc_id] = {
                        "type": "exact",
                        "original_id": exact_match,
                        "similarity": 1.0
                    }
                    continue
                # Add to existing hashes for subsequent checks
                existing_hashes[file_hash] = doc_id

            # Check near-duplicate
            if simhash:
                near_match = self.check_near_duplicate(simhash, existing_simhashes)
                if near_match:
                    duplicates[doc_id] = {
                        "type": "near",
                        "original_id": near_match[0],
                        "similarity": near_match[1]
                    }
                    continue
                # Add to existing simhashes for subsequent checks
                existing_simhashes[simhash] = doc_id

        return duplicates


# Singleton instance
duplicate_detector = DuplicateDetector()
