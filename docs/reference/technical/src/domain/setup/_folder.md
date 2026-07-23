# Calendar setup domain rules

This folder owns the provider-independent, optimistic-concurrency state machine for one secondary-calendar connection. It produces intent states only; adapters perform discovery, idempotent creation, and persistence. Event-write capability is deliberately absent.
