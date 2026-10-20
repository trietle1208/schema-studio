import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { QueryConsole, type QueryEntry, type QueryRunEntry } from '../components/QueryConsole';
import { StatusBar } from '../components/StatusBar';
import { t } from '../core/i18n';
import type { Table } from '../core/model';
import type { Row } from '../core/records';
import type { RecordValues } from '../core/records/fields';
import type { QuerySpec } from '../core/records/query';
import { mergeRecord, recordLabel, rowKey } from '../core/records/record';
import { replaceRow } from '../core/records/rows';
import { deleteSavedQuery, listQueries, recordRun, RECENT_QUERIES, saveQuery } from '../db/queries';
import { useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';
import { exportFile } from './exportActions';
import { ModeToolbar } from './ModeToolbar';
import { go } from './navigation';
import { announceRecords, recordsFailed } from './recordActions';
import { useAllRecords } from './useAllRecords';
import { useWorkspaceShortcuts } from './useWorkspaceShortcuts';

interface Kept {
  saved: QueryEntry[];
  recent: QueryEntry[];
}

/** The Query mode: a console that runs queries over the sample records of the schema. */
export function QueryMode() {
  const schemaId = useSchemaStore((s) => s.id);
  const schemaName = useSchemaStore((s) => s.name);
  const engine = useSchemaStore((s) => s.engine);
  const tables = useSchemaStore((s) => s.tables);
  const selected = useSchemaStore((s) => s.selected);
  const searchRef = useRef<HTMLInputElement>(null);
  useWorkspaceShortcuts(searchRef, 'query');
  const records = useAllRecords(schemaId);

  // What the schema has saved and run. A change shows at once and is written behind it; a schema
  // that is not stored keeps them only while the mode is open.
  const [queries, setQueries] = useState<Kept>({ saved: [], recent: [] });
  useEffect(() => {
    if (schemaId === null) return;
    let live = true;
    listQueries(schemaId).then(
      (read) => live && setQueries(read),
      (error) => console.error(error),
    );
    return () => {
      live = false;
    };
  }, [schemaId]);

  const onRun = (entry: QueryRunEntry) => {
    const run: QueryEntry = { sql: entry.sql, spec: entry.spec, ok: entry.ok, ms: entry.ms, at: Date.now() };
    setQueries((cur) => ({ ...cur, recent: [run, ...cur.recent.filter((x) => x.sql !== run.sql)].slice(0, RECENT_QUERIES) }));
    if (schemaId !== null) recordRun(schemaId, entry, run.at).catch((error) => console.error(error));
  };
  const onSaveQuery = async (entry: { name: string; sql: string; spec?: QuerySpec }, at = Date.now()) => {
    const id = schemaId !== null ? (await saveQuery(schemaId, entry, at)).id : undefined;
    setQueries((cur) => ({ ...cur, saved: [{ ...entry, id, at }, ...cur.saved].sort((a, b) => (b.at ?? 0) - (a.at ?? 0)) }));
  };
  const onDeleteQuery = (entry: QueryEntry) => {
    const ui = useUiStore.getState();
    const gone = () => setQueries((cur) => ({ ...cur, saved: cur.saved.filter((x) => x !== entry) }));
    const failed = (error: unknown, key: 'deleteFailed' | 'restoreFailed') => {
      console.error(error);
      ui.showToast({ tone: 'error', title: t(`query.${key}.title`), description: t(`query.${key}.description`) });
    };
    const announce = () => {
      const id = ui.showToast({
        tone: 'info',
        title: t('query.deleted.title', { name: entry.name ?? '' }),
        description: t('query.deleted.description'),
        actions: [
          {
            label: t('common.undo'),
            onClick: () => {
              ui.dismissToast(id);
              const { sql, spec, name = '', at = Date.now() } = entry;
              onSaveQuery({ name, sql, spec }, at).catch((error) => failed(error, 'restoreFailed'));
            },
          },
        ],
      });
    };
    if (schemaId === null || entry.id === undefined) {
      gone();
      announce();
      return;
    }
    deleteSavedQuery(schemaId, entry.id).then((removed) => {
      gone();
      if (removed) announce();
    }, (error) => failed(error, 'deleteFailed'));
  };

  // A row opened from a result is saved back to its table, as in the Data mode, and can be taken back.
  const onSaveRecord = async (table: Table, source: Row, values: RecordValues) => {
    const before = records.data?.[table.name];
    const index = before ? before.indexOf(source) : -1;
    if (!before || index < 0) throw new Error(`The row is not in ${table.name} any more.`);
    const key = rowKey(table, source);
    const saved = mergeRecord(source, values);
    try {
      await records.change(table.name, (stored) => {
        // The row must still be where it was when the record was opened.
        if (!stored[index] || rowKey(table, stored[index]) !== key) throw new Error(`The row ${key} of ${table.name} is not at ${index}.`);
        return replaceRow(stored, index, saved);
      });
    } catch (error) {
      recordsFailed(error);
      throw error;
    }
    announceRecords(t('records.updated.title', { record: recordLabel(table, saved) }), async () => {
      await records.change(table.name, () => [...before]);
    });
  };

  let body;
  if (!tables.length) {
    body = (
      <EmptyState
        compact
        title={t('data.noTables.title')}
        description={t('data.noTables.description')}
        actions={<Button onClick={() => go({ screen: 'workspace', schema: schemaName })}>{t('data.backToDiagram')}</Button>}
      />
    );
  } else if (records.failed) {
    body = (
      <EmptyState
        compact
        title={t('data.loadFailed.title')}
        description={t('data.loadFailed.description')}
        actions={<Button onClick={records.reload}>{t('tableHeader.refresh')}</Button>}
      />
    );
  } else if (!records.data) {
    body = <EmptyState compact title={t('query.loading')} actions={null} />;
  } else {
    body = (
      <QueryConsole
        tables={tables}
        data={records.data}
        saved={queries.saved}
        recent={queries.recent}
        table={selected ?? undefined}
        onRun={onRun}
        onSaveQuery={(entry) => onSaveQuery(entry)}
        onDeleteQuery={onDeleteQuery}
        onExportFile={exportFile}
        onSaveRecord={onSaveRecord}
      />
    );
  }

  return (
    <>
      <ModeToolbar mode="query" searchRef={searchRef} />
      <div className="ss-work">{body}</div>
      <StatusBar
        left={[
          <>
            <span className="ss-status-ok" />
            {t('data.localData')}
          </>,
          `${schemaName}.${tables[0]?.schema || 'public'}`,
          t('query.readOnly'),
        ]}
        right={[engine]}
      />
    </>
  );
}
