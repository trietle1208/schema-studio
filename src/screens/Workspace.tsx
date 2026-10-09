import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '../components/Button';
import { ERCanvas, type ERCanvasActions } from '../components/ERCanvas';
import { Inspector } from '../components/Inspector';
import { rich } from '../components/rich';
import { StatusBar } from '../components/StatusBar';
import { Toolbar } from '../components/Toolbar';
import { t } from '../core/i18n';
import { newTablePosition } from '../core/layout';
import { countInferred, countRelations, relatedTables } from '../core/relations';
import { SCHEMAS_ROUTE } from '../core/routes';
import { searchTables } from '../core/search';
import { relationshipCount } from '../core/summary';
import { findProblems } from '../core/validate';
import { versionLabel } from '../core/versions';
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
  drawForeignKey,
  focusRelatedTables,
  groupTables,
  groupTablesAsNew,
  inferRelationships,
  newTable,
  removeInferredRelationships,
  requestAddForeignKey,
  requestDeleteTable,
  requestReviewInferred,
  requestTableGroups,
  saveSchema,
  searchFor,
  showAllTables,
  showColumns,
} from './workspaceActions';

export function Workspace() {
  const name = useSchemaStore((s) => s.name);
  const engine = useSchemaStore((s) => s.engine);
  const version = useSchemaStore((s) => s.version);
  const stored = useSchemaStore((s) => s.id !== null);
  const saving = useSchemaStore((s) => s.saving);
  const tables = useSchemaStore((s) => s.tables);
  const positions = useSchemaStore((s) => s.positions);
  const groups = useSchemaStore((s) => s.groups);
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
  useWorkspaceShortcuts(searchRef);

  // A schema that was just imported is shown whole, wherever the canvas was panned to before.
  useEffect(() => {
    if (!fitPending) return;
    canvas.current?.fit();
    setFitPending(false);
  }, [fitPending, setFitPending]);

  // A focus leaves the table it is on and the tables related to it; the search then looks through what is left.
  const inFocus = useMemo(() => (focused === null ? tables : relatedTables(tables, focused)), [tables, focused]);
  const visible = useMemo(() => searchTables(inFocus, search), [inFocus, search]);
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
        saveState={saveState}
        onSave={saveSchema}
        zoom={zoom}
        onZoom={setZoom}
        onFit={() => canvas.current?.fit()}
        onArrange={tables.length ? arrangeTables : undefined}
        arrangeSelected={several}
        onShowColumns={tables.length ? (choice) => showColumns(choice, several ? selection : undefined) : undefined}
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
        onHistory={() => go({ screen: 'history', schema: name })}
        onExport={requestExport}
      />
      <div className="ss-work">
        <ERCanvas
          tables={visible}
          positions={positions}
          onMoveTables={moveTables}
          onResizeTables={resizeTables}
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
          onArrange={tables.length ? arrangeTables : undefined}
          onShowColumns={showColumns}
          notation={notation}
          groups={groups}
          onGroups={requestTableGroups}
          onInferRelations={inferRelationships}
          onReviewInferred={inferred ? requestReviewInferred : undefined}
          onRemoveInferred={inferred ? removeInferredRelationships : undefined}
          hint={
            tables.length === 0 ? (
              t('workspace.noTables')
            ) : focused !== null ? (
              // The canvas takes a press on it as the start of a pan, which would swallow the click on the button.
              <span className="ss-row" onPointerDown={(e) => e.stopPropagation()}>
                <span>
                  {rich('workspace.focus', {
                    count: inFocus.length - 1,
                    table: (
                      <span className="ss-mono" style={{ color: 'var(--ink-1)' }}>
                        {focused}
                      </span>
                    ),
                  })}
                </span>
                <Button variant="ghost" size="sm" kbd="Esc" onClick={showAllTables}>
                  {t('action.showAllTables')}
                </Button>
              </span>
            ) : undefined
          }
          actionsRef={canvas}
        />
        <PanelHandle panel="inspector" />
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
      </div>
      <StatusBar
        left={[t('status.inView', { shown: visible.length, total: tables.length }), relationshipCount(relationships, inferred), selectionText]}
        right={[
          problems.length ? (
            <span style={{ color: 'var(--removed)' }}>{t('count.problems', { count: problems.length })}</span>
          ) : (
            t('count.problems', { count: 0 })
          ),
          engine,
          `${Math.round(zoom * 100)}%`,
        ]}
      />
    </>
  );
}
