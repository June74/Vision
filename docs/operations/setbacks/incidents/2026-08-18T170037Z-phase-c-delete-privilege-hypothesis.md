# SB-20260818-170037 — Phase C DELETE privilege hypothesis

- Status: contained
- Detected at: 2026-08-18T17:00:37Z
- Scope: Phase C disposable-target privilege acceptance

## What happened

The attached PostgreSQL ACL showed a direct `vision_app=arwd` grant on each Phase C table. The initial review treated `DELETE` as broader than the application needed because it inspected repository call sites without first comparing the established privilege policy.

## Impact

No privilege was revoked or granted, and no database or provider state changed. The ACL is consistent with the repository's authoritative Phase B privilege manifest, which expects `vision_app` to have DELETE, INSERT, SELECT, and UPDATE on the existing application tables.

## Root cause

The first comparison used operation-specific repository behavior instead of the project's canonical application-role privilege contract.

## Corrective action

The Phase C ACL is accepted as direct ownership-role DML access: SELECT, INSERT, UPDATE, and DELETE, with no TRUNCATE, REFERENCES, or TRIGGER flags shown. No hardening SQL is required for this acceptance boundary.

## Next step

Record the privilege attestation as passed and continue to preview deployment and authenticated private-pilot acceptance.
