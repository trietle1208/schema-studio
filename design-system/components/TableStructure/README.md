# TableStructure

The Structure tab of a table: its columns, one per row, in a `DataTable`.

- Props: `table` (`Table`). Read only: columns are edited in the inspector of the diagram, not here.
- Columns: `#` (position), Column (key glyph, name in mono: `pk` amber key, `fk` teal link), Type (mono `ink-2`), Nullable (`NULL` / `NOT NULL`), Default (mono, `—` when there is none) and Keys (`PK`, `UQ` and, for a foreign key, a `fk` badge with the column it points to: `users.id`).
- The table's comment, when it has one, is a line above the list in `ink-2`.
- The list sits in a hairline card on the `bg-1` pane (`.ss-pane`, `.ss-pane-card`); rows are 36px and nothing in it sorts.
