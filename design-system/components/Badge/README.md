# Badge

Small mono labels for engine, version, constraint and change state. `Kbd` renders keyboard keys; `Avatar` renders author initials.

- `tone`: `neutral` (default), `accent` (version, Current), `pk`, `fk`, `added`, `modified`, `removed`, `outline`. `dot` adds a leading dot, `icon` a 12px icon, `sans` switches to the UI face for words (Current, Soon).
- Change badges always include their glyph (`+`, `~`, `−`) so state never depends on colour alone.
- Engine names keep their real casing: PostgreSQL, MySQL, ClickHouse, SQLite.
