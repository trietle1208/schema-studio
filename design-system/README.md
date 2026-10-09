Schema Studio is a desktop-first database schema designer for software engineers: import DDL, see it as an ER diagram, edit tables in place, save versions, export SQL or a migration. It should feel like an IDE or a database client: dense, quiet, keyboard-first, with the diagram as the focus of the screen. It is not a SaaS dashboard.

## Content fundamentals

- **Speak like a database tool.** Use the real terms: table, column, foreign key, index, `NOT NULL`, `ON DELETE CASCADE`, migration, dialect. Never "field", "link" or "entity".
- **Identifiers are literal.** Table, column, index and constraint names appear exactly as they will in SQL, in the mono face, never title-cased: `order_items`, `users_email_unique`, `orders.user_id → users.id`.
- **Engines keep their real casing:** PostgreSQL, MySQL, ClickHouse, SQLite.
- **Sentence case** for labels and menus ("Add foreign key", "Include comments"). Title Case is reserved for the product's named actions: Import Schema, Export Schema, Generate Migration, New Schema, Create New Schema.
- **Counts in mono, joined by a middle dot:** "24 tables · 31 relationships · 18 indexes".
- **Errors say what happened and where, then end with a period:** "Column name cannot be empty.", "Unable to parse SQL near line 42.". Offer the fix next to the message ("Go to line").
- **Confirmations name the object as a question:** Delete table "orders"? Then state the consequence: "2 foreign keys will be dropped."
- **No emoji, no exclamation marks, no marketing voice.** Second person only in empty states and hints ("Import DDL from an existing database…").

## Visual foundations

### Colour

- Dark is the primary theme; light mirrors it token for token. Always paint with tokens, never literal hex.
- Surfaces step up in lightness, not in hue: `bg-0` app chrome (sidebar, status bar) → `bg-1` canvas and inputs → `bg-2` panels, toolbar, modals → `bg-3` table nodes, menus, toasts → `bg-4` hover → `bg-5` selected.
- Separate regions with hairlines (`line-1`), not shadows. Controls and nodes use `line-2`; hover and checkbox outlines use `line-3`.
- Text: `ink-1` primary, `ink-2` secondary (column types, labels), `ink-3` tertiary (captions, timestamps, gutters). All three hold 4.5:1 on `bg-0`–`bg-4` in both themes.
- **One accent.** `accent` marks the primary button, selection outlines, checked controls, the current version and active relationship lines. `accent-subtle` fills selected rows. Never use it decoratively, never in a gradient.
- Key glyphs only: `pk` (amber) for primary keys, `fk` (teal) for foreign keys.
- Change state: `added` / `modified` / `removed` with their `-subtle` fills. Every change also carries a glyph (`+`, `~`, `−`) so meaning never rests on hue alone.
- SQL is highlighted with `syn-keyword`, `syn-type`, `syn-string`, `syn-number`, `syn-comment`.
- Keyboard focus is a solid 2px `focus-ring` outline at 1px offset on every control; inputs show it as a 1px ring around a `focus-ring` border.

### Type

- Two families: **Geist** for interface text and **Geist Mono** for anything that is or becomes SQL (identifiers, types, defaults, editors, counts, badges). Both ship as files in `fonts/` (SIL OFL).
- Default UI text is `body` (13/20). Buttons, labels and nav are `label` (12/16, 500). Section eyebrows in the sidebar, inspector and tables are `caption` (11px, 600, uppercase, +0.06em).
- Screen titles use `title` (18/24); modal titles `heading` (14/20). `display` (26/32) appears only in the empty state.
- Table names are `code-strong`; column rows, the SQL editor and DDL diffs are `code` (12/18); badges and the status bar are `code-sm`.

### Space, shape, depth

- 4px base. Dense rows: 24px canvas rows (`h-row`), 28–30px control rows (`h-control`), 44px toolbar (`h-toolbar`).
- The shell: `w-sidebar` 248px, `w-inspector` 352px, `w-node` 228px. Optimised for 1440px+; the canvas absorbs the remaining width. These are the widths things start with: the sidebar and the inspector are dragged wider or narrower by the line between them and the canvas, and a table by either of its sides. A handle is the hairline itself, which turns `accent` (2px) when it is pointed at and while it is dragged; a double click gives a panel its width back and fits a table to its text.
- Radii stay small: `radius-sm` 4px (badges, toggles), `radius-md` 6px (buttons, inputs, menus), `radius-lg` 8px (nodes, modals). Nothing rounder.
- Shadows only for things that float: `shadow-node` for table nodes, `shadow-pop` for menus, popovers, toasts and a dragged node, `shadow-modal` for dialogs.

### The canvas

- The ER diagram is the visual focus. It sits on `bg-1` with a 16px `canvas-dot` grid. Only the legend, minimap, context menu and transient hints may overlay it.
- Relationship curves run from the referenced key (bar = one) to the foreign-key column (crow's foot = many) in `relation`. Selecting a table turns its lines `relation-active` and dims unrelated tables.
- Column rows read left to right: key glyph, name, type in `ink-2`, then `?` for nullable and `UQ` for unique. The legend restates this.
- Nodes drag by their header and snap to 8px; their sides drag to resize them, in steps of 4px; empty canvas pans.

### States

- Hover: `bg-4` fill or `line-3` border. Selected: `bg-5` or `accent-subtle` fill, `accent` outline on nodes.
- Unsaved: a `modified` dot on the node and "Unsaved changes" plus a Save ⌘S button in the toolbar. Saved: an `added` tick and "Saved", plus a toast naming the new version.
- Invalid: `removed` border on the input, `removed-subtle` row, a message under the row, and the problem count in the status bar.
- Destructive actions confirm in a `ConfirmDialog` with a `danger` button; reversible ones offer Undo in a toast.

### Motion

- Transitions are 80–120ms on colour and border only. No entrance animations, no bounce; dragging follows the pointer 1:1.

## Iconography

- One set of stroke icons on a 24px grid, 1.75 stroke, round caps, drawn for this system and exported as `Icon` (`name` prop). Render at 16px (14px in dense rows, 12px in badges); colour with `ink-3` → `ink-1` on hover, `accent-text` when active.
- `key` in `pk` and `link` in `fk` are the only coloured glyphs in the canvas.
- No emoji, no filled or duotone icons, no second icon family.
- The logo mark (`assets/Logos/schema-studio-mark.svg`, also `Logo`) is two tables and the relation between them, in `accent`.

## Keyboard

Every frequent action has a shortcut, and buttons display it with `Kbd`: ⌘K search, ⌘S save, ⌘Z / ⇧⌘Z undo and redo, ⌘I import, ⌘N new schema, ⌘D duplicate, F2 rename, ⌘⏎ add column / confirm, ⌫ delete, Esc close, ⌘/ all shortcuts.

## Using the components

Components live in `components/bundle.js` as `window.SchemaStudio` and expect React 18 on the page; their styles are in `components/bundle.css` and every class is prefixed `ss-`. Wrap a page in an element with `class="ss-root"` (or use `AppShell`). `Workspace` is the fully wired main screen; the `Screen…` previews compose the eight product screens (schema list, workspace, inspector editing, import, version history, diff, export, empty state) and a sheet of interaction states.
