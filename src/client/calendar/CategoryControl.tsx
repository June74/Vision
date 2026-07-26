/** Renders one explicit, Vision-only category correction control. */
import { useRef, useState, type ChangeEvent, type JSX } from "react";
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
  const [announcement, setAnnouncement] = useState<"saving" | "saved" | "failed" | undefined>();
  const pendingRef = useRef(false);
  const selected = event.domain === "unresolved" ? "" : event.domain;

  /** Applies one selection while retaining focus and ignoring duplicate pending changes. */
  async function selectCategory(change: ChangeEvent<HTMLSelectElement>): Promise<void> {
    const domain = change.target.value as ConcreteDomain;
    if (domain !== "school" && domain !== "work" && domain !== "personal") return;
    if (pendingRef.current) {
      change.currentTarget.value = selected;
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setAnnouncement("saving");
    try {
      await onChange(domain);
      setAnnouncement("saved");
    } catch {
      setAnnouncement("failed");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  const label = event.title?.trim() || "Untitled event";
  return (
    <div className="category-control">
      <p className={`category-mark category-mark--${event.domainState}`}>
        {formatCategoryMark(event)}
      </p>
      <label htmlFor={`category-${event.id}`}>Category for {label}</label>
      <select
        aria-busy={pending}
        aria-disabled={pending}
        id={`category-${event.id}`}
        onChange={(change) => void selectCategory(change)}
        value={selected}
      >
        <option disabled value="">Choose a category</option>
        <option value="personal">Personal</option>
        <option value="work">Work</option>
        <option value="school">School</option>
      </select>
      <p className="category-control__boundary">This changes Vision only, not Google Calendar.</p>
      {announcement === "saving"
        ? <p className="category-control__announcement" role="status">Saving category in Vision…</p>
        : null}
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
