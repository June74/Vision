# SB-20260726-191035-preview-deploy-missing-nonsecret-vars: Preview deployment omitted required non-secret variables

- **Status:** closed
- **First observed:** 2026-07-26T19:10:35.606572Z
- **Last observed:** 2026-07-26T19:33:19.4460335Z
- **Phase/task:** Phase B recovery acceptance
- **Environment:** Deployed Cloudflare preview
- **Version/commit:** `1dff60e`

## Symptom

After a successful preview workflow, the live Worker listed the backup secret and resource bindings but not the backup key version or AI spending-limit variables.

## Impact

The daily backup and AI budget boundary cannot be accepted until deployed variable state is corrected and verified.

## Reproduction conditions

Build the Vite-selected preview artifact, then deploy it with a second
`--env preview` selection and a single command-line Worker variable.

## Safe evidence

The generated preview artifact contained the required non-secret variables,
R2 binding, and crons but initially lacked the non-inheritable Queue binding.
The live deployment listed neither required non-secret limit nor either cron.

## Attempts and outcomes

- The deployed Worker was inspected after a successful workflow.
- The source and generated Wrangler configurations were compared.
- Current Cloudflare documentation confirmed that Vite selects the environment
  at build time, Queue bindings are non-inheritable, and `--var` is an
  alternative Worker-variable source.
- Focused RED tests reproduced the workflow and Queue gaps.
- The source-of-truth fix now passes focused tests and generated-artifact
  validation locally.

## Cause classification

- **Confirmed cause:** The workflow selected the environment again against the
  already environment-specific generated config, supplied one command-line
  Worker variable, and kept Queue bindings only at the non-inherited top level.
- **Hypotheses:** None.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** The encrypted secret and private R2 bucket binding
  survived the deployment.

## Correction and prevention

- **Correction:** Removed the redundant deploy-time environment and variable
  flags, moved the redirect into preview configuration, duplicated Queue
  bindings per environment, and strengthened the generated-config validator.
- **Prevention:** CI now rejects missing preview variables, Queue producer or
  consumer, either cron, or the private R2 binding.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

Focused tests pass 4/4, and the generated preview artifact contains every
required non-secret variable, R2 binding, Queue role, and two crons.
The corrected workflow then passed its full checks and deployed commit
`066fcbd`. A fresh live dashboard inspection confirmed the encrypted backup
secret, backup key version, AI hard limit, preview environment, private R2
bucket, Queue producer and consumer, and both approved cron expressions.

## Recurrence history

- 2026-07-26T19:10:35.606572Z: First observed.
