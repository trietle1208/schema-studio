# TableList

The left panel of the Data and Query modes: the tables of the schema with how many records each holds, to pick the one to work on.

- Props: `tables` (`Table[]`), `counts` (record count by table name; a table without one shows no number), `selected` (table name), `onSelect(name)`, `search` and `onSearch(q)` (controlled; the list keeps the text itself when `search` is left out).
- Fixed 240px wide on `bg-2`, a hairline on its right. Header is the "Tables" eyebrow with the number of tables in mono; under it a small search field that filters by name; the footer says "5 tables · 80 rows".
- A row is a 14px `table` icon, the name in mono and the record count in mono `ink-3` (`ink-2` on the selected row, which is `bg-5`). Hover is `bg-4`. Rows are 28px, like the sidebar.
- No match says `No tables match "x".`; the panel never holds actions, only the choice of a table.
