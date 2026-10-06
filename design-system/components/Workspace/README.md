# Workspace

The main schema workspace, fully wired: `Toolbar`, `ERCanvas`, `Inspector`, `StatusBar`, toasts and delete confirmation, with undo/redo, dirty tracking, validation, ⌘S save and ⌘Z undo.

- Props (all initial state): `tables`, `positions`, `selected`, `selectedColumn`, `zoom`, `dirty`, `dirtyTables`, `version`, `toast`, `confirmDelete`, `initialMenu`, `typeMenuOpen`, `renaming`, `autoFocusDraft`, `settingsCollapsed`, `canvasHint`, `inspector` (false hides it), `overlay` (node rendered on top, e.g. a modal), `onExport`, `onHistory`, `onShare`.
- Render it inside `AppShell` (which supplies the `Sidebar`) for a full screen.
