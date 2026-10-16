// Schema Studio — window.SchemaStudio (React 18). Types are documentation.
import type { ReactNode, CSSProperties } from 'react';

export type IconName = 'table' | 'database' | 'key' | 'link' | 'search' | 'plus' | 'minus' | 'undo' | 'redo' | 'zoom-in' | 'zoom-out' | 'fit' | 'download' | 'upload' | 'share' | 'settings' | 'keyboard' | 'chevron-down' | 'chevron-right' | 'chevron-left' | 'chevron-up' | 'chevrons-ud' | 'arrow-up' | 'arrow-down' | 'arrow-right' | 'star' | 'clock' | 'layers' | 'history' | 'diff' | 'file' | 'file-code' | 'clipboard' | 'plug' | 'check' | 'check-circle' | 'x' | 'alert' | 'warning' | 'info' | 'trash' | 'copy' | 'pencil' | 'more' | 'filter' | 'grip' | 'hash' | 'columns' | 'folder' | 'code' | 'eye' | 'restore' | 'migration' | 'command' | 'sidebar' | 'panel' | 'move' | 'lock' | 'external' | 'refresh' | 'play' | 'bookmark';

export interface Column { name: string; type: string; nullable?: boolean; pk?: boolean; unique?: boolean; default?: string; comment?: string; fk?: { table: string; column: string; onDelete?: 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'NO ACTION' } | null; draft?: boolean; }
export interface Index { name: string; type: 'PRIMARY KEY' | 'UNIQUE' | 'INDEX'; using: string; columns: string[]; }
export interface Table { name: string; schema?: string; comment?: string; columns: Column[]; indexes?: Index[]; }
export type Positions = Record<string, { x: number; y: number }>;
export interface SchemaSummary { name: string; engine: string; tables: number; relationships?: number; version: string; updated: string; favorite?: boolean; }
export interface Version { version: string; current?: boolean; time: string; timestamp?: string; author: string; initials?: string; message: string; tables?: number; relationships?: number; added?: number; modified?: number; removed?: number; }
export interface DiffItem { op: 'add' | 'mod' | 'del'; path: string; detail?: string; }
export interface DiffGroup { group: string; items: DiffItem[]; }
export interface MenuItem { icon?: IconName; label: ReactNode; shortcut?: string; danger?: boolean; active?: boolean; onSelect?: () => void; }

