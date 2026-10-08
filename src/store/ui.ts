import { create } from 'zustand';
import type { ToastProps } from '../components/Toast';
import { clampZoom } from '../core/layout';
import type { Positions, Table, TableGroup } from '../core/model';
import { SCHEMAS_ROUTE, type Route } from '../core/routes';

/** The schema an export writes out: the tables as they are at the moment the dialog opens. */
export interface ExportSource {
  /** The schema's id in the database, by which its versions are read for a migration; null for one that is not stored. */
  id: number | null;
  name: string;
  engine: string;
  /** The saved version the tables are from; null for a schema that has not been saved. */
  version: number | null;
  tables: Table[];
  /** Where the tables are on the canvas and the groups they are in, for the diagram as a picture. */
  positions: Positions;
  groups: readonly TableGroup[];
  /** The tables have changes that `version` does not. */
  unsaved: boolean;
  /** Opens the dialog set to a migration from this version instead of the full DDL. */
  migrateFrom?: number;
}

/** The dialog open over the screen. */
export type Dialog =
  | { kind: 'delete-table'; table: string }
  | { kind: 'new-schema' }
  | { kind: 'import-schema' }
  | { kind: 'export'; schema: ExportSource }
  | { kind: 'settings' }
  /** Adds a foreign key to `table`, on one of its columns or on a new one. */
  | { kind: 'add-foreign-key'; table: string }
  /** Lists the inferred foreign keys of the open schema, to be accepted or removed one by one. */
  | { kind: 'review-inferred' }
  /** Lists the groups of tables of the open schema and the ones the names of its tables point to. */
  | { kind: 'table-groups' }
  /** `versions` is how many saved versions go with the schema. */
  | { kind: 'delete-schema'; id: number; name: string; versions: number }
  /** Asks before `version` of the open schema is made its current version again. */
  | { kind: 'restore-version'; version: number }
  /** Asks before the unsaved changes of the open schema are dropped; `onDiscard` then goes on. */
  | { kind: 'discard-changes'; onDiscard: () => void };

export type ToastContent = Omit<ToastProps, 'onClose'>;

export interface ToastMessage extends ToastContent {
  /** Tells one toast from the next, so a timer or action only ever dismisses its own. */
  id: number;
}

export interface UiState {
  /** What the main area shows. Change it through `go` in screens/navigation, which keeps the address in step. */
  route: Route;
  zoom: number;
  /** The toolbar search text; it filters the tables shown on the canvas. */
  search: string;
  /** Bumped each time the selected table should enter rename mode (F2, context menu). */
  renameSignal: number;
  /** Set when the canvas should fit the whole diagram once the workspace shows it, as after an import. */
  fitPending: boolean;
  /** While a dialog is open it owns the keyboard: the shortcuts of the screen under it are off. */
  dialog: Dialog | null;
  /** One toast shows at a time; a new one replaces it. */
  toast: ToastMessage | null;
  setRoute: (route: Route) => void;
  setZoom: (zoom: number) => void;
  setSearch: (search: string) => void;
  requestRename: () => void;
  setFitPending: (pending: boolean) => void;
  openDialog: (dialog: Dialog) => void;
  closeDialog: () => void;
  /** Returns the id to pass to `dismissToast`. */
  showToast: (toast: ToastContent) => number;
  /** Does nothing when another toast has replaced the one called `id`. */
  dismissToast: (id: number) => void;
}

let toastId = 0;

export const useUiStore = create<UiState>()((set, get) => ({
  route: SCHEMAS_ROUTE,
  zoom: 1,
  search: '',
  renameSignal: 0,
  fitPending: false,
  dialog: null,
  toast: null,
  setRoute: (route) => set({ route }),
  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  setSearch: (search) => set({ search }),
  requestRename: () => set((s) => ({ renameSignal: s.renameSignal + 1 })),
  setFitPending: (fitPending) => set({ fitPending }),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
  showToast: (toast) => {
    const id = ++toastId;
    set({ toast: { ...toast, id } });
    return id;
  },
  dismissToast: (id) => {
    if (get().toast?.id === id) set({ toast: null });
  },
}));
