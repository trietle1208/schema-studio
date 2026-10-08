# Roadmap

Each step is sized for one Claude Code session. Tick it off when `npm run build` and `npm test` pass.

## Phase 1 — Foundation
- [x] **1.1 Scaffold**: Vite + React + TS, ESLint, Vitest, folder layout from CLAUDE.md. Import `tokens.css` + `bundle.css`, copy fonts. Show an empty `AppShell` with `Sidebar`.
- [x] **1.2 Primitives**: port Icon, Logo, Button, IconButton, Badge, Kbd, Avatar, Input, Field, Select, Checkbox, Radio, Switch, SegmentedControl to `.tsx`.
- [x] **1.3 Model**: `src/core/model.ts` from `index.d.ts`; `validate.ts` (column/table name rules) with tests.

## Phase 2 — Workspace
- [x] **2.1 Store**: Zustand schema store (tables, positions, selection, dirty flag) + undo/redo (zundo). Load the ecommerce sample.
- [x] **2.2 Canvas**: port TableNode + ERCanvas (drag, pan, zoom, edges, minimap, legend, context menu).
- [x] **2.3 Inspector**: port Inspector, TypeSelect, ColumnEditor; edits go through the store.
- [x] **2.4 Toolbar + StatusBar**: save state, undo/redo, zoom, search, shortcuts (⌘S/⌘Z/⌘K/F2/⌫/Esc).
- [x] **2.5 Dialogs**: Modal, ConfirmDialog (delete table), Toast.

## Phase 3 — Persistence & list
- [x] **3.1 Dexie**: schemas + versions tables; save creates a new immutable version snapshot.
- [x] **3.2 Schema list screen**: DataTable with search, engine filter, sort; New Schema; Empty state.
- [x] **3.2a New table**: "New table" in the canvas menu (right-click) and in the inspector; the table is selected and its name put into rename mode.
- [x] **3.2b Delete schema**: row menu and ⌫ in the schema list, confirmed in a dialog; removes the schema with all its versions.
- [x] **3.3 Routing**: list ↔ workspace ↔ history ↔ diff (react-router or simple state router).

## Phase 4 — Import / Export (MVP done here)
- [x] **4.1 Parser**: PostgreSQL `CREATE TABLE / ALTER TABLE ADD CONSTRAINT / CREATE INDEX` → model; errors with line numbers. Tests with good and broken fixtures.
- [x] **4.2 Import dialog**: DropZone, SqlEditor, live ParseStatus summary, auto-layout new tables in a grid.
- [x] **4.3 SQL generator**: model → PostgreSQL DDL with options (indexes, FKs, comments, DROP IF EXISTS). Round-trip test: parse(generate(x)) == x.
- [x] **4.4 Export dialog**: SQL / JSON, preview, download file.

## Phase 5 — Versions
- [x] **5.1 Diff engine**: compare two snapshots → DiffGroup[] (tables, columns, indexes, relationships). Tests.
- [x] **5.2 Version history screen**.
- [x] **5.3 Schema diff screen** (side-by-side DdlDiff).
- [x] **5.4 Migration generator**: diff → ALTER statements in a transaction; flag destructive changes.

## Phase 6 — Later
- [x] **MySQL dialect: parser**: `CREATE TABLE / ALTER TABLE / CREATE INDEX` as mysqldump, phpMyAdmin and hand-written DDL have them → model; Import dialog offers MySQL. Tests with dump fixtures.
- [x] **MySQL dialect: generator**: model → MySQL DDL and migrations (no transaction: MySQL commits each statement); exporting for the other engine converts the data types; the type picker offers MySQL's types in a MySQL schema. Tests, and checked against MySQL 8.
- [x] **Light/dark toggle in Settings**: a Settings dialog (sidebar, ⌘,) with the theme; kept in the browser and applied before the first paint.
- [ ] Desktop app with Tauri (open/save `.sql` files on disk)
- [ ] Connect to a live database (read-only introspection)
