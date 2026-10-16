# Progress

A bar for work that takes a while and knows how much of it is done: Import Records processing its rows.

- Props: `value`, `max` (default 100), `tone` (`done` in `added`, `error` in `removed`; none is `accent`), `label` (the `aria-label`).
- 6px on `bg-4`, `radius-sm`; the fill follows `value` at once, with no transition, in keeping with the rest of the system. `role="progressbar"` with `aria-valuenow`.
- Say the numbers next to it in mono ("620 of 1,000 rows"): the bar is the glance, the words are the answer. Work with no known end gets no bar.
