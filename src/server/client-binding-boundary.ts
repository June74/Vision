/** Defines the authoritative client-safe and client-forbidden Vision binding-name inventory. */
import { TEMPORARY_PREVIEW_FAULT_SCENARIOS } from "../domain/operations/temporary-preview-fault";

/** Runtime binding names that must never appear in a built client asset. */
export const RUNTIME_CLIENT_FORBIDDEN_BINDING_NAMES = [
  "BACKUP_ENCRYPTION_KEY",
  "DATABASE_URL",
  "DATABASE_USAGE_WARNING_BYTES",
  "GOOGLE_ALLOWED_EMAIL",
  "GOOGLE_ALLOWED_SUB",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "KEY_ENCRYPTION_KEY",
  "OPENAI_API_KEY",
  "PREVIEW_ACCEPTANCE_SCENARIO",
  "PREVIEW_RESTORE_DATABASE_URL",
  "PREVIEW_RESTORE_TARGET_ID",
  "R2_USAGE_WARNING_BYTES",
  "R2_USAGE_WARNING_OBJECTS",
] as const;

/** Temporary server-only activation values that must not enter a built client asset. */
export const CLIENT_FORBIDDEN_RUNTIME_VALUES =
  TEMPORARY_PREVIEW_FAULT_SCENARIOS;

/** Runtime binding names whose names are not themselves sensitive client material. */
export const CLIENT_SAFE_RUNTIME_BINDING_NAMES = [
  "AI_COMPLEX_WORST_CASE_CENTS",
  "AI_INPUT_CENTS_PER_MILLION_TOKENS",
  "AI_MONTHLY_HARD_LIMIT_CENTS",
  "AI_OPTIONAL_WORST_CASE_CENTS",
  "AI_OUTPUT_CENTS_PER_MILLION_TOKENS",
  "AI_ROUTINE_WORST_CASE_CENTS",
  "BACKUP_KEY_VERSION",
  "GOOGLE_REDIRECT_URI",
  "OPENAI_GATEWAY_BASE_URL",
  "VISION_ENV",
  "VISION_USER_TIME_ZONE",
] as const;

/** Complete server/deployment binding-name denylist used by the built-client scanner. */
export const CLIENT_FORBIDDEN_BINDING_NAMES = [
  ...RUNTIME_CLIENT_FORBIDDEN_BINDING_NAMES,
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_ACCOUNT_ID_PREVIEW",
  "CLOUDFLARE_ACCOUNT_ID_PRODUCTION",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_API_TOKEN_PREVIEW",
  "CLOUDFLARE_API_TOKEN_PRODUCTION",
] as const;
