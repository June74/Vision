# `src/client/calendar/writes/`

The browser write client is provider-free. Mutation helpers send same-origin
credentials and the existing CSRF token; response parsing accepts only the
public operation/preview/status shape. Proposal content, calendar authority,
provider event identity, versions, and tokens never enter browser storage.
