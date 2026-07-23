# Calendar client

Lists, creates, and verifies only the secondary `Vision` calendar; no event API exists here.

## `listOwnedSecondaryCalendars`
Returns exact-name, owned, active, non-primary candidates.
## `createSecondaryCalendar`
Sends only `Vision` and the configured time zone.
## `getCalendar`
Rechecks one encoded stable ID.
## `request`
Adds server authorization and hides raw failures.
## `readBoundedJson`
Reads only small valid JSON responses.
## `isOwnedVisionEntry`
Applies the complete candidate rule.
## `bindOwnership`
Binds evidence to the verified Google account.
## `isBoundedText`
Checks nonempty text size.
