# Icon

Stroke icons drawn on a 24px grid, rendered at 16px (14px in dense rows, 12px in badges) with a 1.75 stroke that inherits `currentColor`.

- Provide `name` (see the preview for the full set) and optionally `size`, `className`, `style`, `label`.
- Icons are decorative by default (`aria-hidden`); pass `label` when an icon carries meaning on its own (the PK/FK glyphs in a table node do).
- Colour icons with text tokens: `ink-3` at rest, `ink-1` on hover, `accent-text` when active. Use `pk` and `fk` only for key glyphs.
- Never use emoji as icons. Never mix in a second icon family.
