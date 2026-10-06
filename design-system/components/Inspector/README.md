# Inspector

The right-hand properties panel for the selected table: inline-renamable title with Rename / Duplicate / Delete, then collapsible Columns, Indexes, Foreign keys and Table settings sections.

- Props: `table`, `tables` (all tables, for references and incoming keys), `selectedColumn`, `onSelectColumn(index|null)`, `onChange(table)`, `onRename(old, new)`, `onDuplicate(name)`, `onDelete(name)`, `typeMenuOpen`, `renaming`, `settingsCollapsed`. With no `table` it shows a hint.
- Column rows edit in place: the name is an input, NN / PK / UQ are one-click toggles, and selecting a row expands Default, References, ON DELETE, constraints and Comment beneath it. Changes apply immediately; the toolbar shows "Unsaved changes" until ⌘S.
- Validation runs on every keystroke and is shown on the row ("Column name cannot be empty.") and mirrored on the canvas row.
- Width is `w-inspector` on `bg-2`, section headers are `caption`.
