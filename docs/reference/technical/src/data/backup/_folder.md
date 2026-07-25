# `src/data/backup`

Separates portable format logic from later Neon and R2 adapters. Export accepts one already-consistent snapshot;
restore validates the complete object locally, then uses a target-owned transaction for staging, inspection, and
promotion. This keeps Task 1 deterministic while Task 2 supplies scheduled storage and operator adapters.
