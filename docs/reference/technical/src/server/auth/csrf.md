# CSRF verification

## `verifyCsrfToken`

Accepts only canonical 43-128 character base64url tokens. It hashes both candidate and expected values with SHA-256 and XORs every byte, so mismatch position does not create a direct early-exit timing signal.
