/** Builds closed temporary AI-usage evidence from aggregate accounting facts. */
import { AI_HARD_STOP_CENTS, AI_OPTIONAL_STOP_CENTS, AI_WARNING_CENTS, classifyAiSpendTier, getChicagoBudgetMonth } from "../domain/budget/ai-budget";
import { PhaseBAiUsageSourceError, type PhaseBAiUsageSource } from "../data/phase-b-ai-usage-source";

export type PhaseBAiUsageEvidenceCategory = "none" | "unavailable" | "inconsistent" | "limit_exceeded";
export interface PhaseBAiUsageEvidence {
  readonly evidenceType: "vision.ai-usage/v1"; readonly outcome: "succeeded" | "failed"; readonly category: PhaseBAiUsageEvidenceCategory;
  readonly monthlyCents: number; readonly warningAtCents: 800; readonly optionalStopAtCents: 900; readonly hardStopAtCents: 950;
  readonly tier: "normal" | "warning" | "optional_stopped" | "stopped"; readonly gatewayLimitMatches: boolean; readonly nonAiAvailable: boolean;
}
export interface PhaseBAiUsageEvidenceDependencies extends Pick<PhaseBAiUsageSource,"read"> { readonly gatewayLimitMatches: boolean; readonly nonAiAvailable: boolean; }
export const PHASE_B_AI_USAGE_ACTION = "acceptance.ai-usage" as const;

/** Constructs one exact terminal record while retaining the observable over-limit amount. */
export function createPhaseBAiUsageEvidence(input: { readonly monthlyCents: number; readonly gatewayLimitMatches: boolean; readonly nonAiAvailable: boolean; }): PhaseBAiUsageEvidence {
  const valid = Number.isSafeInteger(input.monthlyCents) && input.monthlyCents >= 0;
  const monthlyCents = valid ? input.monthlyCents : 0;
  const overLimit = valid && input.monthlyCents > AI_HARD_STOP_CENTS;
  const category: PhaseBAiUsageEvidenceCategory = overLimit ? "limit_exceeded" : !valid ? "inconsistent" : input.gatewayLimitMatches === true && input.nonAiAvailable === true ? "none" : "inconsistent";
  return Object.freeze({ evidenceType: "vision.ai-usage/v1", outcome: category === "none" ? "succeeded" : "failed", category, monthlyCents, warningAtCents: AI_WARNING_CENTS, optionalStopAtCents: AI_OPTIONAL_STOP_CENTS, hardStopAtCents: AI_HARD_STOP_CENTS, tier: classifyAiSpendTier(monthlyCents), gatewayLimitMatches: input.gatewayLimitMatches === true, nonAiAvailable: input.nonAiAvailable === true });
}

/** Runs one aggregate read for the scheduler month without retaining a raw error. */
export async function runPhaseBAiUsageEvidence(now: Date, dependencies: PhaseBAiUsageEvidenceDependencies): Promise<PhaseBAiUsageEvidence> {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return unavailableEvidence("unavailable");
  try {
    const { monthlyCents } = await dependencies.read(getChicagoBudgetMonth(now));
    return createPhaseBAiUsageEvidence({ monthlyCents, gatewayLimitMatches: dependencies.gatewayLimitMatches, nonAiAvailable: dependencies.nonAiAvailable });
  } catch (error) { return unavailableEvidence(error instanceof PhaseBAiUsageSourceError && error.category === "inconsistent" ? "inconsistent" : "unavailable"); }
}

/** Emits only the fixed action and an already-closed evidence record. */
export function emitPhaseBAiUsageEvidence(evidence: PhaseBAiUsageEvidence, write: (entry: { readonly action: typeof PHASE_B_AI_USAGE_ACTION; readonly evidence: PhaseBAiUsageEvidence; }) => void = console.info): void { write({ action: PHASE_B_AI_USAGE_ACTION, evidence }); }
/** Returns the sole zeroed unavailable or inconsistent record. */
function unavailableEvidence(category: "unavailable" | "inconsistent"): PhaseBAiUsageEvidence { return Object.freeze({ evidenceType: "vision.ai-usage/v1", outcome: "failed", category, monthlyCents: 0, warningAtCents: AI_WARNING_CENTS, optionalStopAtCents: AI_OPTIONAL_STOP_CENTS, hardStopAtCents: AI_HARD_STOP_CENTS, tier: "normal", gatewayLimitMatches: false, nonAiAvailable: false }); }
