# `scripts/validate-production-crypto-boundary.ts`

This post-build contract is invoked by `pnpm build` after Vite emits `dist/vision`. `TEST_PROVIDER_BOUNDARY_MARKER` matches the guarded module's runtime marker without importing that module.

## `validateProductionCryptoBoundary`

**Signature:** `(projectRoot?: string, requireBundle?: boolean) => string[]`

Recursively scans `src`; every TypeScript file other than `src/crypto/test-key-provider.ts` fails if it references `test-key-provider`. When `dist/vision` exists, every bundle file is checked for the unique marker, `createTestKeyProvider`, and the module name. `requireBundle=true` also fails a missing Worker artifact.

## `collectFiles`

**Signature:** `(directory: string) => string[]`

Recursively returns ordinary paths beneath an existing directory and returns an empty list for a missing optional directory.

## `run`

**Signature:** `() => void`

Runs with the current project root and `requireBundle=true`, prints only file-relative constant violations, and sets a nonzero exit code. It reads no key material.
