# DataToolbar

The tools over the grid of a table: find rows, narrow them, order them, choose what is shown.

- Props: `columns` (the table's `Column[]`, for the menus), `search` / `onSearch`, `filters` (`RecordFilter[]`) with `onAddFilter(filter)`, `sort` (`{column, dir}` or null) with `onSort`, `hidden` (names of the columns not shown) with `onHidden(names)`, `density` (`regular` | `compact`) with `onDensity`, `pageSize` (25, 50, 100 or 200) with `onPageSize`, `onRefresh`, `loading` (disables Refresh).
- Left to right: **Search records…**, **Filter**, **Sort**, **Columns**; at the right the density `SegmentedControl` (Regular / Compact), the rows-per-page `Select` ("50 rows") and Refresh. One row of 28px controls on `bg-2`; on a pane too narrow for them the groups wrap to a second line instead of overflowing.
- **Filter** shows the number of filters in an `accent` badge and opens a popover: column, operator (`=`, `!=`, `>`, `>=`, `<`, `<=`, `LIKE`, `IS NULL`, `IS NOT NULL`), a value (hidden for the two NULL tests) and Add filter (⏎). A value is read by the column's type: a number, `true` / `false`, or text; a value that does not fit says so under the field ("Value must be a number."). The filters themselves are listed by `FilterChips`.
- **Sort** opens a `ContextMenu` of the columns: a column sorts ascending, then descending, then not at all. The button shows the sorted column (`created_at ↓`); pass the same `sort` to `DataGrid` to mark its header.
- **Columns** opens a popover with a checkbox per column and the number shown ("4 of 5 columns"); the last column shown cannot be unticked; Show all brings the rest back. The button counts what is hidden ("1 hidden").
- Popovers close on Esc and on a press outside; only the menu closes on Esc.
