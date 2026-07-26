/** Displays actionable, privacy-safe synchronization health. */
import type { JSX } from "react";
import type { FoundationStatusSnapshot } from "./api";

/** Renders health precedence, sync age, and safe storage warnings in the signal rail. */
export function FoundationStatus({
  status,
}: {
  readonly status: FoundationStatusSnapshot;
}): JSX.Element {
  const presentation = describeFoundationStatus(status);
  return (
    <section className="foundation-status" aria-label="Foundation signal">
      <p className="signal-label">Foundation signal</p>
      <p className={`foundation-status__state foundation-status__state--${stateClass(status.state)}`}>
        <span aria-hidden="true" className="signal-glyph">{stateGlyph(status.state)}</span>
        <span>{status.state}</span>
      </p>
      <p className="foundation-status__copy">{presentation.summary}</p>
      {presentation.action
        ? <p className="foundation-status__action">{presentation.action}</p>
        : null}
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

/** Chooses a concrete next step using only allowlisted health facts. */
function describeFoundationStatus(
  status: FoundationStatusSnapshot,
): { readonly summary: string; readonly action?: string } {
  if (status.state === "Healthy") {
    return { summary: "Vision is synchronized and ready." };
  }
  if (status.state === "Delayed") {
    return {
      summary: "Vision is catching up. Your calendar remains available.",
      action: "Refresh in a few minutes to check the latest synchronization.",
    };
  }
  if (status.state === "Disconnected") {
    return {
      summary: "Google Calendar is not connected to Vision.",
      action: "Reconnect Google Calendar, then refresh Vision.",
    };
  }
  const summary = "Vision needs your attention before synchronization can recover.";
  if (
    status.authorizationState !== "connected" ||
    status.safeErrorCode === "authorization"
  ) {
    return {
      summary,
      action: "Reconnect Google Calendar, then refresh Vision.",
    };
  }
  if (
    status.databaseUsageWarning ||
    status.r2UsageWarning ||
    status.safeErrorCode === "quota"
  ) {
    return {
      summary,
      action: "Review Vision's managed-service usage, then refresh Vision.",
    };
  }
  if (status.safeErrorCode === "database") {
    return {
      summary,
      action: "Try again in a few minutes. If this continues, check Vision's database service.",
    };
  }
  if (status.failedJobCount > 0) {
    return {
      summary,
      action: "Refresh after the next repair run. If this remains, reconnect Google Calendar.",
    };
  }
  return {
    summary,
    action: "Refresh Vision in a few minutes. If this remains, reconnect Google Calendar.",
  };
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
