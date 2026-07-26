# `src/client/calendar/CategoryControl.tsx`

## `CategoryControl`

Shows whether a category was suggested, needs attention, or was set by the owner. Its selector changes Vision only, never Google Calendar, and stays focused while a save is running.

## `selectCategory`

Saves school, work, or personal once. It announces saving, success, or a safe retry message and ignores another change until the current save finishes.

## `formatCategoryMark`

Writes the visible category and its source in words so color is not required.
