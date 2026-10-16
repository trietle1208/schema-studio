# FilterBuilder

A filter written by choosing instead of typing: the table, groups of conditions that nest, the columns, a sort and a limit, with the SQL it writes as the summary. It keeps nothing: `value` is the query and `onChange(query)` hears every change. `QueryConsole` is its host.

- Props: `value` (the query: `{ table, where, columns, sort, limit }`; `defaultQuery(table)` makes an empty one), `onChange(query)`, `tables`, `showErrors` (put each problem under its row, and the count in the side), `actions` (under the SQL: the console's **Run**), `onEditSql(sql)` (shows **Edit as SQL**), `columnsOpen` (start with the Columns menu open).
- `where` is a **group**: `{ op: 'AND' | 'OR', items }`; an item is a **condition** `{ column, op, value, value2 }` (what was typed, as text) or another group.
- Layout: the conditions on the left, **Output** on the right (400px wide; under the conditions when the console is narrower than 820px).

## The conditions
- **FROM** a `Select` of the tables (changing it starts a new query) and **Clear all** (off when there is nothing to clear).
- A **group** is `AND | OR` (a `SegmentedControl`) with what it says in words ("All of these must match" / "Any of these may match"), its conditions, **Add condition** and **Add group**. A group inside another is set in by a hairline (`line-3`, 12px) and has Remove group; the first one is the whole `WHERE` and cannot be removed. An empty one says so ("No conditions. Every row of users matches."; "This group is empty. Add a condition or remove it.").
- A **condition** is a row: column (`Select`, mono) · operator (`Select`, mono) · value (`Input`, mono) · remove. The operators follow what the column holds:
  - text: `=` `≠` `contains` `starts with` `IS NULL` `IS NOT NULL`
  - number: `=` `>` `<` `between` `IS NULL` `IS NOT NULL`
  - date and timestamp: `before` `after` `between` `IS NULL` `IS NOT NULL`
  - boolean: `=` (a `Select` of true and false) `IS NULL` `IS NOT NULL`
  Changing the column keeps the operator when the new column has it and the value when it holds the same kind. `IS NULL` has no value ("No value needed"); `between` has two, joined by "and". `contains` and `starts with` write `ILIKE` and escape `%`, `_` and `\`.
- **Problems** (shown with `showErrors`): "Value cannot be empty.", "Value must be a number.", "Invalid timestamp format." (or date, time) under the row, the input in `removed`, and in the side "Complete or remove 2 conditions to run." The SQL leaves out a condition that is not complete.

## Output
- **Columns:** a button "All 5 columns" / "3 of 5 columns" that opens the same menu as the data toolbar's Columns.
- **Sort:** a column (or None) and `ASC | DESC` (off until a column is chosen). **Limit:** 10, 25, 50, 100 (default), 500, 1000 or No limit.
- **SQL:** the query written out, highlighted with `highlightSql`, with Copy and **Edit as SQL**. `SELECT *` when every column is chosen.

`buildQuery(spec, table)` is the same SQL as a string, `queryProblems(spec, table)` the conditions that cannot be written (`{ path, message }`).
