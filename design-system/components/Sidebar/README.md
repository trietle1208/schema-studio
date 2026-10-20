# Sidebar

The left rail of every screen: brand, workspace selector, navigation (Schemas, Recent, Favorites), saved schemas, and settings/shortcuts/user at the bottom.

- Props: `active` (nav id), `onNavigate(id)`, `schemas` (`{name, engine, tables, updated, favorite?}`), `activeSchema`, `onSelectSchema(name)`, `onToggleFavorite(name, favorite)`, `onNew`, `onSettings`, `onShortcuts`, `onCollapse`, `collapsed` (icon rail), `empty` (shows the empty hint instead of the list), `workspace`, `userName`, `userInitials`.
- Width is `w-sidebar` on `bg-0` (48px when collapsed). Schema rows show name (mono), relative time, and engine · table count; a star pins favorites.
- Keep it to navigation; never put schema actions or filters here.
