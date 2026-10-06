# DropZone

File target for SQL imports, with a chosen-file state.

- Props: `file` (`{name, meta}` or null), `onFile(file|null)`, `over` (force the drag-over look), `hint`.
- At rest: dashed `line-3` border on `bg-1`. While a file is dragged over: `accent` border on `accent-subtle`. With a file: a file row with Replace and remove.
