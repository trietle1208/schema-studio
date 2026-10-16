# QueryConsole

Query mode (the **Query** of the toolbar's Diagram / Data / Query): a console over the rows of the sample. A **Builder** or an **SQL** editor on top, **Results / Messages / Plan** below, divided by a line the person drags. It fills the work area (`.ss-work`) and keeps its own state and its own working copy of the rows; a row edited in the `RecordEditor` is changed there and the results follow.

- Header: **Query**, a `Badge` `Sample data` (the rows are made for the schema), `Builder | SQL`, **Save query** and **History**. Under 600px (beside the record editor) the two buttons keep only their icons.
- **Run** is the primary button of the top pane, with ⌘⏎ (Ctrl on Windows) from anywhere in the console. Nothing runs by itself: editing conditions or SQL leaves the last results where they are. A run that fails replaces them.
- Props: `tables`, `data` (rows by table name), `onRun(entry)`, `onSaveQuery(entry)`, `onSaveRecord(table, row, saved)`. To start somewhere (a preview, a test): `mode` (`builder` | `sql`), `spec` (the Builder's query, see `FilterBuilder`), `sql`, `error` (the sample SQL with a mistyped column on line 7, already run), `run` (run it as the console opens), `duration` (the ms it shows; otherwise the measured time, at least 1), `tab`, `height` (of the results, 380 by default), `saved`, `recent`, `attempted` (Run was pressed with conditions to fix), `historyOpen`, `saveOpen`, `running` (a skeleton, Run off), `openRow` (a row of the results that starts open in the editor).

## Builder
`FilterBuilder` and, in the side column, **Run**. Going to **SQL** carries over the SQL the builder wrote unless the editor was already edited by hand; **Edit as SQL** always does. Coming back keeps the builder as it was.

## SQL
`SqlEditor` with the sample query. A row of tools: **Run** (⌘⏎), **Format**, **Clear**, and on the right the state: `Ran in 12 ms`, or `Failed` with **Show messages**.
- **Format** writes the query as the Builder does (one clause to a line, `AND` / `OR` under the first condition, the column list on one line when it fits). A query that cannot be read, or has comments (they would be lost), is left as it is and the status says why: "Unable to parse SQL near line 1."
- **Clear** empties the editor and offers **Undo** in the status until the next change.
- An error marks its line on the editor (`errorLine`, `removed` fill and a dashed line, the number in `removed`) for as long as the editor holds the text that failed.

## Output
A panel divided from the top by a hairline that is dragged (`ResizeHandle` with `edge="top"`: 120–640px, double click for 380, ↑ ↓ move it by 16). `Results`, `Messages` and `Plan` are tabs (← → move between them). On the right: `100 rows · 12 ms` and **Export** (CSV, JSON, Copy as JSON).
- **Results:** a `DataGrid` of regular rows without checkboxes; a double click or ⏎ on a row opens it in the `RecordEditor` (a row with changes asks "Discard changes to users · id = 1099?" before another opens). At most 1,000 rows are shown. **Never a grid for a query that failed:** the tab says "The query did not run." with **Show messages**, and a console that has not run says "No results yet." with **Run**. A query that matches nothing is a result, not an error: the headers and "No rows match the query." with "1,248 rows were read from users."
- **Messages:** a failed query is an `Alert` `error`: `column "countr" does not exist.`, the line in mono (`Line 7`) and **Go to line**, which puts the caret on it in the editor (only in SQL mode, while the editor holds that text). Errors say what the database says, ending in a period: `relation "usres" does not exist.`, `invalid input syntax for type bigint: "abc".`, `Only SELECT statements can be run in Query mode.`; a query that cannot be read is "Unable to parse SQL near line 7." The tab's count turns `removed`. A run that worked says `Query returned 100 rows in 12 ms.` and, when a limit cut it, `1,061 rows matched. Showing the first 100 (LIMIT 100).`; saving a record and exporting add their own lines.
- **Plan:** what was scanned, filtered, sorted and cut, each step with the rows it holds, as lines of mono text, then `Execution time: 12 ms`.

## History and Save query
- **Save query** opens a popover with one input, "Query name": empty is "Query name cannot be empty.", a name in use is `A saved query named "x" already exists.`. A query saved from the Builder goes back to the Builder.
- **History** lists **Saved** (the name, the SQL on one line under it) and **Recent** (the SQL on one line, `12 ms · 2 min ago`, or `Failed · 1 h ago` in `removed`); a click loads the query into its editor and closes the popover. Both popovers close on Esc and on a press outside.

## What runs
Only a `SELECT` from one table: `*` or columns (`AS` renames), `WHERE` with `AND`, `OR`, `NOT`, parentheses, `= <> < > <= >=`, `LIKE`, `ILIKE`, `IS [NOT] NULL`, `[NOT] BETWEEN`, `[NOT] IN (…)`, `ORDER BY` (NULLs last when ascending, as PostgreSQL has it), `LIMIT`, `OFFSET`. A literal the column cannot take is refused before anything is read. Another statement is refused with "Only SELECT statements can be run in Query mode.".

Helpers on `window.SchemaStudio` for the port and its tests: `defaultQuery`, `queryOps`, `queryProblems`, `buildQuery`, `parseQuery`, `formatQuery`, `runQuery`, `queryPlan`. `sample.query` holds `sql`, `badSql`, `spec`, `saved` and `recent`.
