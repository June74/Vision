# `src/domain/categorization/category.ts`

This module keeps Vision's internal categories predictable. A user's direct category wins; otherwise a confirmed source wins; otherwise Vision may show an inferred category; unclear items stay unresolved.

## `DomainSchema`

`DomainSchema` allows school, work, personal, and unresolved.

## `DomainStateSchema`

`DomainStateSchema` marks a category as confirmed, inferred, or unresolved.

## `resolveDomain`

`resolveDomain` applies the approved category order and returns the category plus the reason it was chosen.
