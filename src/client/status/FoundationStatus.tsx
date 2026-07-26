/** Displays actionable, privacy-safe synchronization health. */
import type { JSX } from "react";
import type { FoundationStatusSnapshot } from "./api";

const STATE_COPY: Readonly<Record<FoundationStatusSnapshot["state"], string>> = {
  Healthy: "Vision is synchronized and ready.",
  Delayed: "Vision is catching up. Your calendar remains available.",
  "Action required": "Vision needs your attention before synchronization can recover.",
  Disconnected: "Reconnect Google Calendar to resume synchronization.",
};

/** Renders health precedence, sync age, and safe storage warnings in the signal rail. */
export function FoundationStatus({
  status,
}: {
  readonly status: FoundationStatusSnapshot;
}): JSX.Element {
  return (
    <section className="foundation-status" aria-label="Foundation signal">
      <p className="signal-label">Foundation signal</p>
      <p className={`foundation-status__state foundation-status__state--${stateClass(status.state)}`}>
        <span aria-hidden="true" className="signal-glyph">{stateGlyph(status.state)}</span>
        <span>{status.state}</span>
      </p>
      <p className="foundation-status__copy">{STATE_COPY[status.state]}</p>
      <dl className="foundation-status__facts">
        <div>
          <dt>Last synchronized</dt>
          <dd>{formatAge(status.syncDelayMs)}</dd>
        </div>
        <div>
          <dt>Queue retries</dt>
          <dd>{status.queueRetryCount}</dd>
        </div>
      </dl>
      {status.databaseUsageWarning
        ? <p className="resource-warning">Database usage needs review.</p>
        : null}
      {status.r2UsageWarning
        ? <p className="resource-warning">Backup storage usage needs review.</p>
        : null}
    </section>
  );
}

/** Converts a server-derived synchronization delay into a short relative age. */
function formatAge(milliseconds: number | null): string {
  if (milliseconds === null) return "Not yet";
  const minutes = Math.max(0, Math.floor(milliseconds / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

/** Chooses a color-independent status glyph with a matching text label. */
function stateGlyph(state: FoundationStatusSnapshot["state"]): string {
  if (state === "Healthy") return "●";
  if (state === "Delayed") return "◐";
  if (state === "Action required") return "!";
  return "×";
}

/** Creates the finite modifier name used by the operational state palette. */
function stateClass(state: FoundationStatusSnapshot["state"]): string {
  return state.toLowerCase().replaceAll(" ", "-");
}
