# `src/integrations/openai/cloudflare-gateway-url.ts`

This module accepts only Vision's canonical Cloudflare AI Gateway base URL for the OpenAI provider.

## `parseCloudflareOpenAiGatewayBaseUrl`

Requires HTTPS, Cloudflare's exact AI Gateway hostname, a bounded account ID and gateway ID, and the provider path ending in `/openai`. It rejects credentials, ports, redirects encoded into paths, query strings, fragments, suffixes, and other hosts.
