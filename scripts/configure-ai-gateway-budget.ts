/** Applies and verifies Vision's fixed global preview AI Gateway cost ceiling. */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const AI_GATEWAY_LIMIT_DOLLARS = 9.5;
export const AI_GATEWAY_WINDOW_SECONDS = 30 * 24 * 60 * 60;
const AI_GATEWAY_APPROVED_ID_OR_NAME = "vision-preview";

interface GatewayCredentials {
  readonly accountId: string;
  readonly apiToken: string;
}

export interface AiGatewayBudgetEvidence {
  readonly configured: true;
  readonly global: true;
  readonly limitDollars: typeof AI_GATEWAY_LIMIT_DOLLARS;
  readonly technique: "fixed";
  readonly windowSeconds: typeof AI_GATEWAY_WINDOW_SECONDS;
}

export type AiGatewayBudgetErrorCategory =
  | "invalid_configuration"
  | "lookup_empty"
  | "lookup_failed"
  | "lookup_identity_mismatch"
  | "lookup_not_found"
  | "lookup_unauthorized"
  | "update_failed"
  | "update_invalid_request"
  | "update_not_found"
  | "update_unauthorized"
  | "verification_failed"
  | "unknown_failure";

/** Narrows an unknown API value to a non-array record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Accepts only Vision's one unscoped global fixed-window cost rule. */
function hasExactSpendLimit(result: unknown): boolean {
  const returnedSpendLimits =
    isRecord(result) && isRecord(result.spend_limits)
      ? result.spend_limits
      : {};
  const rules = Array.isArray(returnedSpendLimits.rules)
    ? returnedSpendLimits.rules
    : [];
  const rule = rules.length === 1 && isRecord(rules[0]) ? rules[0] : {};
  return (
    returnedSpendLimits.enabled === true &&
    rule.enabled === true &&
    rule.limit === AI_GATEWAY_LIMIT_DOLLARS &&
    rule.limitType === "cost" &&
    rule.technique === "fixed" &&
    rule.window === AI_GATEWAY_WINDOW_SECONDS &&
    !Object.hasOwn(rule, "metadata") &&
    !Object.hasOwn(rule, "model") &&
    !Object.hasOwn(rule, "provider")
  );
}

/** Returns the fixed privacy-safe acceptance evidence. */
function createBudgetEvidence(): AiGatewayBudgetEvidence {
  return Object.freeze({
    configured: true as const,
    global: true as const,
    limitDollars: AI_GATEWAY_LIMIT_DOLLARS,
    technique: "fixed" as const,
    windowSeconds: AI_GATEWAY_WINDOW_SECONDS,
  });
}

/** Maps internal failures to a fixed category without copying provider content. */
export function classifyAiGatewayBudgetError(
  error: unknown,
): AiGatewayBudgetErrorCategory {
  if (!(error instanceof Error)) return "unknown_failure";
  if (error.message === "AI Gateway budget configuration is invalid.") {
    return "invalid_configuration";
  }
  if (error.message === "AI Gateway lookup failed.") return "lookup_failed";
  if (error.message === "AI Gateway list was empty.") return "lookup_empty";
  if (error.message === "AI Gateway identity did not match.") {
    return "lookup_identity_mismatch";
  }
  if (error.message === "AI Gateway lookup authorization failed.") {
    return "lookup_unauthorized";
  }
  if (error.message === "AI Gateway was not found.") {
    return "lookup_not_found";
  }
  if (error.message === "AI Gateway update failed.") return "update_failed";
  if (error.message === "AI Gateway update authorization failed.") {
    return "update_unauthorized";
  }
  if (error.message === "AI Gateway update request was invalid.") {
    return "update_invalid_request";
  }
  if (error.message === "AI Gateway update target was not found.") {
    return "update_not_found";
  }
  if (error.message === "AI Gateway budget verification failed.") {
    return "verification_failed";
  }
  return "unknown_failure";
}

