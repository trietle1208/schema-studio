# Toast

Transient confirmation at the bottom-right of the workspace (`Toast`), and inline, persistent messages inside panels and modals (`Alert`).

- `Toast` props: `tone` (`success` | `error` | `info`), `title`, `description`, `actions` (`{label, onClick}`), `onClose` (`false` hides the close button). Toasts auto-dismiss after 5s in the workspace.
- `Alert` props: `tone` (`info` | `success` | `warn` | `error`), `title`, children, `action`.
- Titles state the outcome in a few words ("Saved as v13", "Import failed"); descriptions give the specifics in mono where they are identifiers. Offer Undo on anything reversible.
