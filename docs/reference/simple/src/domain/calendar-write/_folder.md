# `src/domain/calendar-write`

This folder prepares and executes calendar changes safely. It shows what would
change, requires confirmation and a fresh target version, and keeps uncertain
provider results pending until an exact read-back proves the event state.
