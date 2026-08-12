# SB-20260812-113513 — Markdown bullet diff marker error

- **Status:** contained
- **Detected:** 2026-08-12T11:35:13Z
- **Area:** Phase B maintenance observer diagnosis
- **Evidence:** A generated update hunk used one diff marker before Markdown bullet lines instead of preserving the bullet hyphen, so apply_patch could not match the existing incident.
- **Impact:** No repository or provider state changed.
- **Resolution:** Use double hyphens for removed Markdown bullet lines and plus-hyphen for replacements.
- **Prevention:** Account for the file's own list marker when constructing diff hunks.