export interface IconProps { name: IconName; size?: number; strokeWidth?: number; label?: string; className?: string; style?: CSSProperties; }
export interface LogoProps { size?: number; markOnly?: boolean; }
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost'; size?: 'md' | 'sm'; icon?: IconName; iconRight?: IconName; kbd?: string | string[]; active?: boolean; children?: ReactNode; }
export interface IconButtonProps extends Omit<ButtonProps, 'children'> { icon: IconName; label: string; }
export interface BadgeProps { tone?: 'neutral' | 'accent' | 'pk' | 'fk' | 'added' | 'modified' | 'removed' | 'outline'; dot?: boolean; icon?: IconName; sans?: boolean; title?: string; children?: ReactNode; }
export interface KbdProps { keys?: string[]; children?: ReactNode; }
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> { icon?: IconName; suffix?: ReactNode; mono?: boolean; size?: 'md' | 'sm'; error?: boolean; inputRef?: React.Ref<HTMLInputElement>; }
export interface FieldProps { label?: ReactNode; aside?: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; }
export interface SelectProps { value: string; onChange?: (v: string) => void; options: (string | { value: string; label: string })[]; mono?: boolean; size?: 'md' | 'sm'; label?: string; disabled?: boolean; }
export interface CheckboxProps { checked?: boolean; onChange?: (checked: boolean) => void; label?: ReactNode; description?: ReactNode; disabled?: boolean; name?: string; }
export interface SwitchProps { checked?: boolean; onChange?: (checked: boolean) => void; label?: ReactNode; ariaLabel?: string; }
export interface SegmentedControlProps { options: { value: string; label: ReactNode; icon?: IconName; badge?: ReactNode; disabled?: boolean }[]; value: string; onChange?: (v: string) => void; block?: boolean; }
export interface SidebarProps { active?: 'schemas' | 'recent' | 'favorites'; onNavigate?: (id: string) => void; schemas?: SchemaSummary[]; activeSchema?: string; onSelectSchema?: (name: string) => void; onNew?: () => void; empty?: boolean; workspace?: string; userName?: string; userInitials?: string; }
export type WorkspaceMode = 'diagram' | 'data' | 'query';
export interface ToolbarProps { mode?: WorkspaceMode; onMode?: (mode: WorkspaceMode) => void; schema?: string; engine?: string; version?: string; saveState?: 'saved' | 'dirty' | 'saving'; onSave?: () => void; zoom?: number; onZoom?: (z: number) => void; onFit?: () => void; onUndo?: () => void; onRedo?: () => void; canUndo?: boolean; canRedo?: boolean; search?: string; onSearch?: (q: string) => void; onHistory?: () => void; onShare?: () => void; onExport?: () => void; }
export interface StatusBarProps { left?: ReactNode[]; right?: ReactNode[]; }
export interface TableNodeProps { table: Table; x?: number; y?: number; static?: boolean; selected?: boolean; selectedColumn?: number | null; onSelect?: (name: string) => void; onSelectColumn?: (i: number) => void; dimmed?: boolean; dragging?: boolean; dirty?: boolean; invalidColumns?: number[]; state?: 'added' | 'removed'; style?: CSSProperties; }
export interface ERCanvasProps { tables: Table[]; positions?: Positions; onMove?: (name: string, xy: { x: number; y: number }) => void; onMoveEnd?: (name: string) => void; selected?: string | null; onSelect?: (name: string | null) => void; selectedColumn?: number | null; onSelectColumn?: (i: number | null) => void; zoom?: number; offset?: { x: number; y: number }; fitSignal?: number; dimUnrelated?: boolean; dirtyTables?: string[]; invalidColumns?: number[]; menuItems?: (table: string, close: () => void) => (MenuItem | '-')[]; onDeleteTable?: (name: string) => void; initialMenu?: { table: string; x: number; y: number }; hint?: ReactNode; showLegend?: boolean; showMinimap?: boolean; }
export interface InspectorProps { table: Table | null; tables?: Table[]; selectedColumn?: number | null; onSelectColumn?: (i: number | null) => void; onChange: (t: Table) => void; onRename?: (from: string, to: string) => void; onDuplicate?: (name: string) => void; onDelete?: (name: string) => void; typeMenuOpen?: boolean; renaming?: boolean; settingsCollapsed?: boolean; schemaName?: string; }
export interface TypeSelectProps { value: string; onChange?: (t: string) => void; size?: 'md' | 'sm'; error?: boolean; defaultOpen?: boolean; placement?: 'bottom' | 'top'; align?: 'start' | 'end'; }
export interface ContextMenuProps { items: (MenuItem | '-')[]; label?: string; onClose?: () => void; style?: CSSProperties; }
export interface ModalProps { title: ReactNode; subtitle?: ReactNode; icon?: IconName; onClose?: () => void; width?: number; footer?: ReactNode; footerStart?: ReactNode; headerAside?: ReactNode; bodyStyle?: CSSProperties; children?: ReactNode; }
export interface ConfirmDialogProps { title: ReactNode; danger?: boolean; confirmLabel?: string; cancelLabel?: string; onConfirm?: () => void; onCancel?: () => void; width?: number; children?: ReactNode; }
export interface DropZoneProps { file?: { name: string; meta?: string } | null; /** A file arrives as `{name, meta, raw}`: `raw` is the `File` itself, for a host that reads it. */ onFile?: (f: { name: string; meta?: string; raw?: File } | null) => void; over?: boolean; hint?: ReactNode; /** "Drop **SQL** file here"; default `SQL`. */ noun?: string; /** The file types of the picker; default `.sql,.ddl,.txt`. */ accept?: string; /** Default `file-code`. */ fileIcon?: IconName; }
export interface SqlEditorProps { value?: string; defaultValue?: string; onChange?: (sql: string) => void; height?: number; errorLine?: number | null; firstLine?: number; readOnly?: boolean; placeholder?: string; label?: string; /** `json` highlights keys, strings, numbers and true / false / null instead of SQL; `text` does not highlight. */ language?: 'sql' | 'json' | 'text'; style?: CSSProperties; }
export interface ParseStatusProps { state?: 'idle' | 'parsing' | 'ok' | 'error'; summary?: string; message?: string; onJump?: () => void; aside?: ReactNode; }
export interface ImportSchemaDialogProps { mode?: 'file' | 'paste'; engine?: string; file?: { name: string; meta?: string } | null; sql?: string; summary?: string; state?: 'error'; error?: string; errorLine?: number; firstLine?: number; name?: string; pasteHeight?: number; onImport?: (r: { name: string; engine: string; mode: string }) => void; onClose?: () => void; }
export interface ExportDialogProps { format?: 'sql' | 'json'; migration?: boolean; onExport?: () => void; onClose?: () => void; }
export interface ToastProps { tone?: 'success' | 'error' | 'info'; title: ReactNode; description?: ReactNode; actions?: { label: string; onClick?: () => void }[]; onClose?: (() => void) | false; }
export interface AlertProps { tone?: 'info' | 'success' | 'warn' | 'error'; title?: ReactNode; action?: ReactNode; children?: ReactNode; }
export interface DataTableProps<R = any> { columns: { key: string; label: ReactNode; width?: number | string; align?: 'left' | 'right' | 'center'; numeric?: boolean; sortable?: boolean; render?: (row: R) => ReactNode }[]; rows: R[]; rowKey?: string; sort?: { key: string; dir: 'asc' | 'desc' }; onSort?: (s: { key: string; dir: 'asc' | 'desc' }) => void; selectedKey?: string; onRowClick?: (row: R) => void; }
/** A value of a record: `null` is NULL; timestamps are strings (`YYYY-MM-DD HH:mm:ss`); a JSON column holds its JSON text. */
export type RecordValue = string | number | boolean | null;
/** One record, keyed by column name. */
export type RecordRow = Record<string, RecordValue>;
export interface CellRef { row: number; column: string; }
export interface TableListProps { tables: Table[]; counts?: Record<string, number>; selected?: string; onSelect?: (name: string) => void; search?: string; onSearch?: (q: string) => void; }
export type RecordDensity = 'regular' | 'compact';
/** What the menu of a row, and its keys, ask for: ⏎ is `onOpenRow`, F2 `edit`, ⌘D `duplicate`, ⇧⌘C `copy`, ⌫ `delete`. */
export type RowAction = 'view' | 'edit' | 'duplicate' | 'copy' | 'delete';
export type FilterOp = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'LIKE' | 'IS NULL' | 'IS NOT NULL';
/** One condition on a column, as SQL writes it: `created_at > '2026-01-01'`, `avatar_url IS NULL` (the two NULL tests carry no `value`). */
export interface RecordFilter { column: string; op: FilterOp; value?: RecordValue; }
export interface RecordSort { column: string; dir: 'asc' | 'desc'; }
export interface DataGridColumn extends Column { width?: number; }
export interface DataGridProps { columns: DataGridColumn[]; rows: RecordRow[]; selected?: number[]; onSelect?: (rows: number[]) => void; activeCell?: CellRef | null; onActiveCell?: (cell: CellRef) => void; modified?: CellRef[]; /** Cells that will not be accepted (the preview of Import Records): `removed` outline and an alert glyph; `message` is the cell's title. */ invalid?: (CellRef & { message?: string })[]; onOpenRow?: (row: number) => void; /** A click on a cell opens its row (`onOpenRow`), as a double click and ⏎ do; for a grid that sits next to a panel showing the row. */ openOnClick?: boolean; /** `false` leaves out the checkboxes of the gutter, which then only numbers the rows. */ selectable?: boolean; onRowAction?: (action: RowAction, row: number) => void; sort?: RecordSort | null; loading?: boolean; empty?: boolean | ReactNode; density?: RecordDensity; label?: string; }
export type TableTab = 'data' | 'structure' | 'relationships';
export interface TableHeaderProps { table: Table; schema?: string; engine?: string; rows?: number; relationships?: number; tab?: TableTab; onTab?: (tab: TableTab) => void; onAdd?: () => void; onImport?: () => void; onExport?: () => void; onRefresh?: () => void; menuItems?: (MenuItem | '-')[]; loading?: boolean; }
export interface TableStructureProps { table: Table; }
export interface TableRelationshipsProps { table: Table; tables: Table[]; onOpen?: (table: string) => void; }
export interface DataToolbarProps { columns: Column[]; search?: string; onSearch?: (q: string) => void; filters?: RecordFilter[]; onAddFilter?: (filter: RecordFilter) => void; sort?: RecordSort | null; onSort?: (sort: RecordSort | null) => void; hidden?: string[]; onHidden?: (names: string[]) => void; density?: RecordDensity; onDensity?: (density: RecordDensity) => void; pageSize?: number; onPageSize?: (size: number) => void; onRefresh?: () => void; loading?: boolean; }
export interface FilterChipsProps { filters: RecordFilter[]; onRemove?: (index: number) => void; onClear?: () => void; }
export interface SelectionBarProps { count: number; onCopy?: () => void; onExport?: () => void; onDelete?: () => void; onClear?: () => void; }
export interface PaginationProps { page: number; pageSize: number; total: number; onPage?: (page: number) => void; loading?: boolean; }
export interface VersionListProps { versions?: Version[]; selected?: string; onSelect?: (v: string) => void; }
export interface DiffListProps { groups?: DiffGroup[]; selected?: string; onSelect?: (path: string) => void; showGroups?: boolean; showDetail?: boolean; showKind?: boolean; }
export interface DdlDiffProps { rows: [string | null, (string | null)?, ('same' | 'add' | 'del' | 'mod' | 'fold')?, number?][]; leftTitle?: ReactNode; rightTitle?: ReactNode; leftMeta?: ReactNode; rightMeta?: ReactNode; style?: CSSProperties; }
export interface EmptyStateProps { title?: ReactNode; description?: ReactNode; onImport?: () => void; onCreate?: () => void; hints?: boolean; compact?: boolean; actions?: ReactNode; }
export interface WorkspaceProps { tables?: Table[]; positions?: Positions; selected?: string | null; selectedColumn?: number | null; zoom?: number; dirty?: boolean; dirtyTables?: string[]; version?: number; toast?: ToastProps; confirmDelete?: string; initialMenu?: { table: string; x: number; y: number }; typeMenuOpen?: boolean; renaming?: boolean; autoFocusDraft?: boolean; settingsCollapsed?: boolean; canvasHint?: ReactNode; inspector?: boolean; overlay?: ReactNode; onExport?: () => void; onHistory?: () => void; onShare?: () => void; }
export interface AppShellProps { sidebar?: ReactNode | false; overlay?: ReactNode; style?: CSSProperties; children?: ReactNode; }
/** The rows of every table of the schema, by table name: what foreign keys are chosen from and checked against. */
export type RecordData = Record<string, RecordRow[]>;
export type RecordTab = 'form' | 'json' | 'related';
/** What is wrong with a record, by column name (see `S.validateRecord`). */
export type RecordProblems = Record<string, string>;
export interface ResizeHandleProps { label: string; /** The side of the panel the line is on: `left` / `right` (a line down, the width) or `top` / `bottom` (a line across, the height). */ edge: 'left' | 'right' | 'top' | 'bottom'; width: number; min: number; max: number; onResize?: (width: number) => void; onReset?: () => void; }
/**
 * The panel at the right of the grid that edits one record: 520px, dragged between 480 and 720. It keeps its own draft; the host
 * gives it the record (`record`, or none for a new one) and hears `onSave(values)` with the values that were set (a new record
 * leaves out what the database fills in: see `S.completeRecord`), `onClose()` once there is nothing to lose, and `onDirty(dirty)`.
 * Mount it with a `key` for the record, so that another record starts from its own values.
 */
