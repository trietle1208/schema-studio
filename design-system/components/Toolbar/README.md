# Toolbar

The workspace header: breadcrumb and schema name, engine and version badges, save status, undo/redo, zoom and fit, search, history, Share and Export.

- Props: `mode` (`diagram` | `data` | `query`), `onMode(mode)`, `schema`, `engine`, `version`, `saveState` (`saved` | `dirty` | `saving`), `onSave`, `zoom`, `onZoom(z)`, `onFit`, `onUndo`, `onRedo`, `canUndo`, `canRedo`, `search`, `onSearch`, `onHistory`, `onShare`, `onExport`.
- When `saveState` is `dirty` the status turns `modified` with a dot and a Save button with ⌘S appears; after saving it returns to a green tick and "Saved".
- Export is the only primary button in the toolbar.
- `mode` adds a Diagram / Data / Query segmented control after the version badge. Without `mode` and `onMode` the toolbar is the diagram toolbar and shows no control. Zoom, the zoom level and fit belong to the diagram, so they are shown only in `diagram` mode; undo, redo, search, history, Share and Export stay in every mode.
