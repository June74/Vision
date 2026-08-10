# SB-20260803-041511-ai-gateway-evidence-contradicts-live-ui: Gateway evidence conflicted with an incomplete dashboard observation

- **Status:** closed
- **First observed:** 2026-08-03T04:15:11.0000000Z
- **Last observed:** 2026-08-03T05:01:10.4517843Z
- **Phase/task:** Phase B preview AI acceptance
- **Environment:** Tracked operational evidence and direct owner Cloudflare dashboard inspection
- **Version/commit:** Candidate `c1911f8`; candidate not deployed

## Symptom

The tracked cost review, credential ledger, and completion-evidence table said
that a `vision-preview` AI Gateway and its exact $9.50 rule had been verified.
The owner initially could not find that Gateway in the viewed dashboard
surface. A subsequent exact-name creation attempt was rejected because the
name already exists.

## Impact

Current Gateway identity and rule freshness are unresolved. The preview base
URL binding remains absent, so AI live acceptance cannot pass. The candidate
remained blocked and was not deployed; Cloudflare rejected the duplicate before
any creation occurred.

## Safe evidence

The owner first reported the Gateway as absent and then reported Cloudflare's
exact-name duplicate refusal. The historical incident records one creation and
a later read-only exact-rule pass. Local source inspection confirms that
Vision's budget script updates and verifies an existing Gateway but never
creates one. No account identifier, provider URL, token, secret, or protected
content was observed or recorded.

## Cause classification

- **Confirmed cause:** An incomplete dashboard observation was treated as proof
  of nonexistence without reconciling the historical creation record or testing
  the uniqueness constraint.
- **Contributing cause:** The Worker and Gateway share the same visible name,
  and prior work already documented confusion between those two products.
- **Known exclusions:** No candidate deployment, OpenAI request, backup-key
  change, or secret disclosure occurred.

## Correction and prevention

- **Correction:** Preserve the historical pass as historical evidence but
  require a fresh read-only identity and rule check before base-URL binding or
  AI acceptance. Do not create, rename, or delete a Gateway.
- **Prevention:** Treat a missing item in one dashboard surface as
  “not located,” not “does not exist.” Reconcile history, account selection,
  product area, and uniqueness behavior before proposing resource creation.
- **Owner:** Codex.
- **Next diagnostic step:** Locate the existing Gateway in the correct account
  and product area, then perform fresh identity, spend-rule, and Worker binding
  verification before deployment.

## Verification and related work

The cost review, Phase B evidence table, credential ledger, and binding incident
now preserve the historical pass while marking current verification pending.
The owner subsequently opened the existing exact-name Gateway and freshly
confirmed exactly one enabled, global, fixed 30-day $9.50 rule. The identity
conflict is closed; the dedicated AI workflow still owns its same-run automated
verification.

## Recurrence history

- 2026-08-03T04:15:11.0000000Z: Owner dashboard evidence exposed the tracked
  evidence contradiction before candidate deployment.
- 2026-08-03T04:20:30.5738755Z: Cloudflare rejected exact-name creation as a
  duplicate, disproving the absolute nonexistence conclusion without mutating
  the account.
- 2026-08-03T05:01:10.4517843Z: Owner opened the existing Gateway and confirmed
  the exact approved rule without mutation. Incident closed.
