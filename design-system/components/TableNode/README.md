# TableNode

One table on the ER canvas: header with table icon, name and column count, then one 24px row per column with key glyph, name, type and flags.

- Props: `table` (`{name, schema?, columns:[{name,type,nullable,pk?,unique?,fk?:{table,column}}]}`), `x`, `y` (or `static` for flow layout), `selected`, `selectedColumn`, `onSelect(name)`, `onSelectColumn(index)`, `dimmed`, `dragging`, `dirty`, `invalidColumns`, `state` (`added` | `removed` for diff views), pointer handlers.
- Row grammar: key glyph in `pk`, link glyph in `fk`; type in `ink-2`; a trailing `?` marks a nullable column; `UQ` marks unique. The canvas legend restates this.
- Selected nodes get an `accent` outline; the selected column gets `accent-subtle`. Draft rows are `modified-subtle`, invalid rows `removed-subtle` with an italic "unnamed".
- The header is the drag handle; rows select columns.
