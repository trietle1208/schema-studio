import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ERCanvas, type ERCanvasActions } from '../components/ERCanvas';
import { Inspector } from '../components/Inspector';
import { StatusBar } from '../components/StatusBar';
import { Toast } from '../components/Toast';
import { Toolbar } from '../components/Toolbar';
import { outgoingRelations } from '../core/relations';
import { searchTables } from '../core/search';
import { findProblems } from '../core/validate';
import {
  redo,
  selectDirty,
  selectDirtyTables,
  selectTable,
  undo,
  useCanRedo,
  useCanUndo,
  useSchemaStore,
} from '../store/schema';
import { useUiStore } from '../store/ui';
import { DeleteTableDialog } from './DeleteTableDialog';
import { useWorkspaceShortcuts } from './useWorkspaceShortcuts';
import { requestDeleteTable, saveSchema } from './workspaceActions';

const TOAST_MS = 5000;

export function Workspace() {
  const name = useSchemaStore((s) => s.name);
  const engine = useSchemaStore((s) => s.engine);
  const tables = useSchemaStore((s) => s.tables);
  const positions = useSchemaStore((s) => s.positions);
  const selected = useSchemaStore((s) => s.selected);
  const selectedColumn = useSchemaStore((s) => s.selectedColumn);
  const table = useSchemaStore(selectTable);
  const dirty = useSchemaStore(selectDirty);
  const dirtyTables = useSchemaStore(useShallow(selectDirtyTables));
  const select = useSchemaStore((s) => s.select);
  const selectColumn = useSchemaStore((s) => s.selectColumn);
  const moveTable = useSchemaStore((s) => s.moveTable);
  const endMove = useSchemaStore((s) => s.endMove);
  const updateTable = useSchemaStore((s) => s.updateTable);
  const renameTable = useSchemaStore((s) => s.renameTable);
  const duplicateTable = useSchemaStore((s) => s.duplicateTable);
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const zoom = useUiStore((s) => s.zoom);
  const setZoom = useUiStore((s) => s.setZoom);
  const search = useUiStore((s) => s.search);
  const setSearch = useUiStore((s) => s.setSearch);
  const renameSignal = useUiStore((s) => s.renameSignal);
  const requestRename = useUiStore((s) => s.requestRename);
  const dialog = useUiStore((s) => s.dialog);
  const toast = useUiStore((s) => s.toast);
  const dismissToast = useUiStore((s) => s.dismissToast);

  const searchRef = useRef<HTMLInputElement>(null);
  const canvas = useRef<ERCanvasActions>(null);
  useWorkspaceShortcuts(searchRef);

  const toastId = toast?.id;
  useEffect(() => {
    if (toastId === undefined) return;
    const timer = setTimeout(() => dismissToast(toastId), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toastId, dismissToast]);

  const visible = useMemo(() => searchTables(tables, search), [tables, search]);
  // A selected table that the search hides stays in the inspector, but the canvas has nothing to highlight.
  const selectedInView = selected !== null && visible.some((t) => t.name === selected) ? selected : null;
  const problems = useMemo(() => findProblems(tables), [tables]);
  const invalidColumns = useMemo(
    () => problems.filter((p) => p.table === selected).map((p) => p.column),
    [problems, selected],
  );
  const relationships = useMemo(() => tables.reduce((n, t) => n + outgoingRelations(t).length, 0), [tables]);

  const column = table && selectedColumn !== null ? table.columns[selectedColumn] : undefined;
  const selection = table
    ? `${table.schema || 'public'}.${table.name}${column ? `.${column.name || '?'}` : ''}`
    : 'Nothing selected';

  return (
    <>
      <Toolbar
        schema={name}
        engine={engine}
        saveState={dirty ? 'dirty' : 'saved'}
        onSave={saveSchema}
        zoom={zoom}
        onZoom={setZoom}
        onFit={() => canvas.current?.fit()}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        search={search}
        onSearch={setSearch}
        onSearchSubmit={() => {
          if (search.trim() && visible[0]) select(visible[0].name);
        }}
        searchRef={searchRef}
      />
      <div className="ss-work">
        <ERCanvas
          tables={visible}
          positions={positions}
          onMove={moveTable}
          onMoveEnd={endMove}
          selected={selectedInView}
          onSelect={select}
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
          actionsRef={canvas}
        />
        <Inspector
          table={table}
          tables={tables}
          schemaName={name}
          selectedColumn={selectedColumn}
          onSelectColumn={selectColumn}
          onChange={(t, field) => updateTable(t.name, t, field)}
          onRename={renameTable}
          onDuplicate={duplicateTable}
          onDelete={requestDeleteTable}
          renameSignal={renameSignal}
          autoFocusDraft
          settingsCollapsed
        />
      </div>
      <StatusBar
        left={[`${visible.length} of ${tables.length} tables in view`, `${relationships} relationships`, selection]}
        right={[
          problems.length ? (
            <span style={{ color: 'var(--removed)' }}>{`${problems.length} problem${problems.length > 1 ? 's' : ''}`}</span>
          ) : (
            '0 problems'
          ),
          engine,
          `${Math.round(zoom * 100)}%`,
        ]}
      />
      {toast && (
        <div className="ss-toasts">
          <Toast
            tone={toast.tone}
            title={toast.title}
            description={toast.description}
            actions={toast.actions}
            onClose={() => dismissToast(toast.id)}
          />
        </div>
      )}
      {dialog?.kind === 'delete-table' && <DeleteTableDialog table={dialog.table} />}
    </>
  );
}
