import { create } from 'zustand';
import type { ToastProps } from '../components/Toast';
import type { DiagramView } from '../core/diagramView';
import type { FocusDepth } from '../core/focusView';
import type { ExplorerScope } from '../core/explorer';
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
  | { kind: 'shortcuts' }
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
  /** Renames `version` of the open schema and writes a note on it. */
  | { kind: 'edit-version'; version: number }
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
  /** The Explorer's filter, and whether it looks at tables, columns or both. */
  explorerQuery: string;
  explorerScope: ExplorerScope;
  /** Which icon of the diagram rail is open: the Explorer, or the list of views. */
  diagramRail: 'explorer' | 'views';
  /**
   * Modules, Tables or Focus, for the schema it was chosen on. Null until the diagram is opened,
   * which then uses the default for how many tables it has.
   */
  diagramView: DiagramView | null;
  diagramFor: string | null;
  /** Hide hub lines starts on, for the module map. Inferred only starts off. Both are of this session. */
  hideHubLines: boolean;
  inferredOnly: boolean;
  /**
   * On the tables canvas a column that points at a hub is a tag instead of a line. The bar over
   * the canvas turns the lines back on. Starts on.
   */
  canvasHubsAsTags: boolean;
  /**
   * The tables the canvas shows while the schema is only being looked at: a module that was opened,
   * a saved view, a path. It stands in for the schema's own `shown` and is never saved, undone or
   * a change: only the Explorer and "Add to canvas" write `shown`. For the schema it was set on.
   */
  lookShown: string[] | null;
  lookShownFor: string | null;
  /**
   * Where the tables sit while a module is only being looked at. Opening a module arranges its
   * tables here and fits them; the schema's positions stay as they were until a table is dragged.
   */
  lookPositions: Positions | null;
  lookPositionsFor: string | null;
  /** The saved view the tables canvas is showing, for the schema id it was opened on. */
  activeViewId: number | null;
  activeViewSchema: number | null;
  /** The module card that is selected, for the schema it was selected on. */
  moduleSelection: string | null;
  moduleSelectionFor: string | null;
  /** How many steps Focus draws, and whether hubs are tags and cards show keys only. */
  focusDepth: FocusDepth;
  focusHubsAsTags: boolean;
  focusKeysOnly: boolean;
  /** Neighbours whose hidden relationships are open, and tables asked for with "+ Show". */
  focusExpanded: string[];
  focusRevealed: string[];
  /** The tables Focus has visited, newest last, for the schema it was walked on. */
  focusTrail: string[];
  focusTrailFor: string | null;
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
  setExplorerQuery: (explorerQuery: string) => void;
  setExplorerScope: (explorerScope: ExplorerScope) => void;
  setDiagramRail: (diagramRail: 'explorer' | 'views') => void;
  setDiagramView: (diagramView: DiagramView, schema: string) => void;
  setHideHubLines: (hideHubLines: boolean) => void;
  setInferredOnly: (inferredOnly: boolean) => void;
  setCanvasHubsAsTags: (canvasHubsAsTags: boolean) => void;
  /** Looks at `names` on the canvas, without changing the schema; null goes back to what the schema shows. */
  setLookShown: (names: readonly string[] | null, schema: string | null) => void;
  /** The arrangement a module is being looked at with. Null drops it. Setting what is shown drops it too. */
  setLookPositions: (positions: Positions | null, schema: string | null) => void;
  setActiveView: (id: number | null, schemaId: number | null) => void;
  setModuleSelection: (moduleSelection: string | null, schema: string) => void;
  setFocusDepth: (focusDepth: FocusDepth) => void;
  setFocusHubsAsTags: (focusHubsAsTags: boolean) => void;
  setFocusKeysOnly: (focusKeysOnly: boolean) => void;
  setFocusExpanded: (focusExpanded: string[]) => void;
  setFocusRevealed: (focusRevealed: string[]) => void;
  setFocusTrail: (focusTrail: string[], schema: string | null) => void;
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
  explorerQuery: '',
  explorerScope: 'all',
  diagramRail: 'explorer',
  diagramView: null,
  diagramFor: null,
  hideHubLines: true,
  inferredOnly: false,
  canvasHubsAsTags: true,
  lookShown: null,
  lookShownFor: null,
  lookPositions: null,
  lookPositionsFor: null,
  activeViewId: null,
  activeViewSchema: null,
  moduleSelection: null,
  moduleSelectionFor: null,
  focusDepth: 1,
  focusHubsAsTags: true,
  focusKeysOnly: false,
  focusExpanded: [],
  focusRevealed: [],
  focusTrail: [],
  focusTrailFor: null,
  renameSignal: 0,
  fitPending: false,
  dialog: null,
  toast: null,
  setRoute: (route) => set({ route }),
  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  setSearch: (search) => set({ search }),
  setExplorerQuery: (explorerQuery) => set({ explorerQuery }),
  setExplorerScope: (explorerScope) => set({ explorerScope }),
  setDiagramRail: (diagramRail) => set({ diagramRail }),
  setDiagramView: (diagramView, schema) => set({ diagramView, diagramFor: schema }),
  setHideHubLines: (hideHubLines) => set({ hideHubLines }),
  setInferredOnly: (inferredOnly) => set({ inferredOnly }),
  setCanvasHubsAsTags: (canvasHubsAsTags) => set({ canvasHubsAsTags }),
  setLookShown: (names, schema) =>
    set({
      lookShown: names ? [...names] : null,
      lookShownFor: names ? schema : null,
      lookPositions: null,
      lookPositionsFor: null,
    }),
  setLookPositions: (lookPositions, schema) => set({ lookPositions, lookPositionsFor: lookPositions ? schema : null }),
  setActiveView: (activeViewId, activeViewSchema) => set({ activeViewId, activeViewSchema }),
  setModuleSelection: (moduleSelection, schema) => set({ moduleSelection, moduleSelectionFor: schema }),
  setFocusDepth: (focusDepth) => set({ focusDepth }),
  setFocusHubsAsTags: (focusHubsAsTags) => set({ focusHubsAsTags }),
  setFocusKeysOnly: (focusKeysOnly) => set({ focusKeysOnly }),
  setFocusExpanded: (focusExpanded) => set({ focusExpanded }),
  setFocusRevealed: (focusRevealed) => set({ focusRevealed }),
  setFocusTrail: (focusTrail, schema) => set({ focusTrail, focusTrailFor: schema }),
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
