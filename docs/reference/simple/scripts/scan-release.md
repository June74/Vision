# Release security scanner

This script checks the exact local evidence that can safely be inspected before a Phase B release. It looks for the protected test marker in built browser files and synthetic log, audit, queue, raw-database, and unencrypted-R2 evidence. It also blocks server-only secret binding names from browser assets and blocks Google Calendar event-write calls or Worker event-write routes.

The scanner reports only a safe category and repository-relative file name. It never prints matched text.

## `scanRelease`

Scans one project root and returns every safe release-boundary violation. Missing, unreadable, oversized, or symbolic-link evidence fails closed instead of being skipped.
