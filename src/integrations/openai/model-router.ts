/** Defines Vision's closed, deterministic model routing policy. */

/** Enumerates routine Phase B tasks and a future gated complex-planning task. */
export type AiTask =
  | {
      readonly kind: "category" | "wording" | "routine_extraction" | "summary";
    }
  | {
      readonly kind: "complex_planning";
      readonly complexityEligible: boolean;
      readonly budgetEligible: boolean;
    };

/** Narrows routine tasks to the Luna-only route at compile time. */
export function routeModel(
  task: Extract<AiTask, { readonly kind: "category" | "wording" | "routine_extraction" | "summary" }>,
): "gpt-5.6-luna";
/** Exposes the gated future planning route without widening routine task types. */
export function routeModel(
  task: Extract<AiTask, { readonly kind: "complex_planning" }>,
): "gpt-5.6-luna" | "gpt-5.6-terra";
/** Selects Luna unless both deterministic future complex-planning gates pass. */
export function routeModel(task: AiTask): "gpt-5.6-luna" | "gpt-5.6-terra" {
  if (
    task.kind === "complex_planning" &&
    task.complexityEligible === true &&
    task.budgetEligible === true
  ) {
    return "gpt-5.6-terra";
  }
  return "gpt-5.6-luna";
}
