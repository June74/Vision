# Authentication diagnostics

Temporary instrumentation with preview-only response disclosure records which Google OAuth stage failed.
`AUTH_DIAGNOSTIC_STAGES` is a closed literal set authored in this module, so the only values that can
reach a log sink, response header, or failure page are constants chosen here. No authorization code,
state, PKCE verifier, nonce, cookie, provider token, claim, email, subject, or binding secret is read,
copied, or formatted by any function in this module.

## Signatures

```ts
class AuthStageError extends Error { readonly stage: AuthDiagnosticStage }
runAuthStage<Result>(stage: AuthDiagnosticStage, operation: () => Result | Promise<Result>): Promise<Result>;
readAuthDiagnosticStage(error: unknown): AuthDiagnosticStage;
readAuthFailureCause(error: unknown): unknown;
readPreviewDiagnosticStage(environment: string | undefined, stage: AuthDiagnosticStage): AuthDiagnosticStage | undefined;
```

## Dependencies

None. The module imports nothing and depends on no runtime, network, database, or logging boundary,
which keeps it usable from both the route layer and `src/server/logging.ts` without an import cycle.

## Inputs and outputs

Accepts a constant stage code, a caller-supplied operation, an arbitrary thrown value, and the
deployment environment string. Returns the operation's result, a stage code from the closed set, the
original thrown value, or `undefined` outside preview. It never derives an output from a thrown value.

## Side effects

None. `runAuthStage` only awaits the supplied operation and rewraps a thrown value; it performs no
network, database, cookie, response, or logging work of its own.

## Failure behavior

Any non-`AuthStageError` throw becomes an `AuthStageError` carrying the constant stage and the original
value as `cause`. An already-tagged failure keeps its inner, more precise stage rather than being
relabeled by an outer stage. Callers that must branch on a domain error read `readAuthFailureCause`.

## Privacy and authorization

The module authorizes nothing. Its privacy guarantee is structural: the emitted value is always a
member of `AUTH_DIAGNOSTIC_STAGES`, the wrapper's message is the constant `AUTH_STAGE_FAILED`, and the
retained `cause` is never stringified into a response or an audit event. `readPreviewDiagnosticStage`
is the single gate that keeps categories out of local and production responses.

## Covering tests

`tests/worker/auth.test.ts` covers preview stage naming for missing state, provider exchange failure,
rejected scopes, a denied account, and unresolved bindings, plus byte-identical production and local
failure pages and the absence of state, code, email, subject, and binding text in every output.
It also covers Phase C recovery conflicts and thrown failures using the constant
`callback_authorization_recovery_failed`, while retaining the original audit error category
and refusing session issuance. `tests/unit/server/logging.test.ts` verifies the closed log enum.

## `runAuthStage`

Awaits the operation and, on any throw, raises an `AuthStageError` holding the constant stage code.
An inner tag wins over an outer one, so the reported stage is the deepest one that actually failed.

## `readAuthDiagnosticStage`

Returns the tagged stage, defaulting to `unclassified` for a value thrown outside a wrapped stage.

## `readAuthFailureCause`

Unwraps one stage tag to the original thrown value, letting the callback route keep returning the
constant 403 access-denied page for `IdentityAuthorizationError` after stage tagging was introduced.

## `readPreviewDiagnosticStage`

Returns the stage only when the deployment environment is exactly `preview`, and `undefined` otherwise.
This is the single decision point that keeps local and production output constant.
