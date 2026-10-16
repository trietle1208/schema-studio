# TableHeader

The head of the Data mode: which table this is, how big, what can be done to it, and which view of it is open.

- Props: `table` (`Table`), `schema` (the schema's name, for the crumb), `engine`, `rows` (record count; left out while it is not known), `relationships` (count shown on its tab), `tab` (`data` | `structure` | `relationships`) with `onTab(tab)`, `onAdd`, `onImport`, `onExport`, `onRefresh`, `menuItems` (items of the more menu; the default is Open in Diagram, Copy table name, Copy CREATE TABLE), `loading` (disables Refresh).
- **Crumb** `ecommerce / public / users` in mono `ink-3`, the table in `ink-2`. **Title row:** the table name in mono 600 (`code-strong`, at the 14/20 size of the inspector title), the engine `Badge`, and "1,248 rows · 5 columns" in `code-sm` `ink-3`. Counts keep their thousands separator and say "1 row", "1 column".
- **Actions**, right aligned: Refresh and More (icon buttons), Import Records and Export (secondary), Add record (primary, ⌘⏎). Add record is the one primary of the pane; the Export of the toolbar is the schema's, this one is the table's records.
- **Tabs** Data / Structure / Relationships: a 2px `accent` underline on the open one, `ink-2` on the others, the number of columns and of relationships in mono `ink-3`. Left and right arrows move between tabs. Structure is `TableStructure`, Relationships is `TableRelationships`; Data is the toolbar, the chips and the grid.
- The More menu is a `ContextMenu` under the button; Esc or a press outside closes it.
