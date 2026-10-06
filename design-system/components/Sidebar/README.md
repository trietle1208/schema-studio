# Sidebar

The left rail of every screen: brand, workspace selector, navigation (Schemas, Recent, Favorites), saved schemas, and settings/shortcuts/user at the bottom.

- Props: `active` (nav id), `onNavigate(id)`, `schemas` (`{name, engine, tables, updated}`), `activeSchema`, `onSelectSchema(name)`, `onNew`, `empty` (shows the empty hint instead of the list), `workspace`, `userName`, `userInitials`.
- Width is `w-sidebar` on `bg-0`. Schema rows show name (mono), relative time, and engine · table count.
- Keep it to navigation; never put schema actions or filters here.
