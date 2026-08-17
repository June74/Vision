/** Renders deterministic scheduling, template briefings, and local follow-ups without calendar write authority. */
import { useEffect, useMemo, useState, type FormEvent, type JSX } from "react";
import type { BrowserSession } from "../setup/api";
import {
  createPlanningFollowUp,
  createSchedulingProposal,
  readPlanningBriefing,
  readPlanningFollowUps,
  transitionPlanningFollowUp,
  type Briefing,
  type FollowUp,
  type SchedulingProposal,
} from "./api";

/** Owns the private planning surface while leaving provider writes to the reviewed calendar pipeline. */
export function PlanningDesk({ session }: { readonly session: BrowserSession }): JSX.Element {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [followUps, setFollowUps] = useState<readonly FollowUp[]>([]);
  const [proposal, setProposal] = useState<SchedulingProposal | null>(null);
  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);

  useEffect(() => {
    let active = true;
    void Promise.all([readPlanningBriefing(timeZone), readPlanningFollowUps(timeZone)])
      .then(([nextBriefing, nextFollowUps]) => {
        if (!active) return;
        setBriefing(nextBriefing);
        setFollowUps(nextFollowUps);
      })
      .catch(() => { if (active) setError("Planning is temporarily unavailable."); });
    return () => { active = false; };
  }, [timeZone]);

  /** Requests a deterministic time proposal over a bounded local planning window. */
  async function submitProposal(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      const start = new Date();
      const next = await createSchedulingProposal(session, {
        title,
        durationMinutes: Number(durationMinutes),
        preferredStartAt: start.toISOString(),
        window: { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 8 * 60 * 60_000).toISOString(), timeZone },
        ambiguity: [],
      });
      setProposal(next);
      setMessage("Calendar approval required");
    } catch {
      setError("A planning proposal could not be created.");
    }
  }

  /** Creates a local follow-up without creating a provider event. */
  async function submitFollowUp(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      const followUp = await createPlanningFollowUp(session, {
        title: followUpTitle,
        dueAt: null,
        timeZone,
        sourceFactIds: [],
      });
      setFollowUps((current) => [followUp, ...current]);
      setFollowUpTitle("");
      setMessage("Follow-up saved locally");
    } catch {
      setError("Follow-up could not be saved.");
    }
  }

  /** Applies an owner-scoped local follow-up transition. */
  async function changeFollowUp(followUp: FollowUp): Promise<void> {
    setError(null);
    try {
      const next = await transitionPlanningFollowUp(session, followUp.id, followUp.status === "completed" ? "reopen" : "complete");
      setFollowUps((current) => current.map((candidate) => candidate.id === next.id ? next : candidate));
    } catch {
      setError("Follow-up transition could not be saved.");
    }
  }

  return (
    <section className="planning-desk" aria-label="Planning desk">
      <div className="planning-desk__intro">
        <p className="desk-intro__eyebrow">Deterministic planning</p>
        <h2>Planning desk</h2>
        <p>Vision can suggest time and prepare briefings. Calendar changes still require a separate reviewed approval.</p>
      </div>
      {error ? <p className="planning-desk__error">{error}</p> : null}
      {message ? <p className="planning-desk__message" role="status">{message}</p> : null}
      <section aria-labelledby="planning-briefing-heading" className="planning-card">
        <p className="desk-intro__eyebrow">Template-backed briefing</p>
        <h3 id="planning-briefing-heading">Morning briefing</h3>
        {briefing?.sections.map((section) => section.items.length > 0
          ? <p key={section.kind}>{section.title}: {section.items.length}</p>
          : null)}
        <p className="planning-desk__quiet">AI is disabled for this planning surface.</p>
      </section>
      <form className="planning-form" onSubmit={submitProposal}>
        <h3>Find a time</h3>
        <label htmlFor="planning-title">Planning title</label>
        <input id="planning-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <label htmlFor="planning-duration">Duration in minutes</label>
        <input id="planning-duration" inputMode="numeric" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} />
        <button className="button button--quiet" type="submit" disabled={title.trim().length === 0}>Find time</button>
      </form>
      {proposal ? <ProposalCard proposal={proposal} /> : null}
      <form className="planning-form" onSubmit={submitFollowUp}>
        <h3>Local follow-up</h3>
        <label htmlFor="planning-follow-up-title">Follow-up title</label>
        <input id="planning-follow-up-title" value={followUpTitle} onChange={(event) => setFollowUpTitle(event.target.value)} />
        <button className="button button--quiet" type="submit" disabled={followUpTitle.trim().length === 0}>Save follow-up</button>
      </form>
      {followUps.length > 0 ? (
        <section className="planning-card" aria-label="Local follow-ups">
          <h3>Local follow-ups</h3>
          <ul className="planning-list">
            {followUps.slice(0, 8).map((followUp) => (
              <li key={followUp.id}>
                <span className={followUp.status === "completed" ? "planning-list__done" : undefined}>{followUp.title}</span>
                <button className="button button--quiet" type="button" onClick={() => void changeFollowUp(followUp)}>
                  {followUp.status === "completed" ? "Reopen" : "Complete"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

/** Displays alternatives and the explicit approval boundary without a confirm action. */
function ProposalCard({ proposal }: { readonly proposal: SchedulingProposal }): JSX.Element {
  return (
    <section className="planning-card" aria-label="Scheduling proposal">
      <h3>{proposal.status === "conflict" ? "Conflict found" : proposal.status === "needs_clarification" ? "Clarification needed" : "Suggested time"}</h3>
      {proposal.alternatives.slice(0, 3).map((alternative) => <p key={alternative.id}>{alternative.localStart}–{alternative.localEnd}</p>)}
      {proposal.conflicts.length > 0 ? <p>Source conflict: {proposal.conflicts[0]?.citation.label}</p> : null}
      <strong>Calendar approval required</strong>
      <small>No calendar change was confirmed.</small>
    </section>
  );
}
