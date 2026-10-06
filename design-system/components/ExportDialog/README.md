# ExportDialog

The Export Schema modal: format (SQL or JSON), target database, options (indexes, foreign keys, comments, DROP IF EXISTS), the "Generate migration from previous version" option with a base-version picker, and a live preview of the output.

- Props: `format` (`sql` | `json`), `migration` (start with the migration option on), `onExport`, `onClose`.
- The footer shows the file name and size the export will produce. Copy is offered beside Export.
