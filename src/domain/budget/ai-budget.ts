/** Defines Vision's deterministic private-pilot AI spending policy. */

/** Enumerates request classes that have distinct optional and model eligibility. */
export type AiRequestClass = "routine" | "optional" | "complex";

/** Describes the deterministic model and admission state at one settled-plus-reserved total. */
export interface AiBudgetDecision {
  readonly allowed: boolean;
  readonly mode: "normal" | "luna_only" | "blocked";
  readonly warning: boolean;
  readonly terraEligible: boolean;
  readonly code?:
    | "AI_BUDGET_INVALID"
    | "AI_BUDGET_EXHAUSTED"
    | "AI_OPTIONAL_DISABLED"
    | "AI_COMPLEX_DISABLED";
}

/** Starts warning mode and removes complex/Terra eligibility. */
export const AI_WARNING_CENTS = 800;
/** Stops optional AI work. */
export const AI_OPTIONAL_STOP_CENTS = 900;
/** Stops every new AI request. */
export const AI_HARD_STOP_CENTS = 950;
const CHICAGO_MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
});

/** Evaluates exact monthly AI thresholds without changing any non-AI capability. */
export function evaluateAiBudget(
  monthlyCents: number,
  requestClass: AiRequestClass,
): AiBudgetDecision {
  if (
    !Number.isSafeInteger(monthlyCents) ||
    monthlyCents < 0 ||
    !["routine", "optional", "complex"].includes(requestClass)
  ) {
    return blocked("AI_BUDGET_INVALID");
  }
  if (monthlyCents >= AI_HARD_STOP_CENTS) {
    return blocked("AI_BUDGET_EXHAUSTED");
  }
  if (
    requestClass === "optional" &&
    monthlyCents >= AI_OPTIONAL_STOP_CENTS
  ) {
    return blocked("AI_OPTIONAL_DISABLED");
  }
  if (requestClass === "complex" && monthlyCents >= AI_WARNING_CENTS) {
    return blocked("AI_COMPLEX_DISABLED");
  }
  if (monthlyCents >= AI_WARNING_CENTS) {
    return {
      allowed: true,
      mode: "luna_only",
      warning: true,
      terraEligible: false,
    };
  }
  return {
    allowed: true,
    mode: "normal",
    warning: false,
    terraEligible: true,
  };
}

/** Maps an instant to Vision's fixed America/Chicago accounting month. */
export function getChicagoBudgetMonth(now: Date): string {
  if (
    !(now instanceof Date) ||
    Number.isNaN(Date.prototype.getTime.call(now))
  ) {
    throw new Error("Invalid AI budget timestamp.");
  }
  const parts = CHICAGO_MONTH_FORMATTER.formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (
    year === undefined ||
    month === undefined ||
    !/^\d{4}$/u.test(year) ||
    !/^\d{2}$/u.test(month)
  ) {
    throw new Error("Invalid AI budget timestamp.");
  }
  return `${year}-${month}`;
}

/** Returns the single fail-closed budget decision shape. */
function blocked(code: NonNullable<AiBudgetDecision["code"]>): AiBudgetDecision {
  return {
    allowed: false,
    mode: "blocked",
    warning: true,
    terraEligible: false,
    code,
  };
}
