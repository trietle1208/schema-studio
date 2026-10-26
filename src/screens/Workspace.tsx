import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useShallow } from 'zustand/react/shallow';
import { ERCanvas, type ERCanvasActions } from '../components/ERCanvas';
import { Explorer } from '../components/Explorer';
import { FocusInspector } from '../components/FocusInspector';
import { FocusView } from '../components/FocusView';
import { ModulesView } from '../components/ModulesView';
import { ModuleInspector } from '../components/ModuleInspector';
import { Inspector } from '../components/Inspector';
import { ResizeHandle } from '../components/ResizeHandle';
import { StatusBar } from '../components/StatusBar';
import { Toolbar } from '../components/Toolbar';
import { arrangeOnly, arrangeTables as arrangePlacements } from '../core/arrange';
import { defaultDiagramView, moduleCards, savedModuleGroup, type DiagramView } from '../core/diagramView';
import { moveTables as movePlacements, resizeTables as resizePlacements, showColumns as showColumnChoice, type ColumnsChoice } from '../core/edit';
import { focusGraph, focusViewName } from '../core/focusView';
import {
  canvasStubs,
  EXPLORER_MAX,
  EXPLORER_MIN,
  EXPLORER_WIDTH,
  foldQuery,
  moduleColor,
  placeStubs,
  stubLinks,
  visibleNames,
} from '../core/explorer';
import { assignGroup, groupNameProblem, renameGroup } from '../core/groups';
import { formatNumber, t } from '../core/i18n';
import { newTablePosition } from '../core/layout';
import type { GroupColor, Positions } from '../core/model';
import { overlayPositions, pickPositions, viewAt, viewIsShowing } from '../core/views';
import { findHubs, suggestModules, type SchemaPath } from '../core/modules';
import { countInferred, countRelations, relatedTables } from '../core/relations';
import { SCHEMAS_ROUTE } from '../core/routes';
import { searchTables } from '../core/search';
import { relationshipCount } from '../core/summary';
import { findProblems } from '../core/validate';
import { versionLabel } from '../core/versions';
import type { DiagramViewRecord } from '../db/db';
import { DiagramViewError, deleteDiagramView, listDiagramViews, placeDiagramView, renameDiagramView, restoreDiagramView, saveDiagramView, upsertDiagramView } from '../db/views';
import {
  redo,
  selectDirty,
  selectDirtyTables,
  selectFocused,
  selectTable,
  undo,
  useCanRedo,
  useCanUndo,
  useSchemaStore,
} from '../store/schema';
import { useSettingsStore } from '../store/settings';
import { useUiStore } from '../store/ui';
import { requestExport } from './exportActions';
import { useWorkspaceShortcuts } from './useWorkspaceShortcuts';
import { go } from './navigation';
import { PanelHandle } from './PanelHandle';
import {
  arrangeTables,
  copyCreateTable,
  copyTableName,
  drawForeignKey,
  focusBack,
  focusRelatedTables,
  focusTrailTo,
  groupTables,
  groupTablesAsNew,
  inferRelationships,
  chooseDiagramView,
  lookAt,
  newTable,
  openMode,
  openModule,
  removeInferredRelationships,
  requestAddForeignKey,
  requestDeleteTable,
  requestReviewInferred,
  requestTableGroups,
  saveSchema,
  searchFor,
  showAllTables,
  showColumns,
  showTables,
  stageLookPositions,
} from './workspaceActions';

const NO_HUBS: ReadonlySet<string> = new Set();

