# DataTable

Dense, sortable list used on the Schemas screen and anywhere records are compared row by row.

- Props: `columns` (`{key, label, width, align, numeric, sortable, render(row)}`), `rows`, `rowKey`, `sort` (`{key, dir}`), `onSort(sort)`, `selectedKey`, `onRowClick(row)`.
- Headers are `caption` style and sticky; the sorted column shows an arrow and turns `ink-1`. Rows are 44px with hairline separators, `bg-3` on hover and `bg-5` when selected. Row actions (`.ss-table-actions`) appear on hover.
- Numbers are right-aligned mono.
