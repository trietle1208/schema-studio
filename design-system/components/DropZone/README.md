# DropZone

File target for SQL imports, with a chosen-file state.

- Props: `file` (`{name, meta}` or null), `onFile(file|null)` (a file arrives as `{name, meta, raw}`; `raw` is the `File` itself), `over` (force the drag-over look), `hint`, `noun` ("Drop **SQL** file here", default `SQL`), `accept` (the file types of the picker, default `.sql,.ddl,.txt`), `fileIcon` (default `file-code`). Replace picks another file. Import Records uses it for CSV and JSON.
- At rest: dashed `line-3` border on `bg-1`. While a file is dragged over: `accent` border on `accent-subtle`. With a file: a file row with Replace and remove.
