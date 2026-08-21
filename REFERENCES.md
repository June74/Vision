# Vision — References

What we are taking, precisely, and from where. "I like site X" is useless;
"X's Y, but Z" is actionable.

**Last updated:** 2026-08-14

> ## Honest status
>
> **No extraction has been run yet.** Every value in `DESIGN.md` was authored by
> Claude to fit the operator's stated constraints — it was not pulled from a real
> site's computed styles.
>
> This is the exact failure the operator's own method warns about: *"A design doc
> full of invented values is a design doc full of the model's defaults wearing my
> handwriting."*
>
> The values below are therefore **provisional**. Before the build goes past the
> demo stage, run the extraction pass (`styles.refero.design`, or the computed-style
> snippet) against the sites named here and reconcile. Anything that survives
> contact with a real reference gets marked `VERIFIED`.

---

## 1. Google Calendar — named by the operator

> **TAKING:** the restraint. Chrome recedes completely; the only saturated colour
> on screen belongs to user data. Generous whitespace between rows rather than
> boxes-inside-boxes. Density that survives a full week without a scrollbar.
>
> **NOT TAKING:** the grid-first mental model — Vision's front door is a *list of
> what matters*, not an hour grid. Also not taking the Material chrome, the FAB,
> the pill-shaped event blocks, or the multi-calendar colour explosion.
>
> **WHY:** the operator named it as the cleanliness bar. The risk is that Daylight
> is the closest of the three directions to Google, so the delta has to be earned
> by the load bar and the voice — otherwise it reads as a clone, which is an
> explicit anti-goal.
>
> **STATUS:** `PROVISIONAL` — not extracted.

---

## 2. Notion Calendar — named by the operator, as an anti-reference

> **TAKING:** nothing.
>
> **NOT TAKING:** the whole thing, explicitly. Named as "do not copy."
>
> **WHY:** worth an entry because the *warm* median in 2026 is Notion-adjacent —
> cream ground, 12px radius on everything, a soft illustration, one friendly
> accent. That's where this brief lands if left unconstrained. Recorded as an
> anti-goal in `DESIGN.md` §2 even though the operator didn't name it.
>
> **STATUS:** `LOCKED` as an anti-goal.

---

## 3. Generic AI-SaaS dashboard — anti-reference

> **NOT TAKING:** gradient hero, glassmorphism, purple-blue accent, feature-card
> triptych, pill badges, Inter, 12px+ radius everywhere, coloured left borders on
> cards, animated entrance on data rows.
>
> **WHY:** this is the median of Claude's training distribution and therefore the
> default output. Named specifically so it can be checked against, item by item,
> in the diff audit.
>
> **STATUS:** `LOCKED` as an anti-goal.

---

## To extract before the build hardens

Nobody has named a positive visual reference yet — only Google Calendar's
*restraint* and a list of things to avoid. That's a real gap: anti-goals bound the
space but don't locate a point in it.

Needed from the operator: **one or two sites whose *feel* is right**, with a delta.
Not calendars necessarily — the useful references here are probably editorial or
print-adjacent, since the direction is paper-and-ink rather than software-chrome.

Once named, extract and record:

- [ ] Type scale — actual computed px, not "large/medium/small"
- [ ] Colour ramp — the near-whites and near-blacks, which is where warmth lives
- [ ] Border and divider treatment — weight, colour, where they're absent
- [ ] Spacing rhythm — the repeating interval
- [ ] Easing curves and durations
- [ ] Measure — characters per line on body prose

## Borrowing line

Tokens, scales and motion parameters are design *facts* — learning that a hero
staggers at 60ms is fine. Lifting verbatim CSS or component code from a licensed
library to avoid paying for it is not, and this project doesn't.
