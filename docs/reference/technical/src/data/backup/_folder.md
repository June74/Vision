# `src/data/backup`

Separates portable format logic from the concrete Neon and R2 adapters. Export accepts one already-consistent
repeatable-read snapshot; restore validates the complete object locally, then uses a target-owned serializable
transaction for locking, staging, inspection, and promotion.
