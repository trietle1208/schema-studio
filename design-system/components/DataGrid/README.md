# DataGrid

The records of one table, as a grid. Not a `DataTable`: it is for reading and editing values cell by cell, so it is denser, scrolls both ways and keeps its headers and first column in view.

- Props: `columns` (a table's `Column[]`, each may carry `width`), `rows` (objects keyed by column name), `selected` (row indexes) with `onSelect(indexes)`, `activeCell` (`{row, column}`) with `onActiveCell(cell)`, `modified` (`{row, column}[]`), `onOpenRow(index)` (double click or ⏎), `loading`, `empty` (`true` for the default message or any node), `density` (`regular` 28px rows, `compact` 24px) and `label`.
- **Header** (sticky): the key glyph (`pk` amber key, `fk` teal link), the column name in mono and its type in `ink-3`. The row-number gutter and the first column are sticky too; the grid scrolls sideways under them.
- **Gutter:** the row number in mono `ink-3`; on hover, or when the row is selected, a checkbox takes its place. The header's checkbox selects all rows.
- **Cells:** `NULL` is the `.ss-null` token (mono, `ink-3`), never an empty cell. Text is cut with an ellipsis and carries its full value as a title. Numbers are mono and right-aligned (a `DECIMAL(12,2)` always shows two decimals), timestamps are `YYYY-MM-DD HH:mm:ss`, booleans are `true` / `false`.
- **States:** hover `bg-4`; selected row `accent-subtle`; active cell a 2px `accent` outline; a modified cell `modified-subtle` (pair it with the Unsaved changes status of the toolbar). Arrow keys move the active cell, ⏎ opens the row, Space selects it.
- `loading` shows 12 static skeleton rows, no animation. `empty` shows its message under the header.
- Values are `null`, numbers, booleans or strings; the grid does not edit anything by itself.
