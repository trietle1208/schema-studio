# EmptyState

First-run state for a workspace with no schemas: a quiet ER illustration drawn from canvas tokens, the headline, two actions and shortcut hints.

- Props: `title`, `description`, `onImport`, `onCreate`, `hints` (false to hide the footer line), `compact` and `actions`.
- Import Schema is primary because most users arrive with an existing database.
- `compact` is the small one, for a panel that is empty and not for the whole workspace: no illustration, the `title` size (18/24), no canvas dots, no hints. It takes its own `actions` (a node that replaces the two default buttons; `null` for none) and a `description` when one is needed. In the data grid: "This table has no rows." with Add record (primary, ⌘⏎) and Import Records, and "No rows match 2 filters." with Clear filters (secondary). The sentence ends with a period and says what happened; the buttons say what to do.