export interface RecordEditorProps {
  table: Table;
  /** Every table, for foreign keys and related records. */
  tables?: Table[];
  data?: RecordData;
  /** The record to edit; leave it out (or `null`) for a new record. */
  record?: RecordRow | null;
  /** Values the form opens with over the record's own (it opens with unsaved changes); for a new record, the values of a duplicate. */
  draft?: RecordRow;
  tab?: RecordTab;
  /** Starts at 520. */
  width?: number;
  onWidth?: (width: number) => void;
  /** Focus the first column that can be edited when it opens (opened by F2 or Add record, not by a click). */
  autoFocus?: boolean;
  onSave?: (values: RecordRow) => void;
  onClose?: () => void;
  /** Whether the draft holds changes, and the names of the columns that differ from the record. */
  onDirty?: (dirty: boolean, changed: string[]) => void;
  // Initial state, for previews of a state that otherwise needs a click.
  /** The text of the JSON tab, if it is not the record's. */
  jsonText?: string;
  /** The Validate report of the JSON tab is open. */
  validated?: boolean;
  /** Problems show for every column, as after a click on Create record. */
  attempted?: boolean;
  /** The Discard changes dialog is open. */
  confirmDiscard?: boolean;
  /** The key of the open relation of the Related records tab (`in:orders.user_id`, `out:user_id`). */
  related?: string;
  /** The column whose foreign key picker is open, and what is typed in its search. */
  picking?: string;
  pickQuery?: string;
}

