# `src/domain/categorization/category.ts`

This module keeps Vision's internal categories predictable. A user's direct category wins; otherwise a confirmed source wins; otherwise Vision may show an inferred category; unclear items stay unresolved.

## `DomainSchema`

`DomainSchema` allows school, work, personal, and unresolved.

## `DomainStateSchema`

`DomainStateSchema` marks a category as confirmed, inferred, or unresolved.

## `isValidDomainStateCombination`

`isValidDomainStateCombination` allows unresolved only with unresolved, and a concrete category only with confirmed or inferred.

## `resolveDomain`

`resolveDomain` applies the approved category order and returns the category plus the reason it was chosen.
