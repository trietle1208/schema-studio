import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { DataGrid, type CellRef, type RowAction } from '../components/DataGrid';
import { DataToolbar } from '../components/DataToolbar';
import { DiscardRecordDialog } from '../components/DiscardRecordDialog';
import { EmptyState } from '../components/EmptyState';
import { FilterChips } from '../components/FilterChips';
import { ImportRecordsDialog, type ImportResult } from '../components/ImportRecordsDialog';
import { Pagination } from '../components/Pagination';
import { RecordEditor } from '../components/RecordEditor';
import { StatusBar } from '../components/StatusBar';
import { TableHeader, type TableTab } from '../components/TableHeader';
import { TableList } from '../components/TableList';
import { TableRelationships } from '../components/TableRelationships';
import { TableStructure } from '../components/TableStructure';
import { t } from '../core/i18n';
import { DEFAULT_PAGE_SIZE, pageOf, searchRows, sortRows, type Row } from '../core/records';
import { rowsText } from '../core/records/cells';
import { planDelete, type DeletePlan } from '../core/records/delete';
import type { RecordFilter } from '../core/records/filter';
import { filterRows } from '../core/records/filter';
import type { RecordData, RecordValues } from '../core/records/fields';
import { resultCsv } from '../core/records/query';
import { completeRecord, duplicateValues, mergeRecord, recordLabel, rowKey } from '../core/records/record';
import { insertRow, replaceRow } from '../core/records/rows';
import type { RecordSort } from '../core/records';
import { incomingRelations, outgoingRelations } from '../core/relations';
import { searchTableNames } from '../core/search';
import { useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';
import { DeleteRecordsDialog } from './DeleteRecordsDialog';
import { ModeToolbar } from './ModeToolbar';
import { go } from './navigation';
import { announceRecords, copyRowsAsJson, recordsFailed } from './recordActions';
import { useRecords } from './useRecords';
import { useWorkspaceShortcuts } from './useWorkspaceShortcuts';
import {
  copyColumnName,
  copyCreateTable,
  copyTableName,
  openColumnInDiagram,
  openInData,
  openInDiagram,
  searchFor,
} from './workspaceActions';

/** What the main area of one table remembers while it is on screen: another table starts over. */
interface TableView {
  table: string;
  tab: TableTab;
  /** Counts from 1. */
  page: number;
  pageSize: number;
  /** Row indexes of the page. */
  selected: number[];
  active: CellRef | null;
  search: string;
  filters: RecordFilter[];
  sort: RecordSort | null;
  hidden: string[];
}

const fresh = (table: string): TableView => ({
  table,
  tab: 'data',
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  selected: [],
  active: null,
  search: '',
  filters: [],
  sort: null,
  hidden: [],
});

/** The record that is open in the editor, with the rows it was opened over. */
interface Editing {
  /** Tells one opening from the next, so that the editor starts over for another record. */
  id: number;
  table: string;
  /** Where the row is among all the rows of the table; -1 for a new record. */
  index: number;
  row: Row | null;
  draft?: RecordValues;
  focus: boolean;
  /** The rows of every table as they were when it opened: what its foreign keys are chosen from and checked against. */
  data: RecordData;
}

/** A cell that was changed by saving a record, known by the key of its row. */
interface Changed {
  table: string;
  key: string;
  column: string;
}

const CLEAN = { dirty: false, changed: [] as string[] };
const NO_CHANGES: Changed[] = [];

/** The keys that type text: ⌘⏎ is theirs there, not the one that adds a record. */
const TYPING = 'input, textarea, select, [contenteditable]';

function downloadCsv(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
  const change = (patch: Partial<TableView>) => setKept((cur) => ({ ...(cur.table === name ? cur : fresh(name)), ...patch }));
  const resetPage = (patch: Partial<TableView> = {}) => change({ page: 1, selected: [], active: null, ...patch });

  // The record editor, whether it holds changes, how wide it is, and what waits for the changes to be given up.
  const [editing, setEditing] = useState<Editing | null>(null);
  const [draft, setDraft] = useState(CLEAN);
  const [width, setWidth] = useState<number | undefined>();
  const [pending, setPending] = useState<{ run: () => void } | null>(null);
  const [deleting, setDeleting] = useState<{ rows: Row[]; plan: DeletePlan } | null>(null);
  // Import Records, with the rows of every table it checks the file against.
  const [importing, setImporting] = useState<RecordData | null>(null);
  const [modifiedCells, setModifiedCells] = useState(NO_CHANGES);
  const opened = useRef(0);

  const listed = useMemo(() => searchTableNames(tables, search), [tables, search]);

  const rows = records.rows;
  const filtered = useMemo(() => {
    if (!table || !rows) return null;
    return sortRows(filterRows(searchRows(rows, view.search, table), view.filters), view.sort, table);
  }, [rows, table, view.search, view.filters, view.sort]);
  const page = useMemo(
    () => pageOf(filtered ?? [], { page: view.page, size: view.pageSize }),
    [filtered, view.page, view.pageSize],
  );
  const shownColumns = useMemo(
    () => (table ? table.columns.filter((c) => !view.hidden.includes(c.name)) : []),
    [table, view.hidden],
  );
  // The list shows the count of the table on screen as it is, ahead of the counts read with it.
  const counts = useMemo(() => (rows ? { ...records.counts, [name]: rows.length } : records.counts), [records.counts, rows, name]);
  const modified = useMemo(
    () =>
      table
        ? modifiedCells.flatMap((m) => {
            const row = m.table === name ? page.rows.findIndex((r) => rowKey(table, r) === m.key) : -1;
            return row >= 0 ? [{ row, column: m.column }] : [];
          })
        : [],
    [modifiedCells, page.rows, table, name],
  );
  const open = editing && editing.table === name && view.tab === 'data' && table ? editing : null;

  // ---- what stands in the way of leaving a record that holds changes
  const closeEditor = () => {
    setEditing(null);
    setDraft(CLEAN);
  };
  /** Goes on with `run` at once, or once the changes of the open record are given up. */
  const leave = (run: () => void) => {
    if (open && draft.dirty) setPending({ run });
    else run();
  };
  const pick = (to: string) =>
    leave(() => {
      closeEditor();
      go({ screen: 'data', schema: schemaName, table: to });
    });

  // ---- opening a record
  const begin = async (target: { index: number; row: Row | null; draft?: RecordValues; focus: boolean }) => {
    const id = ++opened.current;
    try {
      const data = await records.readData();
      // Another record was asked for while the rows were read.
      if (opened.current !== id) return;
      setDraft(CLEAN);
      setEditing({ id, table: name, data, ...target });
    } catch (error) {
      console.error(error);
      useUiStore.getState().showToast({ tone: 'error', title: t('data.loadFailed.title'), description: t('data.loadFailed.description') });
    }
  };
  const openRow = (row: Row, options: { focus?: boolean; duplicate?: boolean } = {}) => {
    if (!table || !rows) return;
    const index = rows.indexOf(row);
    if (index < 0) return;
    if (open?.row === row && !options.duplicate) return;
    leave(() => void begin(options.duplicate ? { index: -1, row: null, draft: duplicateValues(table, row), focus: true } : { index, row, focus: !!options.focus }));
  };
  const addRecord = () => {
    if (!table || !rows || view.tab !== 'data' || open?.row === null) return;
    leave(() => void begin({ index: -1, row: null, focus: true }));
  };

  // ---- saving it
  const save = async (values: RecordValues) => {
    if (!open || !table) return;
    const before = rows ?? [];
    const cellsBefore = modifiedCells;
    try {
      if (open.row) {
        const old = open.row;
        const key = rowKey(table, old);
        const saved = mergeRecord(old, values);
        await records.change((stored) => {
          // The row must still be where it was when the record was opened.
          if (!stored[open.index] || rowKey(table, stored[open.index]) !== key) throw new Error(`The row ${key} of ${name} is not at ${open.index}.`);
          return replaceRow(stored, open.index, saved);
        });
        setModifiedCells([...modifiedCells, ...table.columns.filter((c) => old[c.name] !== saved[c.name]).map((c) => ({ table: name, key, column: c.name }))]);
        announceRecords(t('records.updated.title', { record: recordLabel(table, saved) }), async () => {
          await records.change(() => before);
          setModifiedCells(cellsBefore);
        });
      } else {
        let saved: Row = {};
        const next = await records.change((stored) => {
          saved = completeRecord(table, stored, values);
          return insertRow(stored, saved);
        });
        // The new row is the last one: the page it is on opens with it chosen.
        change({
          page: pageOf(next, { page: Infinity, size: view.pageSize }).page,
          selected: [],
          active: { row: (next.length - 1) % view.pageSize, column: table.columns[0]?.name ?? '' },
          search: '',
          filters: [],
          sort: null,
        });
        announceRecords(t('records.added.title', { record: recordLabel(table, saved) }), async () => {
          await records.change(() => before);
          change({ selected: [], active: null });
        });
      }
    } catch (error) {
      // The editor stays open, with what was typed in it.
      recordsFailed(error);
      return;
    }
    closeEditor();
  };

  // ---- deleting rows
  const requestDelete = async (list: Row[]) => {
    if (!table || !list.length) return;
    try {
      const data = await records.readData();
      setDeleting({ rows: list, plan: planDelete(tables, data, name, list) });
    } catch (error) {
      console.error(error);
      useUiStore.getState().showToast({ tone: 'error', title: t('data.loadFailed.title'), description: t('data.loadFailed.description') });
    }
  };
  const confirmDelete = async () => {
    if (!deleting || deleting.plan.blocked) return;
    const { rows: gone, plan } = deleting;
    setDeleting(null);
    let before: Record<string, Row[]>;
    try {
      before = await records.write(plan.changes);
    } catch (error) {
      recordsFailed(error);
      return;
    }
    change({ selected: [], active: null });
    if (open?.row && gone.includes(open.row)) closeEditor();
    announceRecords(t('records.deleted.title', { count: gone.length, table: name }), async () => {
      await records.write(before);
      change({ selected: [], active: null });
    });
  };

  // ---- importing / exporting rows
  const requestImport = () =>
    leave(async () => {
      closeEditor();
      try {
        setImporting(await records.readData());
      } catch (error) {
        console.error(error);
        useUiStore.getState().showToast({ tone: 'error', title: t('data.loadFailed.title'), description: t('data.loadFailed.description') });
      }
    });
  const applyImport = async (result: ImportResult) => {
    if (!table) return;
    try {
      const before = await records.change((stored) => {
        let next = stored;
        for (const { match, values } of result.update) {
          const at = match ? next.findIndex((r) => r === match) : -1;
          if (at >= 0) next = replaceRow(next, at, mergeRecord(next[at], values));
        }
        for (const values of result.insert) {
          next = insertRow(next, completeRecord(table, next, values));
        }
        return next;
      });
      const written = result.counts.inserted + result.counts.updated;
      setImporting(await records.readData());
      announceRecords(t('records.imported.title', { count: written, table: name }), async () => {
        await records.change(() => before);
        setImporting(await records.readData());
      });
    } catch (error) {
      recordsFailed(error);
    }
  };
  const exportSelected = (list: Row[]) => {
    if (!table || !list.length) return;
    downloadCsv(`${name}.csv`, resultCsv(table.columns, list));
    useUiStore.getState().showToast({ tone: 'success', title: t('data.exportedCsv', { count: list.length }) });
  };
  const exportAll = () => {
    if (!table || !filtered) return;
    downloadCsv(`${name}.csv`, resultCsv(table.columns, filtered));
    useUiStore.getState().showToast({ tone: 'success', title: t('data.exportedCsv', { count: filtered.length }) });
  };

  // ---- the menu and the keys of a row
  const onRowAction = (action: RowAction, r: number) => {
    const row = page.rows[r];
    if (!table || !row) return;
    // A row that is one of several selected stands for all of them.
    const picked = view.selected.includes(r) ? view.selected.map((i) => page.rows[i]) : [row];
    if (action === 'view') openRow(row);
    else if (action === 'edit') openRow(row, { focus: true });
    else if (action === 'duplicate') openRow(row, { duplicate: true });
    else if (action === 'copy') void copyRowsAsJson(table, picked);
    else void requestDelete(picked);
  };

  const refresh = () => {
    setModifiedCells(NO_CHANGES);
    records.reload();
  };

  const selectedRows = () => view.selected.map((i) => page.rows[i]).filter(Boolean);

  // ⌘⏎ adds a record; ⌘R refreshes; Esc clears selection (or closes the editor); ⌫ deletes the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || deleting || pending || importing || useUiStore.getState().dialog) return;
      const target = e.target instanceof Element ? e.target : null;
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Enter' && mod && !e.shiftKey && !e.altKey) {
        if (target?.closest(TYPING)) return;
        e.preventDefault();
        addRecord();
      } else if (e.key.toLowerCase() === 'r' && mod && !e.shiftKey && !e.altKey) {
        if (target?.closest(TYPING)) return;
        e.preventDefault();
        refresh();
      } else if (e.key === 'Escape') {
        if (target?.closest(TYPING) || document.querySelector('[role="dialog"]')) return;
        if (view.selected.length) {
          e.preventDefault();
          change({ selected: [] });
        } else if (open) {
          e.preventDefault();
          leave(closeEditor);
        }
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && view.selected.length && view.tab === 'data') {
        if (target?.closest(TYPING) || document.querySelector('[role="dialog"]')) return;
        e.preventDefault();
        void requestDelete(selectedRows());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const menuItems = [
    {
      icon: 'layers' as const,
      label: t('action.openInDiagram'),
      onSelect: () =>
        leave(() => {
          closeEditor();
          openInDiagram(name);
        }),
    },
    { icon: 'copy' as const, label: t('action.copyTableName'), onSelect: () => void copyTableName(name) },
    { icon: 'code' as const, label: t('action.copyCreateTable'), onSelect: () => void copyCreateTable(name) },
  ];

  let body: ReactNode;
  if (!table) {
    body = (
      <EmptyState
        compact
        title={tables.length ? t('data.missingTable.title', { name }) : t('data.noTables.title')}
        description={tables.length ? t('data.missingTable.description') : t('data.noTables.description')}
        actions={<Button onClick={() => go({ screen: 'workspace', schema: schemaName })}>{t('data.backToDiagram')}</Button>}
      />
    );
  } else if (view.tab === 'structure') {
    body = (
      <TableStructure
        table={table}
        onOpenColumn={(column) =>
          leave(() => {
            closeEditor();
            openColumnInDiagram(name, column);
          })
        }
        onOpenRelationships={() => change({ tab: 'relationships' })}
        onCopyColumn={(column) => void copyColumnName(column)}
      />
    );
  } else if (view.tab === 'relationships') {
    body = (
      <TableRelationships
        table={table}
        tables={tables}
        onOpen={(to) =>
          leave(() => {
            closeEditor();
            openInData(to);
          })
        }
      />
    );
  } else if (records.failed) {
    body = (
      <EmptyState
        compact
        title={t('data.loadFailed.title')}
        description={t('data.loadFailed.description')}
        actions={<Button onClick={refresh}>{t('tableHeader.refresh')}</Button>}
      />
    );
  } else {
    const emptyNode =
      rows !== null && filtered !== null && filtered.length === 0 ? (
        rows.length === 0 ? (
          <EmptyState
            compact
            title={t('grid.emptyTitle')}
            actions={
              <>
                <Button variant="primary" icon="plus" kbd={['⌘', '⏎']} onClick={addRecord}>
                  {t('action.addRecord')}
                </Button>
                <Button icon="upload" onClick={requestImport}>
                  {t('action.importRecords')}
                </Button>
              </>
            }
          />
        ) : (
          <EmptyState
            compact
            title={
              view.filters.length
                ? t('grid.emptyFiltered', { count: view.filters.length })
                : t('grid.emptySearch', { query: view.search.trim() })
            }
            actions={
              <Button
                onClick={() =>
                  resetPage({
                    search: '',
                    filters: [],
                  })
                }
              >
                {view.filters.length ? t('dataToolbar.clearFilters') : t('dataToolbar.clearSearch')}
              </Button>
            }
          />
        )
      ) : (
        false
      );

    body = (
      <>
        <DataToolbar
          columns={table.columns}
          table={name}
          search={view.search}
          onSearch={(q) => resetPage({ search: q })}
          filters={view.filters}
          onAddFilter={(f) => resetPage({ filters: [...view.filters, f] })}
          sort={view.sort}
          onSort={(sort) => resetPage({ sort })}
          hidden={view.hidden}
          onHidden={(hidden) => change({ hidden })}
          onRefresh={refresh}
          loading={rows === null}
          onImport={requestImport}
          onExport={exportAll}
          onAdd={addRecord}
          menuItems={menuItems}
          selectedCount={view.selected.length}
          onEditSelected={() => {
            const row = selectedRows()[0];
            if (row) openRow(row, { focus: true });
          }}
          onDuplicateSelected={() => {
            const row = selectedRows()[0];
            if (row) openRow(row, { duplicate: true });
          }}
          onExportSelected={() => exportSelected(selectedRows())}
          onDeleteSelected={() => void requestDelete(selectedRows())}
          onClearSelection={() => change({ selected: [] })}
        />
        <FilterChips
          filters={view.filters}
          onRemove={(i) => resetPage({ filters: view.filters.filter((_, k) => k !== i) })}
          onClear={() => resetPage({ filters: [] })}
        />
        <DataGrid
          columns={shownColumns}
          rows={page.rows}
          selected={view.selected}
          onSelect={(selected) => change({ selected })}
          activeCell={view.active}
          onActiveCell={(active) => change({ active })}
          modified={modified}
          openOnClick
          onOpenRow={(r) => page.rows[r] && openRow(page.rows[r])}
          onRowAction={onRowAction}
          sort={view.sort}
          label={name}
          loading={rows === null}
          empty={emptyNode}
        />
        <Pagination
          page={page.page}
          pageSize={page.size}
          total={page.total}
          loading={rows === null}
          onPage={(next) => change({ page: next, selected: [], active: null })}
          onPageSize={(size) => resetPage({ pageSize: size })}
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
        <TableList
          tables={tables}
          counts={counts}
          selected={name}
          onSelect={pick}
          search={search}
          onSearch={searchFor}
          onAdd={() =>
            leave(() => {
              closeEditor();
              openInDiagram(name);
            })
          }
        />
        <div className="ss-data">
          {table && (
            <TableHeader
              schema={schemaName}
              table={table}
              engine={engine}
              rows={total}
              relationships={relationships}
              tab={view.tab}
              onTab={(tab) =>
                leave(() => {
                  closeEditor();
                  change({ tab });
                })
              }
            />
          )}
          {body}
        </div>
        {open && table && (
          <RecordEditor
            key={open.id}
            table={table}
            tables={tables}
            data={open.data}
            record={open.row}
            draft={open.draft}
            autoFocus={open.focus}
            width={width}
            onWidth={setWidth}
            onSave={(values) => void save(values)}
            onDirty={(dirty, changed) => setDraft({ dirty, changed })}
            onClose={closeEditor}
          />
        )}
      </div>
      <StatusBar
        left={[
          <>
            <span className="ss-status-ok" />
            {t('data.localData')}
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
      {pending && open && table && (
        <DiscardRecordDialog
          table={name}
          record={open.row ? recordLabel(table, open.row) : null}
          changed={draft.changed}
          onKeep={() => setPending(null)}
          onDiscard={() => {
            const { run } = pending;
            setPending(null);
            run();
          }}
        />
      )}
      {importing && table && (
        <ImportRecordsDialog
          table={table}
          data={importing}
          schema={schemaName}
          onImport={(result) => void applyImport(result)}
          onViewRows={() => {
            setImporting(null);
            records.reload();
          }}
          onClose={() => {
            setImporting(null);
            records.reload();
          }}
        />
      )}
      {deleting && table && (
        <DeleteRecordsDialog table={name} count={deleting.rows.length} plan={deleting.plan} onConfirm={() => void confirmDelete()} onCancel={() => setDeleting(null)} />
      )}
    </>
  );
}
