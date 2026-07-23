# `src/domain/graph/edge.ts`

This module defines strict discriminated edge families rather than allowing arbitrary graph predicates. The edge record carries its origin, evidence, optional confidence, lifecycle, privacy, validity, and positive version.

## `EdgeSchema`

Each relation literal fixes legal `sourceType` and `destinationType`, so invalid relation families fail parsing before persistence.

## `validateEdge`

**Signature:** `validateEdge(edge: Edge, source: NodeEnvelope, destination: NodeEnvelope): Edge`

The function revalidates all three inputs, verifies supplied endpoint IDs and types, rejects cross-owner links, and requires the edge privacy level to preserve both endpoint protections. It throws on violated graph invariants and has no side effects. Covered by `tests/unit/domain/graph.test.ts`.
