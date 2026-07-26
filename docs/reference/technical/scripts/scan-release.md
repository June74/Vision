# Release security scanner

`scripts/scan-release.ts` is the deterministic local release boundary for Phase B privacy and read-only guarantees.

It recursively reads bounded regular files from the built client and five required evidence surfaces. It rejects plain, URI-encoded, fully percent-encoded, base64, and base64url forms of the protected sentinel. Client assets are separately checked for a closed list of server-only binding names.

Google provider inspection is allowlist-based. Provider endpoints are accepted only in the three reviewed adapter files and only when their literal endpoint family is approved for OAuth, calendar setup, event reads/watch, or channel stop. SDK event mutation methods and non-watch event HTTP mutations are rejected. Worker route declarations are parsed from literal Hono route calls; event reads and the Vision-only category-correction route are allowed, while create/update/move/cancel/delete event routes are rejected.

The command emits only pass/fail plus violation category and repository-relative path. Content, tokens, identifiers, and matched values are never printed.

## `scanRelease`

Resolves a project root, validates required evidence directories, bounds each input to 16 MiB, rejects symbolic links, scans protected encodings and client secret-binding names, evaluates the Google call allowlist and Worker route manifest, sorts safe violations deterministically, and returns them without exposing matched content.
