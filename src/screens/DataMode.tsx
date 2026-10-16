import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { DataGrid, type CellRef } from '../components/DataGrid';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import { StatusBar } from '../components/StatusBar';
import { TableHeader, type TableTab } from '../components/TableHeader';
import { TableList } from '../components/TableList';
import { TableRelationships } from '../components/TableRelationships';
import { TableStructure } from '../components/TableStructure';
import { t } from '../core/i18n';
import { DEFAULT_PAGE_SIZE, pageOf } from '../core/records';
import { rowsText } from '../core/records/cells';
import { incomingRelations, outgoingRelations } from '../core/relations';
import { searchTableNames } from '../core/search';
import { useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';
import { ModeToolbar } from './ModeToolbar';
import { go } from './navigation';
import { useRecords } from './useRecords';
import { useWorkspaceShortcuts } from './useWorkspaceShortcuts';
import { copyCreateTable, copyTableName, openInData, openInDiagram, searchFor } from './workspaceActions';

/** What the main area of one table remembers while it is on screen: another table starts over. */
interface TableView {
  table: string;
  tab: TableTab;
  /** Counts from 1. */
  page: number;
  /** Row indexes of the page. */
  selected: number[];
  active: CellRef | null;
}

const fresh = (table: string): TableView => ({ table, tab: 'data', page: 1, selected: [], active: null });

/** The Data mode: the tables of the schema at the left, and the records, structure and relationships of one of them. */
export function DataMode({ table: name }: { table: string }) {
  const schemaId = useSchemaStore((s) => s.id);
  const schemaName = useSchemaStore((s) => s.name);
  const engine = useSchemaStore((s) => s.engine);
  const tables = useSchemaStore((s) => s.tables);
  const search = useUiStore((s) => s.search);
  const table = tables.find((x) => x.name === name);
  const records = useRecords(schemaId, name);
  const searchRef = useRef<HTMLInputElement>(null);
  useWorkspaceShortcuts(searchRef, 'data');

  // The view is the table's own: when the route names another table it starts from nothing again.
  const [kept, setKept] = useState(fresh(name));
  const view = kept.table === name ? kept : fresh(name);
  const change = (patch: Partial<TableView>) => setKept({ ...view, ...patch });

  const listed = useMemo(() => searchTableNames(tables, search), [tables, search]);
  const pick = (to: string) => go({ screen: 'data', schema: schemaName, table: to });

  const rows = records.rows;
  const page = useMemo(() => pageOf(rows ?? [], { page: view.page, size: DEFAULT_PAGE_SIZE }), [rows, view.page]);
  // The list shows the count of the table on screen as it is, ahead of the counts read with it.
  const counts = useMemo(() => (rows ? { ...records.counts, [name]: rows.length } : records.counts), [records.counts, rows, name]);

  let body: ReactNode;
  if (!table) {
    body = (
      <EmptyState
        compact
        title={tables.length ? t('data.missingTable.title', { name }) : t('data.noTables.title')}
        description={tables.length ? t('data.missingTable.description') : t('data.noTables.description')}
        actions={
          <Button onClick={() => go({ screen: 'workspace', schema: schemaName })}>{t('data.backToDiagram')}</Button>
        }
      />
    );
  } else if (view.tab === 'structure') {
    body = <TableStructure table={table} />;
  } else if (view.tab === 'relationships') {
    body = <TableRelationships table={table} tables={tables} onOpen={openInData} />;
  } else if (records.failed) {
    body = (
      <EmptyState
        compact
        title={t('data.loadFailed.title')}
        description={t('data.loadFailed.description')}
        actions={<Button onClick={records.reload}>{t('tableHeader.refresh')}</Button>}
      />
    );
  } else {
    body = (
      <>
        <DataGrid
          columns={table.columns}
          rows={page.rows}
          selected={view.selected}
          onSelect={(selected) => change({ selected })}
          activeCell={view.active}
          onActiveCell={(active) => change({ active })}
          label={name}
          loading={rows === null}
          empty={rows !== null && rows.length === 0}
        />
        <Pagination
          page={page.page}
          pageSize={page.size}
          total={page.total}
          loading={rows === null}
          onPage={(next) => change({ page: next, selected: [], active: null })}
        />
      </>
    );
  }

  const total = rows?.length ?? counts[name];
  const relationships = table ? outgoingRelations(table).length + incomingRelations(table, tables).length : 0;
  const selected = view.selected.length ? t('data.selected', { count: view.selected.length }) : t('data.nothingSelected');

  return (
    <>
      <ModeToolbar
        mode="data"
        searchRef={searchRef}
        onSearchSubmit={() => {
          if (search.trim() && listed[0]) pick(listed[0].name);
        }}
      />
      <div className="ss-work">
        <TableList tables={tables} counts={counts} selected={name} onSelect={pick} search={search} onSearch={searchFor} />
        <div className="ss-data">
          {table && (
            <TableHeader
              schema={schemaName}
              table={table}
              engine={engine}
              rows={total}
              relationships={relationships}
              tab={view.tab}
              onTab={(tab) => change({ tab })}
              onRefresh={records.reload}
              loading={rows === null && !records.failed}
              menuItems={[
                { icon: 'layers', label: t('action.openInDiagram'), onSelect: () => openInDiagram(name) },
                { icon: 'copy', label: t('action.copyTableName'), onSelect: () => void copyTableName(name) },
                { icon: 'code', label: t('action.copyCreateTable'), onSelect: () => void copyCreateTable(name) },
              ]}
            />
          )}
          {body}
        </div>
      </div>
      <StatusBar
        left={[
          <>
            <span className="ss-status-ok" />
            {t('data.sampleData')}
          </>,
          ...(table
            ? [
                `${table.schema || 'public'}.${table.name}`,
                total === undefined
                  ? t('count.columns', { count: table.columns.length })
                  : t('data.rowsOfColumns', { rows: rowsText(total), columns: t('count.columns', { count: table.columns.length }) }),
                selected,
              ]
            : []),
        ]}
        right={[engine]}
      />
    </>
  );
}
