# Button

Actions in four weights: `primary`, `secondary` (default), `ghost` and `danger`, plus `danger-ghost` for inline destructive actions inside panels.

- Props: `variant`, `size` (`md` 28px, `sm` 22px), `icon`, `iconRight`, `kbd` (a key or array of keys shown after the label), `active`, `disabled`, and normal button attributes. `IconButton` takes `icon` + `label` (used as tooltip and `aria-label`) and is ghost by default.
- One `primary` per region: Export in the toolbar, the confirming action in a modal footer, New Schema on the list screen.
- Put the keyboard shortcut on the button (`kbd`) whenever one exists; developers learn shortcuts from buttons.
- Confirm destructive actions in a `ConfirmDialog` whose confirm button is `danger`. Inline row deletes are `danger-ghost`.
- Labels are verb-first, Title Case only for primary product actions named in the spec (Import Schema, Generate Migration), sentence case elsewhere.
