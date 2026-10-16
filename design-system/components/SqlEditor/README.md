# SqlEditor

A lightweight SQL editor: line-number gutter, syntax highlighting with the `syn-*` tokens, horizontal scroll, and an error-line marker. `ParseStatus` reports the parse result under it.

- `SqlEditor` props: `value` + `onChange` (controlled) or `defaultValue`, `height`, `errorLine`, `firstLine`, `readOnly`, `placeholder`, `label`, `language` (`sql`, or `json` for keys, strings, numbers and `true` / `false` / `null`; the `RecordEditor` uses it; or `text` for no highlighting at all: Import Records pastes CSV into it).
- `ParseStatus` props: `state` (`idle` | `parsing` | `ok` | `error`), `summary` (e.g. "24 tables · 31 relationships · 18 indexes"), `message`, `onJump`, `aside`.
- Parse errors name the line: "Unable to parse SQL near line 42." and offer Go to line.
- Query mode uses it for a `SELECT`: `ORDER BY`, `LIMIT`, `LIKE`, `BETWEEN`, `ASC`, `DESC`, `AS`, `TRUE` and `FALSE` are keywords too, and `errorLine` marks the line a query failed on.
