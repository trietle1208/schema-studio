# Input

Single-line text input, with `Field` for label, hint and validation message.

- `Input` props: `icon` (leading), `suffix` (trailing node, usually a `Kbd`), `mono` (identifiers, types, defaults — anything that ends up in SQL), `size` (`sm` in dense panels), `error` (red border), `inputRef`, plus normal input attributes.
- `Field` props: `label`, `aside` (right-aligned note), `hint`, `error` (replaces the hint, rendered with `role="alert"`).
- Validate as the user types and say what to do: "Column name cannot be empty.", "Use letters, digits and underscores; start with a letter." End messages with a period.
- Identifiers are always `mono`; prose (comments, descriptions) uses the sans face.
