# Google Calendar setup integration

Owns fixed CalendarList, Calendars, read-sync, and bounded one-off event-write
endpoints. Setup retains bounded pagination, exact creation payloads, and
verified-subject ownership binding; event writes use a separate provider port
with private idempotency markers, exact read-back, and constant error
classification.
