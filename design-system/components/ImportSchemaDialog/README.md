# ImportSchemaDialog

The Import Schema modal: schema name and dialect, a source switch (Upload SQL file, Paste SQL, Connect to database — marked Soon), drop zone and paste editor, a live parse summary and the Import Schema action.

- Props: `mode` (`file` | `paste`), `engine`, `file`, `sql`, `summary`, `state` (force `error`), `error`, `errorLine`, `firstLine`, `name`, `onImport({name, engine, mode})`, `onClose`.
- Upload and Paste are the MVP paths; Connect stays visible but disabled so the roadmap is legible.
- Import stays disabled until something parses. The footer shows the summary ("24 tables · 31 relationships · 18 indexes") or the parse error.
