# TableHeader

The head of the Data mode: which table this is, how big, and which view is open.

- Props: `table` (`Table`), `schema` (the schema's name, for the crumb), `engine`, `rows` (record count; left out while it is not known), `relationships` (count shown on its tab), `tab` (`data` | `structure` | `relationships`) with `onTab(tab)`. Action handlers (`onAdd`, `onImport`, `onExport`, `onRefresh`, `menuItems`) remain accepted for compatibility; the Data toolbar owns those actions now.
- **Crumb** `ecommerce / public / users` in mono `ink-3`, the table in `ink-2`. **Title row:** the table name in mono 600 at 20px, the engine `Badge`, and "1,248 rows · 5 columns" (plus `· InnoDB` for MySQL) in `code-sm` `ink-3`.
- **Tabs** Data / Structure / Relationships with icons: a 2px `accent` underline and `accent-text` on the open one; counts for Structure and Relationships in mono `ink-3`. Left and right arrows move between tabs. Structure is `TableStructure`, Relationships is `TableRelationships`; Data is the toolbar, the chips and the grid.
