# Schema Studio

Personal, desktop-first database schema designer for developers.
Core flow: **Import SQL → ER diagram → edit tables/columns/relationships → save versions → export SQL / migration.**

The user is Vietnamese; reply in Vietnamese unless asked otherwise. Code, identifiers, commits and code comments stay in English.

## Source of truth for the UI

- `design-system/README.md` — design rules (colour, type, spacing, states, wording). Read it before any UI work.
- `design-system/tokens.json` → compiled to `design-system/tokens.css` (CSS variables + @font-face). Never hard-code colours, radii or font sizes; use `var(--token)`.
- `design-system/components/bundle.css` — all `ss-*` classes. Reuse them as-is when porting components.
- `design-system/components/bundle.js` — working React prototype of every component (written with `React.createElement`, exported on `window.SchemaStudio`). Port components from here to `src/components/*.tsx`, keeping behaviour, props and class names.
- `design-system/components/index.d.ts` — prop types and the data model (`Table`, `Column`, `Index`, `Version`, `DiffItem`). Use these as the starting TypeScript types.
- `design-system/components/<Name>/README.md` — per-component guidelines.
- `design-system/components/Screen*/preview.html` — how components compose into each screen.
- `docs/screens/*.png` — reference screenshots of every screen. Match them.

## Tech stack (decided)

- Vite + React 18 + TypeScript (strict)
- State: Zustand; undo/redo with `zundo`
- Canvas: start by porting the prototype `ERCanvas`; switch to React Flow (`@xyflow/react`) only if performance requires it
- SQL parsing: `pgsql-ast-parser` for PostgreSQL first; keep the parser behind an interface (`src/core/parse/`) so MySQL can be added later
- Persistence: local-first, IndexedDB via Dexie. One record per schema, one immutable JSON snapshot per saved version
- Tests: Vitest for `src/core/**` (parser, generator, diff). UI tests are optional
- Package manager: npm

## Project layout (target)

```
src/
  core/            # pure TS, no React: model, parse/, generate/, diff/, validate.ts
  store/           # Zustand stores (schema, ui), undo/redo
  db/              # Dexie setup and repositories
  components/      # ported design-system components (.tsx)
  screens/         # SchemaList, Workspace, VersionHistory, SchemaDiff, Empty
  styles/          # imports tokens.css + bundle.css
```

## Rules

- Keep `src/core` free of React and DOM so it is testable.
- Every new core function gets a Vitest test with a realistic SQL fixture (the ecommerce sample in `design-system/components/bundle.js` → `sample`).
- Validation messages follow the design system wording, e.g. "Column name cannot be empty.", "Unable to parse SQL near line 42."
- Keyboard shortcuts listed in `design-system/README.md` (⌘S, ⌘Z, ⌘K, F2, ⌘⏎, ⌫, Esc) must work; on Windows use Ctrl.
- Dark theme is the default; light theme via `data-theme="light"` on `<html>`.
- Work in small steps from `docs/ROADMAP.md`. After each step: run `npm run build` and `npm test`, then summarise what changed.

## Commands

- `npm run dev` — dev server
- `npm run build` — type-check + build
- `npm test` — Vitest
