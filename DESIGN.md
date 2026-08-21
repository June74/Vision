# Vision — Design Contract

The design source of truth. Values here are **locked** unless this file changes.
If a screen disagrees with this file, the screen is wrong.

**Status:** in progress — Today and Approvals built, 13 screens remaining
**Last updated:** 2026-08-14
**Companion:** `REFERENCES.md` (what we're borrowing and from where)

---

## 1. The one sentence

> Vision must make one person, opening it for the twentieth time today, see the
> shape of their commitments in two seconds — and trust that nothing was changed
> on their behalf without being shown to them first.

Two clauses, and they rank. When legibility and disclosure conflict, **disclosure
wins**. A confirmation screen is allowed to be slow to read; a schedule is not.

---

## 2. Anti-goals

Locked by the operator, 2026-08-14. These eliminate regions of the design space
and take precedence over any positive description.

| Not this | Why it's here |
|---|---|
| Gradient hero of any kind | Named directly |
| "Fancy" — glass, blur, glow, parallax, decorative motion | Named directly |
| Tech-looking — blue-black, monospace chrome, terminal affordances | Named directly |
| SaaS-looking — feature grids, pill badges, gradient CTAs, Inter | Named directly |
| A Google Calendar or Notion Calendar clone | Similar layout is fine; identical is not |
| Cluttered | Google Calendar's restraint is the bar |
| **Notion-beige** | Not named by the operator; added by Claude. Cream + 12px radius + soft illustration is the *warm* median and the likeliest failure mode of this brief |
| Colored side-bar on cards | The single most recognizable tell of AI-generated UI |
| Emoji, exclamation marks, first-person greetings in product copy | Route to Clippy |

---

## 3. Typography

Two families. No third.

| Role | Family | Notes |
|---|---|---|
| Display | **Bricolage Grotesque** 700 | Dates, page titles, brand. Tight tracking |
| UI + prose | **Karla** 400 / 500 / 700 | Everything else, including the voice |

Neither is on the overused list (Inter, Roboto, Fraunces, Geist, Plus Jakarta,
Space Grotesk are banned by consequence).

### Scale

Six steps. Ratios stay ≥1.18 so hierarchy survives a screenshot.

| Token | px | Family / weight | Tracking | Use |
|---|---|---|---|---|
| `--t-display` | 40 | Bricolage 700 | −0.035em | The date on Today |
| `--t-title` | 27 | Bricolage 700 | −0.028em | Page + approval titles |
| `--t-voice` | 17 | Karla 400 | 0 | The margin voice. Nothing else uses this |
| `--t-body` | 14 | Karla 400 | 0 | Event titles, prose, diff values |
| `--t-small` | 12 | Karla 400 | 0 | Meta, secondary, timestamps |
| `--t-label` | 10 | Karla 700 | +0.12em, uppercase | Section labels only |

Line height: 1.15 display · 1.5 voice and prose · 1.55 UI.
Measure: **56ch** on the voice, **64ch** on any prose block. Never full-width.

> **Debt:** screens built before 2026-08-14 use 13.5 / 12.5 / 11.5 as well. They
> collapse into `--t-body` / `--t-small` at the next pass. Flagged by the design
> hook as a flat hierarchy; the finding is correct.

---

## 4. Color

Semantic names only. Never reference a hex in a component.

### Light — "Daylight" (default)

| Token | Value | Use |
|---|---|---|
| `--paper` | `#FDFCFA` | Page ground |
| `--raised` | `#F5F3EF` | Rail, action bar, inset panels |
| `--line` | `#E7E3DC` | Container borders |
| `--hair` | `#EFECE6` | Row dividers |
| `--ink` | `#1A1A19` | Primary text, primary button ground |
| `--ink-2` | `#5C5952` | Secondary text |
| `--ink-3` | `#8A857C` | Meta, labels, disabled |

### Dark — "Lamp"

Warm dark. **Zero pure grey, zero pure black, never blue-black.**

| Token | Value |
|---|---|
| `--paper` | `#16120E` |
| `--raised` | `#1D1813` |
| `--line` | `#2E271F` |
| `--hair` | `#2A241D` |
| `--ink` | `#F0E7DA` |
| `--ink-2` | `#C9B79E` |
| `--ink-3` | `#9C8B76` |

### Domains — the only chromatic colour in the product

| Domain | Light | Dark |
|---|---|---|
| School | `#4F7A63` | `#7E9B66` |
| Work | `#3D6A93` | `#6E93B0` |
| Personal | `#9A6091` | `#B58AA8` |

### Semantic

| Token | Light | Dark | Use |
|---|---|---|---|
| `--alarm` | `#A8442F` | `#D2765C` | Irreversible, invalidated, at-risk. Nothing else |
| `--alarm-bg` | `#FBF1EE` | `#2A1A14` | Ground behind an alarm block |
| `--ok` | `#3F6B4F` | `#7FA98A` | "Undo is complete", freshness verified |

### Rules

- **There is no accent colour.** The primary button is `--ink`. Emphasis comes
  from weight and position, not hue. This is what keeps Daylight out of SaaS.
- **Hue is never the sole carrier of meaning.** Every domain dot is accompanied by
  a text label. The privacy model makes domain semantically load-bearing;
  colour-only fails for colour-blind users and dies in greyscale.
- **Domain marks are 6px dots.** Never a left border, never a filled chip.
- `--alarm` is rationed. If it appears twice on one screen, one of them is wrong.

---

## 5. Spacing and radii

Spacing scale (px): **4 · 8 · 12 · 16 · 24 · 32 · 48**. Nothing off-scale.

| Radius | Value | Use |
|---|---|---|
| `--r-mark` | 4px | Dots, badges, tags |
| `--r-control` | 6px | Buttons, inputs, nav items |
| `--r-box` | 8px | Cards, panels, diff containers |

Nothing above 8px. Rounded-everything is the friendly-SaaS tell.
Borders are **1px**, always. No shadows except the floating chat (`0 18px 50px
rgba(0,0,0,.6)`) — it is the only element that leaves the plane.

---

## 6. Motion

Vision is a reference surface. Motion that delays reading is a defect.

| What | Duration | Easing |
|---|---|---|
| Hover / focus | 150ms | `ease` |
| Voice line swap | 340ms | `ease`, opacity only |
| Panel + popup open | 200ms | `ease-out` |

**Rules**

- **Transform and opacity only.** Never animate width, height, padding, margin.
  (The day load bar currently animates `width` — logged as debt below.)
- **Data never animates in.** No staggered event rows, no counting numbers, no
  entrance on the calendar. A schedule you have to wait for is not a schedule.
- **No decorative motion at all.** Nothing loops, pulses, floats or shimmers.
- `prefers-reduced-motion: reduce` → all durations 0. No exceptions.

> **Debt:** `.load i { transition: width }` in the Today screen. Correct fix is
> `transform: scaleX()` on a fixed-width track.

---

## 7. The voice

Vision's one human element. Rules are stricter than the rest of the design because
the failure mode is worse.

**Where.** One line, top of Today, above the date. `--t-voice`, `--ink`, 56ch.
Nowhere else in the product.

**Source.** A **written bank**, chosen deterministically. **Zero model calls.**
Phase B caps spend at ~$20/month with an enforced AI sub-budget and requires
graceful non-AI operation; a greeting that calls OpenAI spends the budget on the
least important sentence in the product and disappears when it runs out.

**Input.** Day *shape* only — percent committed, dominant domain, and whether a
hard deadline inside 48h has zero scheduled time. **It never reads an event
title.** A voice that says "hope the dentist goes well" has leaked a private title
onto a screen that gets shared.

**States**

| State | Trigger | Tone |
|---|---|---|
| Packed · work | ≥60% committed, work dominant | Steady, practical. Narrow the day to one thing |
| Packed · school | ≥60% committed, school dominant | Same, plus "you've done this before" |
| Balanced | 25–60% committed | Notices the shape is good |
| Open | ≤20% committed | Tells them to rest, explicitly |
| Personal-heavy | personal dominant | Says the least |
| **At risk** | hard deadline <48h, 0 min scheduled | **Overrides every state above** |

**Hard rules**

1. One sentence. Two only if the second is shorter than the first.
2. No greeting, no name, no emoji, no exclamation mark, no question unless it
   offers a concrete action.
3. **Never encouraging over a day that is going wrong.** At-risk outranks comfort.
4. Says "I" only for things Vision actually did. Never for things it didn't.
5. Stable for a whole day — seeded on `date + state`. It must not change on
   re-render, or Vision reads as having amnesia.
6. No repeat within 6 lines.
7. **On by default, with a switch.** *(operator, 2026-08-14)*
8. **Silent on unremarkable days.** Silence is a signal; it makes the days it does
   speak carry weight. *(operator, 2026-08-14)*

> **Debt:** the bank is 4–5 lines per state. Needs 12–15 plus slot-filling on
> measurable facts ("six hours are already spoken for") before pilot.

---

## 8. Component inventory

Built once. A fourth variant of anything here is a finding, not a feature.

**Shell** — rail (212–252px) · nav item · brand · command bar (⌘K) · floating chat
(draggable, Document PiP pop-out)

**Calendar** — mini month (spills into next month to complete the final week row) ·
domain key (click to filter: matches bold, rest to 26% — **fade, never hide**, so a
filtered day is not misread as a free one) · day load bar · event row (time · 6px
dot · title · domain meta) · segmented Today/Week

**Approval** — queue item · field diff row (struck old → bold new; unchanged fields
shown, not omitted) · evidence citation (type tag + source line) · exposure box
(what leaves / what doesn't) · undo badge (`Complete` | `Not reversible`) ·
alternative card · trade-off note · action bar · freshness line

**Generic** — section card · label · empty state · alarm block

### Component rules earned the hard way

- **Irreversibility is signalled by structure, not by red.** The verb on the button
  changes (`Send it`, not `Approve`), the alternative offers a reversible path, the
  undo badge reads `Not reversible`. Red banners stop being seen in a week.
- **Invalidated approvals disable Approve.** They do not warn-and-allow.
- **No bulk approve, ever.** Approval "applies only to the displayed action" —
  bulk contradicts the contract at the root.
- **Freshness is always visible**, bottom-left of every approval. The
  state-freshness gate targets 0 incidents; an invisible gate is an untrusted one.

---

## 9. Locked decisions

| Date | Decision | By |
|---|---|---|
| 2026-08-14 | Name is **Vision** | operator |
| 2026-08-14 | Product first (~15 screens), marketing site second, built from real components | operator |
| 2026-08-14 | **Shell B** — dashboard-primary. Today is the page; chat is ⌘K + pop-out | operator |
| 2026-08-14 | **Daylight** palette; **Lamp** as dark theme, not a third direction | operator |
| 2026-08-14 | Signature = the **margin voice** + the **day load bar** | operator |
| 2026-08-14 | Voice on by default with a switch; silent on unremarkable days | operator |
| 2026-08-14 | 15-screen page inventory approved; **Approvals built second** | operator |
| 2026-08-14 | No accent colour — `--ink` is the primary button | Claude, unchallenged |
| 2026-08-14 | Domain = dot + label, never hue alone | Claude, unchallenged |
| 2026-08-14 | Voice is a deterministic bank, never a model call | Claude, unchallenged |

---

## 10. Open — decided by nobody yet

1. **Approval queue ordering.** Four items fit; twenty won't. Deadline pressure,
   irreversibility, or age? Currently arbitrary.
2. **Mobile.** Shell B assumes ≥1000px. Browser/push alerts are promised in
   Phase A, so a phone will open this. Not designed.
3. **Week view time positioning.** Current build stacks events in reading order —
   a 09:00 and a 19:00 sit adjacent. Fine for layout, useless for judging a week.
4. **Whether Commitments / Alerts / Audit are one component.** Three read-only
   lists. If they become three bespoke designs, that is a smell.
5. **Voice copy.** Needs a writer and 12–15 lines per state.
