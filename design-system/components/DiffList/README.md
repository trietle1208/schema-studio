# DiffList

Schema changes grouped by Tables, Columns, Indexes and Relationships. Each row has an op tile (`+` added, `~` changed, `−` removed), the mono path and a detail line.

- Props: `groups` (`[{group, items:[{op:'add'|'mod'|'del', path, detail}]}]`), `selected`, `onSelect(path)`, `showGroups`, `showDetail`, `showKind`. `DiffRow` renders a single item.
- Removed paths are struck through. The glyph always carries the meaning; colour only reinforces it.
