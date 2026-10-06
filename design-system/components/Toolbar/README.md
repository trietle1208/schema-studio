# Toolbar

The workspace header: breadcrumb and schema name, engine and version badges, save status, undo/redo, zoom and fit, search, history, Share and Export.

- Props: `schema`, `engine`, `version`, `saveState` (`saved` | `dirty` | `saving`), `onSave`, `zoom`, `onZoom(z)`, `onFit`, `onUndo`, `onRedo`, `canUndo`, `canRedo`, `search`, `onSearch`, `onHistory`, `onShare`, `onExport`.
- When `saveState` is `dirty` the status turns `modified` with a dot and a Save button with ⌘S appears; after saving it returns to a green tick and "Saved".
- Export is the only primary button in the toolbar.
