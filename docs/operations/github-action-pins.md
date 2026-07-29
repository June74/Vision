# GitHub Actions immutable pins

Reviewed on 2026-07-29 against the official repository tag refs. Workflow
references use these immutable commits while the comments retain the human
readable versions:

| Repository | Version | Immutable commit |
|---|---|---|
| actions/checkout | v5.1.0 | fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 |
| actions/setup-node | v5.0.0 | a0853c24544627f65ddf259abe73b1d18a591444 |
| actions/upload-artifact | v4.6.2 | ea165f8d65b6e75b540449e92b4886f43607fa02 |
| pnpm/action-setup | v4.3.0 | b906affcce14559ad1aafd4ab0e942779e9f58b1 |

Re-resolve official repository tag refs before intentionally changing an
action version. Review the resolved commit and update this record and every
workflow reference together.
