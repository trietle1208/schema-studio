import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ERCanvas } from '../components/ERCanvas';
import { validateColumns } from '../core/validate';
import { selectDirtyTables, selectTable, useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';

export function Workspace() {
  const tables = useSchemaStore((s) => s.tables);
  const positions = useSchemaStore((s) => s.positions);
  const selected = useSchemaStore((s) => s.selected);
  const selectedColumn = useSchemaStore((s) => s.selectedColumn);
  const table = useSchemaStore(selectTable);
  const dirtyTables = useSchemaStore(useShallow(selectDirtyTables));
  const select = useSchemaStore((s) => s.select);
  const selectColumn = useSchemaStore((s) => s.selectColumn);
  const moveTable = useSchemaStore((s) => s.moveTable);
  const endMove = useSchemaStore((s) => s.endMove);
  const duplicateTable = useSchemaStore((s) => s.duplicateTable);
  const zoom = useUiStore((s) => s.zoom);
  const setZoom = useUiStore((s) => s.setZoom);

  const invalidColumns = useMemo(() => (table ? Object.keys(validateColumns(table)).map(Number) : []), [table]);

  return (
    <div className="ss-work">
      <ERCanvas
        tables={tables}
        positions={positions}
        onMove={moveTable}
        onMoveEnd={endMove}
        selected={selected}
        onSelect={select}
        selectedColumn={selectedColumn}
        onSelectColumn={selectColumn}
        zoom={zoom}
        onZoom={setZoom}
        dimUnrelated
        dirtyTables={dirtyTables}
        invalidColumns={invalidColumns}
        onDuplicateTable={duplicateTable}
      />
    </div>
  );
}