// ------------------------------------------------------------------ import records
export interface StepperProps { steps: string[]; /** Index of the current step, from 0. */ current: number; /** A step that is done is a button that goes back to it; without this none is clickable. */ onStep?: (index: number) => void; label?: string; }
export interface ProgressProps { value: number; max?: number; tone?: 'done' | 'error'; label?: string; }
export type ImportStep = 'source' | 'map' | 'settings' | 'review';
export type ImportPhase = 'importing' | 'done';
/** What `S.readRecordsFile` makes of a CSV or JSON text. A row holds one cell per column (strings for CSV; JSON keeps numbers, booleans and null). `at[i]` is where row i is in the file: its line (`unit` is `line`, CSV) or its place in the array (`row`, JSON). With `error` set there are no rows. */
export interface ImportSource { format: 'csv' | 'json'; delimiter: string | null; header: boolean; columns: string[]; rows: (string | number | boolean | null)[][]; at: number[]; unit: 'line' | 'row'; error: string | null; }
/** How one column of the table is filled: `from` is a column of the file, `''` (ignore) or `'='` (a constant, in `value`). `by` says who chose it; `why` how the dialog found it. */
export interface ImportMapEntry { from: string; by: 'auto' | 'manual'; value?: string; why?: 'Same name' | 'Similar name' | 'Same type'; }
/** By column name of the destination table. */
export type ImportMapping = Record<string, ImportMapEntry>;
export type ImportMode = 'insert' | 'upsert' | 'skip';
export interface ImportSettings { mode: ImportMode; /** The unique column an upsert goes by (the first one filled when empty). */ key: string; emptyNull: boolean; skipInvalid: boolean; checkFk: boolean; stopOnError: boolean; oneTx: boolean; }
/** What is wrong with a value: a NOT NULL column with no value, a value that does not fit the type, a date, a foreign key, a unique key. */
export type ImportProblemKind = 'required' | 'type' | 'date' | 'fk' | 'duplicate';
export interface ImportProblem { line: number; column: string; value: RecordValue | undefined; message: string; }
/** `insert`, `update` (upsert), `skip` (a duplicate left out on purpose), `conflict` (a duplicate that insert-only cannot take: a warning), `invalid` (an error). */
export type ImportRowKind = 'insert' | 'update' | 'skip' | 'conflict' | 'invalid';
export interface ImportRow { line: number; index: number; kind: ImportRowKind; /** What is written; a column left out takes its default. */ values: RecordRow; problems: (ImportProblem & { kind: ImportProblemKind })[]; conflict: { column: string; message: string; row?: RecordRow; repeat?: boolean } | null; match: RecordRow | null; }
export interface ImportAnalysis {
  rows: ImportRow[];
  groups: Record<ImportProblemKind, ImportProblem[]>;
  counts: { total: number; /** insert + update */ valid: number; insert: number; update: number; skip: number; warnings: number; errors: number };
  /** The columns that get a value from the file or a constant. */
  filled: string[];
  /** Required columns nothing fills: an error on every row. */
  missing: string[];
  /** The unique columns that are filled, and the one an upsert goes by. */
  keys: string[];
  key: string;
}
export interface ImportOutcome { processed: number; inserted: number; updated: number; skipped: number; failed: number; error: { line: number; message: string } | null; stopped: boolean; rolledBack: boolean; insert: RecordRow[]; update: { match: RecordRow | null; values: RecordRow }[]; }
export interface ImportResult { table: string; insert: RecordRow[]; update: { match: RecordRow | null; values: RecordRow }[]; counts: { processed: number; inserted: number; updated: number; skipped: number; failed: number }; }
/**
 * Import Records: a CSV or JSON file, or pasted text, becomes rows of one table, in four steps (Source, Map columns, Settings, Review & import).
 * It keeps its own state; the host gives it the table and the rows that exist and hears `onImport` when rows were written. What it checks is in
 * `S.analyzeImport` and what the import does in `S.runImport`; neither needs React.
 */
