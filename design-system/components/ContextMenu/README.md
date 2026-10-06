# ContextMenu

Right-click menu for canvas objects and list rows.

- Props: `items` (array of `{icon, label, shortcut, danger, active, onSelect}` or `'-'` for a separator), `label` (mono context line, e.g. `public.orders`), `onClose`, `style`.
- Every item that has a shortcut shows it. Destructive items go last, after a separator, in `removed`.
