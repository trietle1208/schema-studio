# SelectionBar

What can be done to the rows that are ticked in the grid.

- Props: `count` (rows selected), `onCopy`, `onExport`, `onDelete`, `onClear`. Draw it only while `count` is above zero; it appears and goes without animation, and the grid below it moves.
- Left to right: "3 rows selected" in mono (says "1 row selected" for one), **Copy as JSON**, **Export selected**, **Delete selected** (`danger-ghost`, ⌫) and, at the right, an × that clears the selection (Esc does the same in the grid).
- 36px high on `accent-subtle` with an `accent-line` hairline under it, the colour of a selected row. Never destructive on its own: Delete selected opens a `ConfirmDialog` ("Delete 3 rows from "users"?") that states what follows (see `DataGrid`).
- Sits between `FilterChips` (when there are any) and the grid.
