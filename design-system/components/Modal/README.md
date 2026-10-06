# Modal

Dialog shell with header (optional icon tile, title, subtitle, close), scrolling body and footer. `ConfirmDialog` is the preset for confirmations.

- `Modal` props: `title`, `subtitle`, `icon`, `onClose` (Esc and scrim click call it), `width` (default 640), `footer` (right side), `footerStart` (left side: status or hint), `headerAside`, `bodyStyle`.
- `ConfirmDialog` props: `title`, `danger`, `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`, children as the body.
- The modal sits in its positioned parent (`ss-overlay` is `position:absolute`), so a screen can show it over the app.
- Footer order: secondary actions, Cancel, then the single primary. Show the ⌘⏎ / Esc shortcuts on the buttons.
- Confirmation titles are questions that name the object: Delete table "orders"?