/** Applies the exact budget and accepts only the matching returned configuration. */
export async function configureAiGatewayBudget(
  credentials: GatewayCredentials,
  fetchImplementation: typeof fetch = fetch,
): Promise<AiGatewayBudgetEvidence> {
  if (
    !/^[a-f0-9]{32}$/iu.test(credentials.accountId) ||
    !/^[\x21-\x7e]{20,512}$/u.test(credentials.apiToken)
  ) {
    throw new Error("AI Gateway budget configuration is invalid.");
  }
  const listEndpoint =
    `https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}` +
    "/ai-gateway/gateways";
  const headers = Object.freeze({
    authorization: `Bearer ${credentials.apiToken}`,
    "content-type": "application/json",
  });

  const currentResponse = await fetchImplementation(listEndpoint, { headers });
  if (currentResponse.status === 401 || currentResponse.status === 403) {
    await currentResponse.body?.cancel();
    throw new Error("AI Gateway lookup authorization failed.");
  }
  if (currentResponse.status === 404) {
    await currentResponse.body?.cancel();
    throw new Error("AI Gateway was not found.");
  }
  const current: unknown = await currentResponse.json();
  if (
    !currentResponse.ok ||
    !isRecord(current) ||
    current.success !== true ||
    !Array.isArray(current.result)
  ) {
    throw new Error("AI Gateway lookup failed.");
  }
  if (current.result.length === 0) {
    throw new Error("AI Gateway list was empty.");
  }
  const matchingGateways = current.result.filter(
    (gateway): gateway is Record<string, unknown> =>
      isRecord(gateway) &&
      typeof gateway.id === "string" &&
      gateway.id.length >= 1 &&
      gateway.id.length <= 64 &&
      (gateway.id === AI_GATEWAY_APPROVED_ID_OR_NAME ||
        gateway.name === AI_GATEWAY_APPROVED_ID_OR_NAME),
  );
  if (matchingGateways.length === 0) {
    throw new Error("AI Gateway identity did not match.");
  }
  if (matchingGateways.length !== 1) {
    throw new Error("AI Gateway lookup failed.");
  }
  const gatewayId = matchingGateways[0]!.id as string;
  const endpoint = `${listEndpoint}/${encodeURIComponent(gatewayId)}`;

  const detailResponse = await fetchImplementation(endpoint, { headers });
  if (detailResponse.status === 401 || detailResponse.status === 403) {
    await detailResponse.body?.cancel();
    throw new Error("AI Gateway lookup authorization failed.");
  }
  if (detailResponse.status === 404) {
    await detailResponse.body?.cancel();
    throw new Error("AI Gateway was not found.");
  }
  const detail: unknown = await detailResponse.json();
  if (
    !detailResponse.ok ||
    !isRecord(detail) ||
    detail.success !== true ||
    !isRecord(detail.result)
  ) {
    throw new Error("AI Gateway lookup failed.");
  }
  if (hasExactSpendLimit(detail.result)) return createBudgetEvidence();

  const spendLimits = Object.freeze({
    enabled: true,
    rules: Object.freeze([
      Object.freeze({
        enabled: true,
        limit: AI_GATEWAY_LIMIT_DOLLARS,
        limitType: "cost" as const,
        technique: "fixed" as const,
        window: AI_GATEWAY_WINDOW_SECONDS,
      }),
    ]),
  });
  const updateResponse = await fetchImplementation(endpoint, {
    method: "PUT",
    headers,
    body: JSON.stringify({ spend_limits: spendLimits }),
  });
  if (updateResponse.status === 401 || updateResponse.status === 403) {
    await updateResponse.body?.cancel();
    throw new Error("AI Gateway update authorization failed.");
  }
  if (updateResponse.status === 400 || updateResponse.status === 422) {
    await updateResponse.body?.cancel();
    throw new Error("AI Gateway update request was invalid.");
  }
  if (updateResponse.status === 404) {
    await updateResponse.body?.cancel();
    throw new Error("AI Gateway update target was not found.");
  }
  const updated: unknown = await updateResponse.json();
  if (
    !updateResponse.ok ||
    !isRecord(updated) ||
    updated.success !== true
  ) {
    throw new Error("AI Gateway update failed.");
  }
  if (!hasExactSpendLimit(updated.result)) {
    throw new Error("AI Gateway budget verification failed.");
  }

  return createBudgetEvidence();
}

/** Executes the preview operator action while emitting only allowlisted evidence. */
async function main(): Promise<void> {
  try {
    const evidence = await configureAiGatewayBudget({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
      apiToken: process.env.CLOUDFLARE_API_TOKEN ?? "",
    });
    process.stdout.write(`${JSON.stringify(evidence)}\n`);
  } catch (error) {
    const category = classifyAiGatewayBudgetError(error);
    process.stderr.write(
      `${JSON.stringify({ configured: false, errorCategory: category })}\n`,
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main();
}
