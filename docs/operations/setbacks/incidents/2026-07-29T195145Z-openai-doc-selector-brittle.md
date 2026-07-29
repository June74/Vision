# SB-20260729-195145-openai-doc-selector-brittle: Official model-page selector depended on one search hierarchy

- **Status:** closed
- **First observed:** 2026-07-29T19:51:45Z
- **Last observed:** 2026-07-29T19:51:45Z
- **Phase/task:** Phase B consolidated final-fix AI pricing contract
- **Environment:** Official OpenAI documentation read
- **Version/commit:** Working changes based on `e3c1272`

## Symptom

The official docs search had already returned the Luna model page, but a
narrower follow-up query changed the hierarchy label. A selector tied to the
earlier label found no page and stopped before fetching content.

## Impact

No pricing value was accepted, no source file changed, and no provider action
occurred. The current pricing evidence remained incomplete.

## Cause classification

- **Confirmed cause:** Page selection depended on a presentation label rather
  than verified model-page content.
- **Hypotheses:** None.
- **Rejected hypotheses:** Official model documentation is absent.
- **Known exclusions:** The initial official search exposed a plausible Luna
  model-page result.

## Correction and prevention

- **Correction:** Select a result whose content and title both identify the
  Luna API model, then fetch and validate the returned document body.
- **Prevention:** Treat search hierarchy labels as unstable presentation data.
- **Owner:** Codex.
- **Next diagnostic step:** Fetch the content-identified official model page.

## Verification and related work

The final contract must retain only rates and boundaries explicitly present in
the fetched primary document.
