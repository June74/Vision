# `src/client/auth/SignIn.tsx`

Renders non-authenticated shell states and delegates authorization start to the server route.

## `SignIn`

Selects signed-out, access-denied, or safe-unavailable copy. It receives no token-bearing values.

## `startGoogleSignIn`

Navigates to `/api/auth/google/start`; OAuth state and credentials remain server-owned.
