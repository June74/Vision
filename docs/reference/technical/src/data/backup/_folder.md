# `src/data/backup`

Separates portable format logic from the concrete Neon and R2 adapters. Export accepts one already-consistent
repeatable-read snapshot; restore validates the complete object locally, then uses target-owned serializable
transactions for the temporary fenced clear and the existing staging, inspection, and promotion path. The temporary
attempt namespace stays outside backup listing and retention.
