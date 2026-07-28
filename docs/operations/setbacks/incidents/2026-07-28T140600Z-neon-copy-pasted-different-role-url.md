# SB-20260728-140600-neon-copy-pasted-different-role-url: Neon Copy pasted a different-role URL

- **Status:** contained
- **First observed:** 2026-07-28T14:06:00Z
- **Last observed:** 2026-07-28T14:06:00Z
- **Phase/task:** Preview database role probe Task 2 final transfer test
- **Environment:** Signed-in Neon and Cloudflare browser controls
- **Version/commit:** Docs-only head `d077516`; immutable probe `e2d85ce`

## Symptom

After the exact expected application role was selected and the unique Neon Copy
control was activated once, a direct user-like paste into the blank Cloudflare
Secret value field produced a nonempty database URL of the expected length, but
its username did not encode the expected application role.

## Impact

The form was canceled before the secret name was entered or Deploy was clicked.
The exact temporary secret remains absent, and the role-probe observer,
deployment, database query, restore, R2, and key paths remain unstarted.

## Reproduction conditions and safe evidence

- Select the exact expected application role in the signed-in connection
  dialog.
- Activate its unique Copy control once.
- Paste user-like into the unique blank Worker Secret value field without
  reading either clipboard.
- Safe checks return: value present, valid database-URL shape, expected length
  bound, and expected-role encoding false.

## Cause classification

- **Confirmed cause:** The transferred database URL did not encode the expected
  application role.
- **Hypothesis:** The provider Copy action did not replace the system clipboard,
  so a stale or differently scoped database URL was pasted despite the selected
  role signal.
- **Rejected hypotheses:** Empty clipboard and non-database clipboard content;
  the safe shape and length checks passed.
- **Known exclusions:** The URL itself was never printed, returned, persisted,
  or recorded. No secret name, provider identifier, account identifier, token,
  key, or database row was exposed.

## Attempts and outcomes

1. One provider Copy action was activated.
2. One user-like paste was issued into the unique value field.
3. The expected-role gate failed.
4. The form was canceled, and fresh inventory remained zero exact Secret rows.

## Correction and prevention

- **Correction:** Stop browser UI save attempts and audit a truly opaque
  selected-role extraction or non-browser handoff architecture.
- **Prevention:** Require role encoding in the destination field before
  entering a secret name or deploying, even when the provider selector displays
  the expected role.
- **Owner:** Codex.
- **Next diagnostic step:** Complete the read-only Neon opaque-transfer and CI
  handoff architecture audits.

## Verification and related work

The ignored live report records zero Deploy clicks, zero exact temporary-secret
rows, and zero external provider mutations.
