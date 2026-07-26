/** Renders one explicit, Vision-only category correction control. */
import { useState, type ChangeEvent, type JSX } from "react";
import type { FoundationEvent } from "../status/api";

type ConcreteDomain = "school" | "work" | "personal";

/** Lets the owner correct category provenance while explaining the Google boundary. */
export function CategoryControl({
  event,
  onChange,
}: {
  readonly event: FoundationEvent;
  readonly onChange: (domain: ConcreteDomain) => Promise<void>;
}): JSX.Element {
  const [pending, setPending] = useState(false);
  const [announcement, setAnnouncement] = useState<"saved" | "failed" | undefined>();

  /** Applies the selected category once and restores the authoritative state on failure. */
  async function selectCategory(change: ChangeEvent<HTMLSelectElement>): Promise<void> {
    const domain = change.target.value as ConcreteDomain;
    if (domain !== "school" && domain !== "work" && domain !== "personal") return;
    setPending(true);
    setAnnouncement(undefined);
    try {
      await onChange(domain);
      setAnnouncement("saved");
    } catch {
      setAnnouncement("failed");
    } finally {
      setPending(false);
    }
  }

  const label = event.title?.trim() || "Untitled event";
  const selected = event.domain === "unresolved" ? "" : event.domain;
  return (
    <div className="category-control">
      <p className={`category-mark category-mark--${event.domainState}`}>
        {formatCategoryMark(event)}
      </p>
      <label htmlFor={`category-${event.id}`}>Category for {label}</label>
      <select
        id={`category-${event.id}`}
        disabled={pending}
        onChange={(change) => void selectCategory(change)}
        value={selected}
      >
        <option disabled value="">Choose a category</option>
        <option value="personal">Personal</option>
        <option value="work">Work</option>
        <option value="school">School</option>
      </select>
      <p className="category-control__boundary">This changes Vision only, not Google Calendar.</p>
      {announcement === "saved"
        ? <p className="category-control__announcement" role="status">Category saved in Vision.</p>
        : null}
      {announcement === "failed"
        ? <p className="category-control__announcement category-control__announcement--error" role="alert">Category was not saved. Refresh Vision and try again.</p>
        : null}
    </div>
  );
}

/** Describes both category and provenance without relying on badge color. */
function formatCategoryMark(event: FoundationEvent): string {
  if (event.domainState === "unresolved" || event.domain === "unresolved") {
    return "Needs category";
  }
  const domain = event.domain.replace(/^\w/u, (letter) => letter.toUpperCase());
  if (event.domainState === "inferred") return `Suggested ${event.domain}`;
  if (event.categoryProvenance === "user") return `${domain} · Set by you`;
  return `${domain} · Confirmed`;
}
