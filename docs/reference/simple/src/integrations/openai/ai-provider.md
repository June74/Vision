# `src/integrations/openai/ai-provider.ts`

`AiProvider` is a replaceable interface that accepts approved category context and returns an untrusted `CategoryProposal`. It does not provide tools or direct calendar access.

`CategoryProposalRequest` carries an opaque subject ID, evidence IDs, policy version, and caller-approved context.
