# Pagination

The footer of the grid: which rows of how many are on screen, and a way to move.

- Props: `page` (from 1), `pageSize`, `total` (rows after the filters), `onPage(page)`, `loading`. The size of a page is chosen on `DataToolbar`.
- Left: "1–50 of 1,248 rows" in mono (an en dash, a thousands separator, "1 row"); "0 rows" when there are none; "Loading…" while `loading`. Right: Previous page, `Page [ 1 ] of 25`, Next page.
- The page number is a mono input: it selects its text on focus, ⏎ or leaving it goes to the page (clamped to 1…last, anything that is not a number is dropped), Esc gives the change up. Previous is disabled on the first page, Next on the last, and the input when there is a single page.
- 36px on `bg-2` with a hairline above; it stays in view while the grid scrolls.
