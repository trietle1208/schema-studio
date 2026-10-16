# Checkbox

Boolean and single-choice controls: `Checkbox`, `Radio` (same props plus `name`) and `Switch`.

- Props: `checked`, `onChange(checked)`, `label`, `description` (second line in `ink-3`), `disabled`.
- Checkbox for options that are applied on submit (export options, column constraints); Switch for settings that take effect immediately (Unlogged, Snap to grid).
- The checked fill is `accent` with an `on-accent` tick; focus shows the `focus-ring`.
- `disabled` dims the box and shows a not-allowed cursor; the description under the label says why ("users has no foreign keys.").
