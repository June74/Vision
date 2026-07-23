# `scripts/validate-production-crypto-boundary.ts`

This script prevents Vision's Vitest-only key provider from reaching production.

## `validateProductionCryptoBoundary`

Checks that no other production source file references the test provider and scans a built Worker for its marker, factory name, or module name.

## `collectFiles`

Lists ordinary files below a source or bundle directory.

## `run`

Requires a real Worker bundle after `vite build`, prints safe violations, and fails the build when the test helper is present.