export function Workspace() {
  const name = useSchemaStore((s) => s.name);
  const engine = useSchemaStore((s) => s.engine);
  const version = useSchemaStore((s) => s.version);
  const stored = useSchemaStore((s) => s.id !== null);
  const schemaId = useSchemaStore((s) => s.id);
  const saving = useSchemaStore((s) => s.saving);
  const tables = useSchemaStore((s) => s.tables);
  const positions = useSchemaStore((s) => s.positions);
  const groups = useSchemaStore((s) => s.groups);
  const savedShown = useSchemaStore((s) => s.shown);
  const lookShown = useUiStore((s) => s.lookShown);
  const lookShownFor = useUiStore((s) => s.lookShownFor);
  const lookPositions = useUiStore((s) => s.lookPositions);
  const lookPositionsFor = useUiStore((s) => s.lookPositionsFor);
  const editGroups = useSchemaStore((s) => s.editGroups);
  const selected = useSchemaStore((s) => s.selected);
  const selection = useSchemaStore((s) => s.selection);
  const selectedColumn = useSchemaStore((s) => s.selectedColumn);
  const focused = useSchemaStore(selectFocused);
  const table = useSchemaStore(selectTable);
  const dirty = useSchemaStore(selectDirty);
  const dirtyTables = useSchemaStore(useShallow(selectDirtyTables));
  const select = useSchemaStore((s) => s.select);
  const selectTables = useSchemaStore((s) => s.selectTables);
  const selectColumn = useSchemaStore((s) => s.selectColumn);
  const moveTables = useSchemaStore((s) => s.moveTables);
  const resizeTables = useSchemaStore((s) => s.resizeTables);
  const notation = useSettingsStore((s) => s.notation);
  const stubNoteSeen = useSettingsStore((s) => s.stubNoteSeen);
  const dismissStubNote = useSettingsStore((s) => s.dismissStubNote);
  const explorerWidth = useSettingsStore((s) => s.explorerWidth);
  const setExplorerWidth = useSettingsStore((s) => s.setExplorerWidth);
  const inspectorWidth = useSettingsStore((s) => s.panels.inspector);
  const diagramRail = useUiStore((s) => s.diagramRail);
  const diagramFor = useUiStore((s) => s.diagramFor);
  const storedView = useUiStore((s) => s.diagramView);
  const setDiagramView = useUiStore((s) => s.setDiagramView);
  const hideHubLines = useUiStore((s) => s.hideHubLines);
  const setHideHubLines = useUiStore((s) => s.setHideHubLines);
  const canvasHubsAsTags = useUiStore((s) => s.canvasHubsAsTags);
  const setCanvasHubsAsTags = useUiStore((s) => s.setCanvasHubsAsTags);
  const activeViewId = useUiStore((s) => s.activeViewId);
  const activeViewSchema = useUiStore((s) => s.activeViewSchema);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const inferredOnly = useUiStore((s) => s.inferredOnly);
  const setInferredOnly = useUiStore((s) => s.setInferredOnly);
  const moduleSelection = useUiStore((s) => s.moduleSelection);
  const moduleSelectionFor = useUiStore((s) => s.moduleSelectionFor);
  const setModuleSelection = useUiStore((s) => s.setModuleSelection);
  const focusDepth = useUiStore((s) => s.focusDepth);
  const setFocusDepth = useUiStore((s) => s.setFocusDepth);
  const focusHubsAsTags = useUiStore((s) => s.focusHubsAsTags);
  const setFocusHubsAsTags = useUiStore((s) => s.setFocusHubsAsTags);
  const focusKeysOnly = useUiStore((s) => s.focusKeysOnly);
  const setFocusKeysOnly = useUiStore((s) => s.setFocusKeysOnly);
  const focusExpanded = useUiStore((s) => s.focusExpanded);
  const focusRevealed = useUiStore((s) => s.focusRevealed);
  const focusTrail = useUiStore((s) => s.focusTrail);
  const focusTrailFor = useUiStore((s) => s.focusTrailFor);
  const showToast = useUiStore((s) => s.showToast);
  const explorerQuery = useUiStore((s) => s.explorerQuery);
  const explorerScope = useUiStore((s) => s.explorerScope);
  const endMove = useSchemaStore((s) => s.endMove);
  const updateTable = useSchemaStore((s) => s.updateTable);
  const renameTable = useSchemaStore((s) => s.renameTable);
  const duplicateTable = useSchemaStore((s) => s.duplicateTable);
  const addColumn = useSchemaStore((s) => s.addColumn);
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const zoom = useUiStore((s) => s.zoom);
  const setZoom = useUiStore((s) => s.setZoom);
  const search = useUiStore((s) => s.search);
  const renameSignal = useUiStore((s) => s.renameSignal);
  const requestRename = useUiStore((s) => s.requestRename);
  const fitPending = useUiStore((s) => s.fitPending);
  const setFitPending = useUiStore((s) => s.setFitPending);

  const searchRef = useRef<HTMLInputElement>(null);
  const canvas = useRef<ERCanvasActions>(null);
  const pendingLocate = useRef<string | null>(null);
  const [pointed, setPointed] = useState<string | null>(null);
  const [localViews, setLocalViews] = useState<DiagramViewRecord[]>([]);
  const [pendingView, setPendingView] = useState<DiagramViewRecord | null>(null);
  const [placed, setPlaced] = useState<{ id: number; positions: Positions } | null>(null);
  const dbViews = useLiveQuery(() => (schemaId === null ? [] : listDiagramViews(schemaId)), [schemaId], []);
  const listed = schemaId === null ? localViews : (dbViews ?? []);
  const savedViews =
    pendingView && pendingView.schemaId === schemaId && !listed.some((view) => view.id === pendingView.id)
      ? [...listed, pendingView].sort((a, b) => a.at - b.at || a.id - b.id)
      : listed;

  // A schema that was just imported is shown whole, wherever the canvas was panned to before.
  useEffect(() => {
    if (!fitPending) return;
    canvas.current?.fit();
    setFitPending(false);
  }, [fitPending, setFitPending]);

  // What is being looked at (a module that was opened) stands in for what the schema keeps.
  const shown = lookShownFor === name && lookShown ? lookShown : savedShown;
  const modules = useMemo(() => suggestModules(tables), [tables]);
  const onCanvas = useMemo(() => {
    if (focused !== null) return relatedTables(tables, focused);
    const keep = new Set(visibleNames(tables, modules, shown));
    return tables.filter((table) => keep.has(table.name));
  }, [tables, modules, shown, focused]);
  // A focus leaves the table it is on and the tables related to it; the search then looks through what is left.
  const visible = useMemo(() => searchTables(onCanvas, search), [onCanvas, search]);
  const drawn = useMemo(() => new Set(visible.map((table) => table.name)), [visible]);
  const hubs = useMemo(() => findHubs(tables), [tables]);
  const hubNames = useMemo(() => new Set(hubs.map((hub) => hub.table)), [hubs]);
  const tagHubs = canvasHubsAsTags && hubs.length > 0 ? hubNames : NO_HUBS;
  const diagramView: DiagramView = diagramFor === name && storedView ? storedView : defaultDiagramView(tables.length);
  const canvasNames = useMemo(() => visibleNames(tables, modules, shown), [tables, modules, shown]);
  const activeView = savedViews.find((view) => view.id === activeViewId && activeViewSchema === schemaId) ?? null;
  const liveView = activeView && viewIsShowing(tables, activeView.tables, canvasNames) ? activeView : null;
  const viewPositions = placed && liveView && placed.id === liveView.id ? placed.positions : liveView?.positions;
  const canvasPositions = useMemo(() => {
    // A module that was opened is arranged for the look. Those positions are not the schema's yet.
    const base = lookPositionsFor === name && lookPositions ? lookPositions : positions;
    return diagramView === 'tables' && viewPositions ? overlayPositions(base, viewPositions) : base;
  }, [diagramView, viewPositions, positions, lookPositions, lookPositionsFor, name]);
  const stubs = useMemo(
    () => placeStubs(visible, canvasPositions, canvasStubs(tables, modules, drawn, tagHubs)),
    [visible, canvasPositions, tables, modules, drawn, tagHubs],
  );

  // The stub hint is shown once, beside the legend. Leaving the tables canvas remembers that.
  useEffect(() => {
    if (diagramView !== 'tables' || stubNoteSeen || stubs.length === 0) return;
    return () => {
      if (useUiStore.getState().diagramView !== 'tables') dismissStubNote();
    };
  }, [diagramView, stubNoteSeen, stubs.length, dismissStubNote]);
  const links = useMemo(() => stubLinks(tables, drawn, new Set(stubs.map((stub) => stub.table))), [tables, drawn, stubs]);
  const needle = foldQuery(explorerQuery.trim());
  const markedColumns = useMemo(() => {
    const marks = new Map<string, ReadonlySet<string>>();
    if (!needle || explorerScope === 'tables') return marks;
    for (const table of visible) {
      const columns = new Set(table.columns.filter((column) => foldQuery(column.name).includes(needle)).map((column) => column.name));
      if (columns.size) marks.set(table.name, columns);
    }
    return marks;
  }, [visible, needle, explorerScope]);
  const highlightCount = !needle
    ? 0
    : visible.filter(
        (table) =>
          (explorerScope !== 'columns' && foldQuery(table.name).includes(needle)) ||
          (explorerScope !== 'tables' && table.columns.some((column) => foldQuery(column.name).includes(needle))),
      ).length;
  const hubNote = hubs.map((hub) => `${hub.table} · ${formatNumber(hub.referencedBy)}`).join('   ');

  const selectedModule = moduleSelectionFor === name ? moduleSelection : null;
  const trail = focusTrailFor === name ? focusTrail : [];
  const focusModel = useMemo(() => {
    if (diagramView !== 'focus' || !focused) return null;
    return focusGraph(tables, focused, modules, {
      depth: focusDepth,
      expanded: new Set(focusExpanded),
      revealed: new Set(focusRevealed),
      hubsAsTags: focusHubsAsTags,
      keysOnly: focusKeysOnly,
    });
  }, [diagramView, focused, tables, modules, focusDepth, focusExpanded, focusRevealed, focusHubsAsTags, focusKeysOnly]);
  const focusDrawn = useMemo(() => new Set(focusModel?.nodes.map((node) => node.table) ?? []), [focusModel]);
  const moduleCount = useMemo(() => moduleCards(tables, modules).length, [tables, modules]);

  const chooseView = (next: DiagramView) => chooseDiagramView(next, selected);

  const renameModule = (members: readonly string[], from: string, to: string, color: GroupColor) => {
    const problem = groupNameProblem(groups, to, from);
    if (problem) {
      showToast({ tone: 'error', title: problem });
      return;
    }
    editGroups((list) => {
      const exact = savedModuleGroup(list, members);
      if (exact) return renameGroup(list, exact.name, to);
      return assignGroup(list, members, to, color);
    });
  };

  const toggleExpanded = (tableName: string) => {
    const current = useUiStore.getState().focusExpanded;
    useUiStore.getState().setFocusExpanded(
      current.includes(tableName) ? current.filter((item) => item !== tableName) : [...current, tableName],
    );
  };

  const revealTable = (tableName: string) => {
    const current = useUiStore.getState().focusRevealed;
    if (!current.includes(tableName)) useUiStore.getState().setFocusRevealed([...current, tableName]);
  };

  const addToCanvas = (names: readonly string[]) => {
    const have = new Set(visibleNames(tables, modules, shown));
    const adding = names.filter((item) => !have.has(item));
    showTables([...have, ...names]);
    showToast({
      title: adding.length ? t('focus.added', { count: adding.length }) : t('explorer.already', { count: names.length }),
    });
  };

  const saveFocusView = (names: readonly string[]) => {
    if (!focused) return;
    const viewName = focusViewName(modules, focused);
    void keepView({ name: viewName, tables: [...names], positions: pickPositions(positions, names) }, true);
  };

  const openSaved = (view: { id: number; tables: readonly string[] }) => {
    showAllTables();
    lookAt(view.tables);
    setActiveView(view.id, schemaId);
    setDiagramView('tables', name);
    setPlaced(null);
    setFitPending(true);
  };

  const rejectView = (error: unknown, viewName: string, key: 'saveFailed' | 'renameFailed' | 'deleteFailed' | 'restoreFailed') => {
    console.error(error);
    if (error instanceof DiagramViewError) {
      showToast({
        tone: 'error',
        title: error.problem === 'empty' ? t('explorer.viewEmpty') : t('explorer.viewExists', { name: viewName }),
      });
      return;
    }
    showToast({ tone: 'error', title: t(`explorer.${key}.title`), description: t(`explorer.${key}.description`) });
  };

  const keepView = (data: { name: string; tables: string[]; positions: Positions }, replace: boolean) => {
    const viewName = data.name.trim();
    if (!viewName) {
      showToast({ tone: 'error', title: t('explorer.viewEmpty') });
      return;
    }
    if (schemaId === null) {
      const index = localViews.findIndex((view) => view.name === viewName);
      if (index >= 0 && !replace) {
        showToast({ tone: 'error', title: t('explorer.viewExists', { name: viewName }) });
        return;
      }
      if (index >= 0) {
        setLocalViews((list) => {
          const next = list.slice();
          const current = next[index];
          if (current) next[index] = { ...current, tables: data.tables, positions: data.positions };
          return next;
        });
      } else {
        const record: DiagramViewRecord = {
          id: Date.now(),
          schemaId: 0,
          name: viewName,
          tables: data.tables,
          positions: data.positions,
          at: Date.now(),
        };
        setLocalViews((list) => [...list, record]);
        openSaved(record);
      }
      showToast({ title: t('focus.saved', { name: viewName }) });
      return;
    }
    const write = replace ? upsertDiagramView(schemaId, data) : saveDiagramView(schemaId, data);
    void write.then(
      (saved) => {
        setPendingView(saved);
        if (!replace) openSaved(saved);
        showToast({ title: t('focus.saved', { name: saved.name }) });
      },
      (error) => rejectView(error, viewName, 'saveFailed'),
    );
  };

  const remember = (id: number, next: Positions) => {
    setPlaced({ id, positions: next });
    if (schemaId === null) {
      setLocalViews((list) => list.map((view) => (view.id === id ? { ...view, positions: next } : view)));
      return;
    }
    void placeDiagramView(schemaId, id, next).catch((error) => rejectView(error, '', 'saveFailed'));
  };

  const viewSnapshot = () => ({
    tables,
    positions: overlayPositions(positions, viewPositions ?? {}),
    groups,
    ...(shown ? { shown } : {}),
  });

  const placeView = (next: Positions) => {
    if (!liveView) return;
    remember(liveView.id, pickPositions(next, liveView.tables));
  };

  const moveCurrent = (patch: Positions) => {
    if (!liveView || diagramView !== 'tables') {
      stageLookPositions();
      moveTables(patch);
      return;
    }
    const snapshot = viewSnapshot();
    const next = movePlacements(snapshot, patch);
    if (next !== snapshot) placeView(next.positions);
  };

  const resizeCurrent = (patch: Positions) => {
    if (!liveView || diagramView !== 'tables') {
      stageLookPositions();
      resizeTables(patch);
      return;
    }
    const snapshot = viewSnapshot();
    const next = resizePlacements(snapshot, patch);
    if (next !== snapshot) placeView(next.positions);
  };

  const arrangeCurrent = () => {
    if (!liveView || diagramView !== 'tables') {
      const staged = stageLookPositions();
      arrangeTables();
      if (staged) endMove();
      return;
    }
    const base = overlayPositions(positions, viewPositions ?? {});
    const names = visibleNames(tables, modules, shown);
    const multi = selection.length > 1;
    const picked = multi ? selection.filter((item) => names.includes(item)) : names;
    if (multi && !picked.length) return;
    const partial = multi || names.length < tables.length;
    const next = partial ? arrangeOnly(tables, base, picked) : arrangePlacements(tables, base);
    const before = pickPositions(base, liveView.tables);
    const after = pickPositions(next, liveView.tables);
    const moved = liveView.tables.some((item) => {
      const from = before[item];
      const to = after[item];
      return !from || !to || from.x !== to.x || from.y !== to.y;
    });
    if (!moved) {
      showToast({ tone: 'info', title: t(multi ? 'toast.arranged.alreadySelected' : 'toast.arranged.already') });
      return;
    }
    remember(liveView.id, after);
    if (!multi) setFitPending(true);
    showToast(
      multi
        ? { title: t('toast.arrangedSelected.title', { count: picked.length }), description: t('toast.arrangedSelected.description') }
        : { title: t('toast.arranged.title', { count: picked.length }), description: t('toast.arranged.description') },
    );
  };

  const showCurrentColumns = (choice: ColumnsChoice, names?: readonly string[]) => {
    if (!liveView || diagramView !== 'tables') {
      showColumns(choice, names);
      return;
    }
    const snapshot = viewSnapshot();
    const next = showColumnChoice(snapshot, choice, names);
    if (next !== snapshot) placeView(next.positions);
  };

  const renameView = (id: number, raw: string) => {
    const current = savedViews.find((view) => view.id === id);
    const next = raw.trim();
    if (!current || next === current.name) return;
    if (schemaId === null) {
      if (!next) {
        showToast({ tone: 'error', title: t('explorer.viewEmpty') });
        return;
      }
      if (localViews.some((view) => view.name === next && view.id !== id)) {
        showToast({ tone: 'error', title: t('explorer.viewExists', { name: next }) });
        return;
      }
      setLocalViews((list) => list.map((view) => (view.id === id ? { ...view, name: next } : view)));
      return;
    }
    void renameDiagramView(schemaId, id, raw).catch((error) => rejectView(error, next, 'renameFailed'));
  };

  const deleteView = (view: DiagramViewRecord) => {
    const clear = () => {
      if (useUiStore.getState().activeViewId === view.id) setActiveView(null, null);
    };
    const announce = () => {
      const toast = showToast({
        tone: 'info',
        title: t('explorer.deleted.title', { name: view.name }),
        description: t('explorer.deleted.description'),
        actions: [
          {
            label: t('common.undo'),
            onClick: () => {
              useUiStore.getState().dismissToast(toast);
              if (schemaId === null) {
                setLocalViews((list) => [...list, view].sort((a, b) => a.at - b.at || a.id - b.id));
                return;
              }
              void restoreDiagramView(view).catch((error) => rejectView(error, view.name, 'restoreFailed'));
            },
          },
        ],
      });
    };
    if (schemaId === null) {
      setLocalViews((list) => list.filter((item) => item.id !== view.id));
      clear();
      announce();
      return;
    }
    void deleteDiagramView(schemaId, view.id).then(
      (removed) => {
        clear();
        if (removed) announce();
      },
      (error) => rejectView(error, view.name, 'deleteFailed'),
    );
  };

  useEffect(() => {
    if (!activeView || activeViewSchema !== schemaId) return;
    if (!viewIsShowing(tables, activeView.tables, canvasNames)) setActiveView(null, null);
  }, [activeView, activeViewSchema, schemaId, tables, canvasNames, setActiveView]);

  useWorkspaceShortcuts(searchRef, 'diagram', {
    onSavedView: (index) => {
      const view = viewAt(savedViews, index);
      if (view) openSaved(view);
    },
  });

  const showPath = (path: SchemaPath) => {
    lookAt(path.tables);
    showAllTables();
    const end = path.tables[path.tables.length - 1];
    if (end) useSchemaStore.getState().select(end);
    setFitPending(true);
    showToast({ title: t('focus.pathShown', { count: path.tables.length }) });
  };

  const locate = (tableName: string) => {
    const showing = new Set(visibleNames(tables, modules, shown));
    if (diagramView !== 'tables') {
      showAllTables();
      setDiagramView('tables', name);
    }
    if (!showing.has(tableName) || diagramView !== 'tables') {
      pendingLocate.current = tableName;
      if (!showing.has(tableName)) showTables([...showing, tableName]);
      return;
    }
    canvas.current?.locate(tableName);
  };

  useEffect(() => {
    if (!pendingLocate.current || diagramView === 'modules') return;
    canvas.current?.locate(pendingLocate.current);
    pendingLocate.current = null;
  }, [shown, tables, positions, diagramView]);
  // A selected table that the search or the focus hides stays in the inspector, but the canvas has nothing to highlight.
  const selectedInView = selected !== null && visible.some((t) => t.name === selected) ? selected : null;
  const problems = useMemo(() => findProblems(tables), [tables]);
  const invalidColumns = useMemo(
    () => problems.filter((p) => p.table === selected).map((p) => p.column),
    [problems, selected],
  );
  const relationships = useMemo(() => countRelations(tables), [tables]);
  const inferred = useMemo(() => countInferred(tables), [tables]);

  // A schema that is not stored yet is unsaved even with no edits.
  const saveState = saving ? 'saving' : dirty || !stored ? 'dirty' : 'saved';

  const focusTable = focused ? (tables.find((item) => item.name === focused) ?? null) : null;
  const column = table && selectedColumn !== null ? table.columns[selectedColumn] : undefined;
  const several = selection.length > 1;
  let selectionText = several ? t('status.selected', { count: selection.length }) : t('status.nothingSelected');
  if (table) selectionText = `${table.schema || 'public'}.${table.name}${column ? `.${column.name || '?'}` : ''}`;

  return (
    <>
      <Toolbar
        schema={name}
        engine={engine}
        version={version === null ? undefined : versionLabel(version)}
        mode="diagram"
        onMode={openMode}
        dataDisabled={tables.length === 0}
        saveState={saveState}
        onSave={saveSchema}
        zoom={zoom}
        onZoom={setZoom}
        onFit={() => canvas.current?.fit()}
        onArrange={tables.length ? arrangeCurrent : undefined}
        arrangeSelected={several}
        onShowColumns={tables.length ? (choice) => showCurrentColumns(choice, several ? selection : undefined) : undefined}
        columnsSelected={several}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        search={search}
        onSearch={searchFor}
        onSearchSubmit={() => {
          if (search.trim() && visible[0]) select(visible[0].name);
        }}
        searchRef={searchRef}
        onSchemas={() => go(SCHEMAS_ROUTE)}
        diagramView={diagramView}
        onDiagramView={chooseView}
        onHistory={() => go({ screen: 'history', schema: name })}
        onExport={requestExport}
        chrome="centered"
      />
      <div className="ss-work">
        <Explorer
          tables={tables}
          groups={groups}
          shown={shown}
          selected={selected}
          width={explorerWidth}
          pane={diagramRail}
          onShown={(names) => {
            showTables(names);
            const ui = useUiStore.getState();
            const view = savedViews.find((item) => item.id === ui.activeViewId && ui.activeViewSchema === schemaId);
            if (view && !viewIsShowing(tables, view.tables, names)) setActiveView(null, null);
          }}
          onSelect={select}
          onHover={setPointed}
          onLocate={locate}
          onFocus={(tableName) => {
            setDiagramView('focus', name);
            focusRelatedTables(tableName);
          }}
          modulesActive={diagramView === 'modules'}
          onModules={() => chooseView('modules')}
          onInfer={inferRelationships}
          onMove={(tableName, module, color) => editGroups((list) => assignGroup(list, [tableName], module, color))}
          onCopy={(tableName) => void copyTableName(tableName)}
          views={savedViews}
          activeViewId={diagramView === 'tables' && activeViewSchema === schemaId ? activeViewId : null}
          onOpenView={openSaved}
          onCreateView={(viewName) => {
            const names = visibleNames(tables, modules, shown);
            const place = pickPositions(diagramView === 'tables' ? canvasPositions : positions, names);
            keepView({ name: viewName, tables: names, positions: place }, false);
          }}
          onRenameView={renameView}
          onDeleteView={(view) => {
            const full = savedViews.find((item) => item.id === view.id);
            if (full) deleteView(full);
          }}
          schemaName={name}
        />
        <ResizeHandle
          label={t('explorer.resize')}
          edge="right"
          width={explorerWidth}
          min={EXPLORER_MIN}
          max={EXPLORER_MAX}
          onResize={(next) => setExplorerWidth(next, window.innerWidth - 48 - inspectorWidth - 400)}
          onReset={() => setExplorerWidth(EXPLORER_WIDTH)}
        />
        {diagramView === 'modules' ? (
          <ModulesView
            tables={tables}
            modules={modules}
            groups={groups}
            selected={selectedModule}
            onSelect={(moduleName) => setModuleSelection(moduleName, name)}
            onOpen={openModule}
            onFocus={(tableName) => {
              setDiagramView('focus', name);
              focusRelatedTables(tableName);
            }}
            onRename={renameModule}
            hideHubs={hideHubLines}
            onHideHubs={setHideHubLines}
            inferredOnly={inferredOnly}
            onInferredOnly={setInferredOnly}
          />
        ) : diagramView === 'focus' ? (
          <FocusView
            groups={groups}
            modules={modules}
            graph={focusModel}
            center={focused}
            trail={trail}
            depth={focusDepth}
            hubsAsTags={focusHubsAsTags}
            keysOnly={focusKeysOnly}
            onDepth={setFocusDepth}
            onHubsAsTags={setFocusHubsAsTags}
            onKeysOnly={setFocusKeysOnly}
            onToggleExpanded={toggleExpanded}
            onFocus={focusRelatedTables}
            onBack={focusBack}
            onTrail={focusTrailTo}
            onAddToCanvas={addToCanvas}
            onSaveView={saveFocusView}
            onPath={() => document.getElementById('ss-focus-path')?.focus()}
          />
        ) : (
        <ERCanvas
          tables={visible}
          positions={canvasPositions}
          onMoveTables={moveCurrent}
          onResizeTables={resizeCurrent}
          onMoveEnd={endMove}
          selected={selectedInView}
          onSelect={select}
          selection={selection}
          onSelectTables={selectTables}
          selectedColumn={selectedColumn}
          onSelectColumn={selectColumn}
          zoom={zoom}
          onZoom={setZoom}
          dimUnrelated
          dirtyTables={dirtyTables}
          invalidColumns={invalidColumns}
          onRenameTable={requestRename}
          onDuplicateTable={duplicateTable}
          onDeleteTable={requestDeleteTable}
          onAddColumn={addColumn}
          onAddForeignKey={requestAddForeignKey}
          onDrawForeignKey={drawForeignKey}
          onCopyCreateTable={(table) => void copyCreateTable(table)}
          onFocusRelated={focusRelatedTables}
          focused={focused}
          onShowAll={showAllTables}
          onNewTable={newTable}
          onArrange={tables.length ? arrangeCurrent : undefined}
          onShowColumns={showCurrentColumns}
          notation={notation}
          groups={groups}
          onGroups={requestTableGroups}
          onInferRelations={inferRelationships}
          onReviewInferred={inferred ? requestReviewInferred : undefined}
          onRemoveInferred={inferred ? removeInferredRelationships : undefined}
          pointed={pointed}
          markedColumns={markedColumns}
          hubTags={tagHubs}
          hubsAsTags={canvasHubsAsTags}
          onHubsAsTags={hubs.length ? setCanvasHubsAsTags : undefined}
          hubNote={hubNote}
          stubs={stubs}
          stubLinks={links}
          stubNote={!stubNoteSeen}
          onDismissStubNote={dismissStubNote}
          stubColor={(module) => moduleColor(module, modules.findIndex((item) => item.name === module), groups)}
          onShowStub={locate}
          highlight={
            needle && highlightCount
              ? { query: explorerQuery.trim(), count: t('count.tables', { count: highlightCount }) }
              : null
          }
          hint={tables.length === 0 ? t('workspace.noTables') : undefined}
          actionsRef={canvas}
        />
        )}
        <PanelHandle panel="inspector" />
        {diagramView === 'modules' ? (
          <ModuleInspector
            tables={tables}
            modules={modules}
            groups={groups}
            selected={selectedModule}
            hideHubs={hideHubLines}
            inferredOnly={inferredOnly}
            onSelect={(moduleName) => setModuleSelection(moduleName, name)}
            onOpen={openModule}
            onFocus={(tableName) => {
              setDiagramView('focus', name);
              focusRelatedTables(tableName);
            }}
            onRename={renameModule}
            onSaveGroup={(members, title, color) => editGroups((list) => assignGroup(list, members, title, color))}
          />
        ) : diagramView === 'focus' && focusTable ? (
          <FocusInspector
            table={focusTable}
            tables={tables}
            modules={modules}
            groups={groups}
            drawn={focusDrawn}
            onShow={revealTable}
            onShowPath={showPath}
          />
        ) : (
        <Inspector
          table={table}
          tables={tables}
          schemaName={name}
          engine={engine}
          selectedColumn={selectedColumn}
          onSelectColumn={selectColumn}
          onChange={(t, field) => updateTable(t.name, t, field)}
          onRename={renameTable}
          onDuplicate={duplicateTable}
          onDelete={requestDeleteTable}
          onAddForeignKey={requestAddForeignKey}
          onNewTable={() => {
            const view = canvas.current?.view();
            if (view) newTable(newTablePosition(positions, view));
          }}
          onInferRelations={tables.length ? inferRelationships : undefined}
          onReviewInferred={inferred ? requestReviewInferred : undefined}
          onRemoveInferred={inferred ? removeInferredRelationships : undefined}
          selectedCount={selection.length}
          selection={selection}
          groups={groups}
          onGroup={groupTables}
          onNewGroup={groupTablesAsNew}
          onGroups={tables.length ? requestTableGroups : undefined}
          renameSignal={renameSignal}
          autoFocusDraft
          settingsCollapsed
        />
        )}
      </div>
      <StatusBar
        left={
          diagramView === 'modules'
            ? [t('modules.count', { count: moduleCount }), t('count.tables', { count: tables.length }), selectionText]
            : [
                t('status.inView', { shown: diagramView === 'focus' ? (focusModel?.nodes.length ?? 0) : visible.length, total: tables.length }),
                relationshipCount(relationships, inferred),
                selectionText,
              ]
        }
        right={[
          problems.length ? (
            <span style={{ color: 'var(--removed)' }}>{t('count.problems', { count: problems.length })}</span>
          ) : (
            t('count.problems', { count: 0 })
          ),
          engine,
          ...(diagramView === 'modules' || diagramView === 'focus' ? [] : [`${Math.round(zoom * 100)}%`]),
        ]}
      />
    </>
  );
}
