# TableStructure

The Structure tab of a table: its columns and indexes, read only (columns are edited in the inspector of the diagram).

- Props: `table` (`Table`); optional `onOpenColumn(name)` (double click or the layers action: Diagram with that column selected), `onOpenRelationships()` (FK badge), `onCopyColumn(name)`.
- **Summary** above the tools: mono counts joined by a middle dot (`5 columns · 1 PK · 2 FK · 3 nullable · 2 indexes`), only the counts that are above zero.
- **Toolbar:** Filter columns…, All / Keys / Nullable, Regular / Compact. Search matches name, type, default, comment and `table.column` of a foreign key; Keys keeps PK / FK / UQ; Compact is 28px rows.
- **Columns** group: `#`, Column (key glyph + mono name), Type, Nullable (`NULL` / `NOT NULL`), Default (`—` when none), Comment, Keys (`PK`, `UQ`, FK badge → Relationships), and hover actions (copy name, Open in Diagram). Row click selects; double click opens the column in Diagram.
- **Indexes** group: name, type, using, columns. Empty copy when the table has none, or when the search matches none.
- The table's comment, when it has one, is a line above the summary in `ink-2`.
- Lists sit in hairline cards on the `bg-1` pane (`.ss-pane`, `.ss-pane-card`); nothing in them sorts.
