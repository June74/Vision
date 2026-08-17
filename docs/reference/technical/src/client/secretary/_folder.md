# `src/client/secretary`

Browser adapters for the authenticated local-secretary routes. Responses are
allowlisted before rendering; state-changing calls carry the existing session
CSRF token, and no calendar operation handle is created by this surface.
