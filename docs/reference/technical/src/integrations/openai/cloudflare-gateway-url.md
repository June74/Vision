# `src/integrations/openai/cloudflare-gateway-url.ts`

This module pins provider credentials and minimum calendar context to the canonical Cloudflare AI Gateway origin and provider-specific OpenAI path.

## `parseCloudflareOpenAiGatewayBaseUrl`

**Signature:** `(value: unknown) => string`

The parser rejects non-strings, surrounding or embedded control whitespace, percent encoding, backslashes, user information, non-default ports, query/fragment data, URL canonicalization differences, and any hostname other than `gateway.ai.cloudflare.com`. The path must be exactly `/v1/{32-lowercase-hex-account-id}/{bounded-unreserved-gateway-id}/openai`. Already-suffixed endpoints and traversal-like forms have no accepted representation. The returned string is therefore safe for direct `"/responses"` suffix construction.