export interface ImportRecordsDialogProps {
  /** The destination; the `users` of the sample when left out. */
  table?: Table;
  /** The rows of every table: unique keys and foreign keys are checked against them. */
  data?: RecordData;
  /** The first part of `ecommerce.public.users`. */
  schema?: string;
  /** Rows were written. Complete a new row with `S.completeRecord(table, rows, values)` (the database fills in the counter and the defaults). */
  onImport?: (result: ImportResult) => void;
  /** "View imported rows": the dialog closes after it. */
  onViewRows?: (outcome: ImportOutcome) => void;
  onClose?: () => void;
  /** Height of the body, 708 when left out. */
  height?: number;
  // Initial state, for previews and tests.
  step?: ImportStep;
  source?: 'file' | 'paste';
  /** A chosen file, with its contents in `text` (or the pasted text, when `source` is `paste`). */
  file?: { name: string; bytes?: number } | null;
  text?: string;
  /** Choices already made, over what the dialog matches by itself. */
  mapping?: ImportMapping;
  settings?: Partial<ImportSettings>;
  /** The result view (`done`) or the progress (`importing`; give `progress` to freeze it). */
  phase?: ImportPhase;
  /** Rows processed, while `phase` is `importing`. */
  progress?: number;
  /** The database refuses this row, as it would if another session had added the same key since the check. */
  fail?: { line: number; message: string };
  /** The review groups that are open (`required`, `duplicate`, `type`, `fk`, `date`); the first with a problem when left out. */
  open?: ImportProblemKind[];
  /** Seconds shown in the result. */
  duration?: number;
}

