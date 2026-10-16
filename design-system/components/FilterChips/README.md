# FilterChips

The filters that are applied to a table, as the conditions they are.

- Props: `filters` (`RecordFilter[]`: `{column, op, value?}`), `onRemove(index)`, `onClear`. With no filters it draws nothing.
- A chip is the condition written as SQL, in mono: `created_at > '2026-01-01'`, `avatar_url IS NULL`. The column is `ink-1`, a symbol operator `ink-2`, a word operator (`LIKE`, `IS NULL`, `IS NOT NULL`) `syn-keyword`, a string `syn-string`, a number `syn-number`; strings are quoted and a quote inside one is doubled. A chip that is too long is cut with an ellipsis and carries the whole condition as its title.
- Each chip has a × (`Remove filter created_at > '2026-01-01'` for a screen reader); **Clear all** is a ghost button after the last chip. Chips wrap onto more lines, never scroll.
- A 22px chip on `bg-3` with a `line-2` border and `radius-sm`: it is a condition, not a button, so it takes no accent.
- Sits between `DataToolbar` and the grid, on `bg-2`; the number on the toolbar's Filter button is the number of chips.
