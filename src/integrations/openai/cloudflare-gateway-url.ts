/** Validates the one canonical Cloudflare AI Gateway OpenAI base URL shape. */

const CLOUDFLARE_AI_GATEWAY_HOSTNAME = "gateway.ai.cloudflare.com";
const CLOUDFLARE_ACCOUNT_ID_PATTERN = /^[a-f0-9]{32}$/u;
const CLOUDFLARE_GATEWAY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,63}$/u;

/** Parses and returns a canonical provider-specific Cloudflare OpenAI base URL. */
export function parseCloudflareOpenAiGatewayBaseUrl(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 2_048 ||
    value !== value.trim() ||
    /[%\\\u0000-\u0020\u007f]/u.test(value)
  ) {
    throw new Error("Cloudflare AI Gateway configuration is invalid.");
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Cloudflare AI Gateway configuration is invalid.");
  }

  const segments = parsed.pathname.split("/");
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== CLOUDFLARE_AI_GATEWAY_HOSTNAME ||
    parsed.host !== CLOUDFLARE_AI_GATEWAY_HOSTNAME ||
    parsed.port !== "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    parsed.toString() !== value ||
    segments.length !== 5 ||
    segments[0] !== "" ||
    segments[1] !== "v1" ||
    !CLOUDFLARE_ACCOUNT_ID_PATTERN.test(segments[2] ?? "") ||
    !CLOUDFLARE_GATEWAY_ID_PATTERN.test(segments[3] ?? "") ||
    segments[4] !== "openai"
  ) {
    throw new Error("Cloudflare AI Gateway configuration is invalid.");
  }

  return value;
}
