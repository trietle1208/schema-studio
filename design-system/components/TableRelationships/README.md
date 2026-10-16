# TableRelationships

The Relationships tab of a table: the foreign keys that leave it and the ones that point at it.

- Props: `table`, `tables` (every table of the schema, to find the foreign keys that point here) and `onOpen(tableName)`.
- Two groups with a `caption` eyebrow and a count: **References** (foreign keys of this table) and **Referenced by** (foreign keys of other tables). Each row is the relationship as SQL writes it, `orders.user_id → users.id` in mono with the arrow in `ink-3`, its ON DELETE rule and an **Open in Data** button.
- Open in Data opens the table on the other end in the Data tab: the referenced table for a row of References, the referencing table for a row of Referenced by.
- A group with no rows says why in a dashed note ("users has no foreign keys.", "No table references users."), not an empty table.
- `SchemaStudio.relationsOf(table, tables)` returns both lists (`{ out, inn }`); the tab's number in `TableHeader` is their sum.
