# `src/data/schema/annotations.ts`

`node_annotations` stores Vision-written annotation text only as encrypted bytes attached to a stable node.

`node_category_assignments` records who explicitly assigned a personal, work, or school category. This provenance is
separate from the provider provenance of the event itself, so a Google rebuild cannot reassign the user's category.