// --- Query mode
export type QueryOp = 'eq' | 'ne' | 'contains' | 'starts' | 'gt' | 'lt' | 'before' | 'after' | 'between' | 'null' | 'notnull';
/** What was typed for a condition, as text. */
export interface QueryCondition { column: string; op: QueryOp; value: string; value2: string; }
export interface QueryGroup { op: 'AND' | 'OR'; items: (QueryCondition | QueryGroup)[]; }
/** The Builder's query. `columns: null` is every column, `limit: null` is no limit. `S.defaultQuery(table)` makes an empty one. */
export interface BuilderQuery { table: string; where: QueryGroup; columns: string[] | null; sort: { column: string; dir: 'asc' | 'desc' } | null; limit: number | null; }
export interface QueryEntry { name?: string; sql: string; /** Set when the query was written in the Builder: it comes back to the Builder. */ spec?: BuilderQuery; ok?: boolean; ms?: number; at?: string; }
/** `S.runQuery(sql, tables, data)`: `rows` are what the query selects, `sources` the rows of the table they came from, in the same order. */
export type QueryResult =
  | { ok: true; table: Table; columns: Column[]; rows: RecordRow[]; sources: RecordRow[]; total: number; shown: number; capped: boolean; removed: number; all: number; sql: string }
  | { ok: false; line?: number; message: string };

export interface FilterBuilderProps {
  value: BuilderQuery; onChange: (query: BuilderQuery) => void; tables?: Table[];
  /** Put each problem under its row and the count in the side. */
  showErrors?: boolean;
  /** Under the SQL: the console's Run. */
  actions?: ReactNode;
  /** Shows "Edit as SQL"; gets the SQL. */
  onEditSql?: (sql: string) => void;
  /** Start with the Columns menu open. */
  columnsOpen?: boolean;
}
/** Query mode: Builder or SQL on top, Results / Messages / Plan below. It keeps its own state and its own working copy of the rows; the other props start it somewhere. */
export interface QueryConsoleProps {
  tables?: Table[]; data?: RecordData;
  onRun?: (entry: QueryEntry) => void; onSaveQuery?: (entry: QueryEntry) => void;
  /** A row edited in the record editor was saved: the table, the row as it was and as it is. */
  onSaveRecord?: (table: string, row: RecordRow, saved: RecordRow) => void;
  mode?: 'builder' | 'sql'; spec?: BuilderQuery; sql?: string;
  /** The sample SQL with a mistyped column (`countr`, line 7), already run. */
  error?: boolean;
  /** Run it as the console opens. */
  run?: boolean;
  /** Run was pressed with conditions to fix. */
  attempted?: boolean;
  /** The ms shown for a run; the measured time when left out. */
  duration?: number;
  tab?: 'results' | 'messages' | 'plan';
  /** Height of the results, 380 when left out. */
  height?: number;
  saved?: QueryEntry[]; recent?: QueryEntry[];
  historyOpen?: boolean; saveOpen?: boolean;
  /** A skeleton instead of the grid and Run off. */
  running?: boolean;
  /** A row of the results that starts open in the record editor. */
  openRow?: number;
}
