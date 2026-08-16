# `src/client/calendar/`

This presentation boundary consumes only authenticated, allowlisted event display fields. It renders a bounded semantic list and submits explicit category corrections to Vision. Phase C adds a separate `OneOffEventComposer` that consumes only the server-returned immutable preview; edit, move, cancel, and direct-delete operations remain absent.
