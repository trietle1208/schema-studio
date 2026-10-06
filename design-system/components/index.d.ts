// Schema Studio — window.SchemaStudio (React 18). Types are documentation.
import type { ReactNode, CSSProperties } from 'react';

export type IconName = 'table' | 'database' | 'key' | 'link' | 'search' | 'plus' | 'minus' | 'undo' | 'redo' | 'zoom-in' | 'zoom-out' | 'fit' | 'download' | 'upload' | 'share' | 'settings' | 'keyboard' | 'chevron-down' | 'chevron-right' | 'chevron-up' | 'chevrons-ud' | 'arrow-up' | 'arrow-down' | 'arrow-right' | 'star' | 'clock' | 'layers' | 'history' | 'diff' | 'file' | 'file-code' | 'clipboard' | 'plug' | 'check' | 'check-circle' | 'x' | 'alert' | 'warning' | 'info' | 'trash' | 'copy' | 'pencil' | 'more' | 'filter' | 'grip' | 'hash' | 'columns' | 'folder' | 'code' | 'eye' | 'restore' | 'migration' | 'command' | 'sidebar' | 'panel' | 'move' | 'lock' | 'external';

export interface Column { name: string; type: string; nullable?: boolean; pk?: boolean; unique?: boolean; default?: string; comment?: string; fk?: { table: string; column: string; onDelete?: 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'NO ACTION' } | null; draft?: boolean; }
export interface Index { name: string; type: 'PRIMARY KEY' | 'UNIQUE' | 'INDEX'; using: string; columns: string[]; }
export interface Table { name: string; schema?: string; comment?: string; columns: Column[]; indexes?: Index[]; }
export type Positions = Record<string, { x: number; y: number }>;
export interface SchemaSummary { name: string; engine: string; tables: number; relationships?: number; version: string; updated: string; favorite?: boolean; }
export interface Version { version: string; current?: boolean; time: string; timestamp?: string; author: string; initials?: string; message: string; tables?: number; relationships?: number; added?: number; modified?: number; removed?: number; }
export interface DiffItem { op: 'add' | 'mod' | 'del'; path: string; detail?: string; }
export interface DiffGroup { group: string; items: DiffItem[]; }
export interface MenuItem { icon?: IconName; label: string; shortcut?: string; danger?: boolean; active?: boolean; onSelect?: () => void; }

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
export interface ToolbarProps { schema?: string; engine?: string; version?: string; saveState?: 'saved' | 'dirty' | 'saving'; onSave?: () => void; zoom?: number; onZoom?: (z: number) => void; onFit?: () => void; onUndo?: () => void; onRedo?: () => void; canUndo?: boolean; canRedo?: boolean; search?: string; onSearch?: (q: string) => void; onHistory?: () => void; onShare?: () => void; onExport?: () => void; }
export interface StatusBarProps { left?: ReactNode[]; right?: ReactNode[]; }
export interface TableNodeProps { table: Table; x?: number; y?: number; static?: boolean; selected?: boolean; selectedColumn?: number | null; onSelect?: (name: string) => void; onSelectColumn?: (i: number) => void; dimmed?: boolean; dragging?: boolean; dirty?: boolean; invalidColumns?: number[]; state?: 'added' | 'removed'; style?: CSSProperties; }
export interface ERCanvasProps { tables: Table[]; positions?: Positions; onMove?: (name: string, xy: { x: number; y: number }) => void; onMoveEnd?: (name: string) => void; selected?: string | null; onSelect?: (name: string | null) => void; selectedColumn?: number | null; onSelectColumn?: (i: number | null) => void; zoom?: number; offset?: { x: number; y: number }; fitSignal?: number; dimUnrelated?: boolean; dirtyTables?: string[]; invalidColumns?: number[]; menuItems?: (table: string, close: () => void) => (MenuItem | '-')[]; onDeleteTable?: (name: string) => void; initialMenu?: { table: string; x: number; y: number }; hint?: ReactNode; showLegend?: boolean; showMinimap?: boolean; }
export interface InspectorProps { table: Table | null; tables?: Table[]; selectedColumn?: number | null; onSelectColumn?: (i: number | null) => void; onChange: (t: Table) => void; onRename?: (from: string, to: string) => void; onDuplicate?: (name: string) => void; onDelete?: (name: string) => void; typeMenuOpen?: boolean; renaming?: boolean; settingsCollapsed?: boolean; schemaName?: string; }
export interface TypeSelectProps { value: string; onChange?: (t: string) => void; size?: 'md' | 'sm'; error?: boolean; defaultOpen?: boolean; placement?: 'bottom' | 'top'; align?: 'start' | 'end'; }
export interface ContextMenuProps { items: (MenuItem | '-')[]; label?: string; onClose?: () => void; style?: CSSProperties; }
export interface ModalProps { title: ReactNode; subtitle?: ReactNode; icon?: IconName; onClose?: () => void; width?: number; footer?: ReactNode; footerStart?: ReactNode; headerAside?: ReactNode; bodyStyle?: CSSProperties; children?: ReactNode; }
export interface ConfirmDialogProps { title: ReactNode; danger?: boolean; confirmLabel?: string; cancelLabel?: string; onConfirm?: () => void; onCancel?: () => void; width?: number; children?: ReactNode; }
export interface DropZoneProps { file?: { name: string; meta?: string } | null; onFile?: (f: { name: string; meta?: string } | null) => void; over?: boolean; hint?: ReactNode; }
export interface SqlEditorProps { value?: string; defaultValue?: string; onChange?: (sql: string) => void; height?: number; errorLine?: number | null; firstLine?: number; readOnly?: boolean; placeholder?: string; label?: string; }
export interface ParseStatusProps { state?: 'idle' | 'parsing' | 'ok' | 'error'; summary?: string; message?: string; onJump?: () => void; aside?: ReactNode; }
export interface ImportSchemaDialogProps { mode?: 'file' | 'paste'; engine?: string; file?: { name: string; meta?: string } | null; sql?: string; summary?: string; state?: 'error'; error?: string; errorLine?: number; firstLine?: number; name?: string; pasteHeight?: number; onImport?: (r: { name: string; engine: string; mode: string }) => void; onClose?: () => void; }
export interface ExportDialogProps { format?: 'sql' | 'json'; migration?: boolean; onExport?: () => void; onClose?: () => void; }
export interface ToastProps { tone?: 'success' | 'error' | 'info'; title: ReactNode; description?: ReactNode; actions?: { label: string; onClick?: () => void }[]; onClose?: (() => void) | false; }
export interface AlertProps { tone?: 'info' | 'success' | 'warn' | 'error'; title?: ReactNode; action?: ReactNode; children?: ReactNode; }
export interface DataTableProps<R = any> { columns: { key: string; label: ReactNode; width?: number | string; align?: 'left' | 'right' | 'center'; numeric?: boolean; sortable?: boolean; render?: (row: R) => ReactNode }[]; rows: R[]; rowKey?: string; sort?: { key: string; dir: 'asc' | 'desc' }; onSort?: (s: { key: string; dir: 'asc' | 'desc' }) => void; selectedKey?: string; onRowClick?: (row: R) => void; }
export interface VersionListProps { versions?: Version[]; selected?: string; onSelect?: (v: string) => void; }
export interface DiffListProps { groups?: DiffGroup[]; selected?: string; onSelect?: (path: string) => void; showGroups?: boolean; showDetail?: boolean; showKind?: boolean; }
export interface DdlDiffProps { rows: [string | null, (string | null)?, ('same' | 'add' | 'del' | 'mod' | 'fold')?, number?][]; leftTitle?: ReactNode; rightTitle?: ReactNode; leftMeta?: ReactNode; rightMeta?: ReactNode; style?: CSSProperties; }
export interface EmptyStateProps { title?: ReactNode; description?: ReactNode; onImport?: () => void; onCreate?: () => void; hints?: boolean; }
export interface WorkspaceProps { tables?: Table[]; positions?: Positions; selected?: string | null; selectedColumn?: number | null; zoom?: number; dirty?: boolean; dirtyTables?: string[]; version?: number; toast?: ToastProps; confirmDelete?: string; initialMenu?: { table: string; x: number; y: number }; typeMenuOpen?: boolean; renaming?: boolean; autoFocusDraft?: boolean; settingsCollapsed?: boolean; canvasHint?: ReactNode; inspector?: boolean; overlay?: ReactNode; onExport?: () => void; onHistory?: () => void; onShare?: () => void; }
export interface AppShellProps { sidebar?: ReactNode | false; overlay?: ReactNode; style?: CSSProperties; children?: ReactNode; }
