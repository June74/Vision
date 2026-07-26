/** Shows the AI sub-budget without coupling calendar access to model availability. */
import type { JSX } from "react";
import type { FoundationStatusSnapshot } from "./api";

/** Renders monthly AI availability and the deterministic-function fallback promise. */
export function CostStatus({
  status,
}: {
  readonly status: FoundationStatusSnapshot;
}): JSX.Element {
  const presentation = describeTier(status.aiSpendTier);
  return (
    <section className={`cost-status cost-status--${status.aiSpendTier}`} aria-label="AI cost status">
      <p className="signal-label">AI allowance</p>
      <p className="cost-status__state">{presentation.title}</p>
      <p className="cost-status__amount">{formatCents(status.aiMonthlyCents)} of $9.50</p>
      <div className="cost-meter" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (status.aiMonthlyCents / 950) * 100)}%` }} />
      </div>
      <p className="cost-status__copy">{presentation.copy}</p>
    </section>
  );
}

/** Maps the exact server budget tier to calm person-facing availability copy. */
function describeTier(
  tier: FoundationStatusSnapshot["aiSpendTier"],
): { readonly title: string; readonly copy: string } {
  if (tier === "stopped") {
    return {
      title: "AI paused",
      copy: "Calendar viewing and category changes still work.",
    };
  }
  if (tier === "optional_stopped") {
    return {
      title: "AI limited",
      copy: "Optional AI work is paused. Core calendar tools still work.",
    };
  }
  if (tier === "warning") {
    return {
      title: "AI budget watch",
      copy: "Vision is using its lower-cost model for eligible work.",
    };
  }
  return {
    title: "AI ready",
    copy: "Calendar tools stay available if AI reaches its limit.",
  };
}

/** Formats integer cents as a stable US-dollar amount. */
function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
