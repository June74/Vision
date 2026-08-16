# `src/client/calendar/writes/`

This small client boundary talks to the authenticated Phase C preview, status,
confirmation, and undo routes. It stores only an opaque operation handle so a
reload can ask the server for the truth again.
