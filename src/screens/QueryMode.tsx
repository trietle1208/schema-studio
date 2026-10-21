import { useEffect, useRef, useState } from 'react';
import { readQuery } from '../bridge/client';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { QueryConsole, type QueryEntry, type QueryRunEntry } from '../components/QueryConsole';
import { StatusBar } from '../components/StatusBar';
import { t } from '../core/i18n';
import { connectionLabel } from '../core/introspect';
import type { Table } from '../core/model';
import type { Row } from '../core/records';
import type { RecordValues } from '../core/records/fields';
import { liveRun, parseQuery, queryFailure, type QueryResult, type QuerySpec } from '../core/records/query';
import { mergeRecord, recordLabel, rowKey } from '../core/records/record';
import { replaceRow } from '../core/records/rows';
import { connectionFromProfile, getConnection } from '../db/connections';
import type { ConnectionRecord } from '../db/db';
import { knownHostKey } from '../db/knownHosts';
import { deleteSavedQuery, listQueries, overwriteSavedQuery, recordRun, RECENT_QUERIES, renameSavedQuery, saveQuery } from '../db/queries';
import { useSchemaStore } from '../store/schema';
import { useSessionStore } from '../store/session';
import { useUiStore } from '../store/ui';
import { exportFile } from './exportActions';
import { LivePasswordForm } from './LivePasswordForm';
import { ModeToolbar } from './ModeToolbar';
import { go } from './navigation';
import { announceRecords, recordsFailed } from './recordActions';
import { useAllRecords } from './useAllRecords';
import { useWorkspaceShortcuts } from './useWorkspaceShortcuts';

interface Kept {
  saved: QueryEntry[];
  recent: QueryEntry[];
}

/** The Query mode: a console over the schema's rows, or over the live MySQL database when the schema was connected. */
export function QueryMode() {
  const schemaId = useSchemaStore((s) => s.id);
  const schemaName = useSchemaStore((s) => s.name);
  const engine = useSchemaStore((s) => s.engine);
  const tables = useSchemaStore((s) => s.tables);
  const selected = useSchemaStore((s) => s.selected);
  const searchRef = useRef<HTMLInputElement>(null);
  useWorkspaceShortcuts(searchRef, 'query');
  // Undefined while the profile is being read: a connected schema does not load every local table.
  const [profile, setProfile] = useState<ConnectionRecord | null | undefined>(undefined);
  useEffect(() => {
    if (schemaId === null) {
      setProfile(null);
      return;
    }
    let current = true;
    getConnection(schemaId).then(
      (found) => current && setProfile(found ?? null),
      (error) => {
        console.error(error);
        if (current) setProfile(null);
      },
    );
    return () => {
      current = false;
    };
  }, [schemaId]);
  const password = useSessionStore((s) => (schemaId === null ? undefined : s.secrets[schemaId]?.password));
  const live = profile != null;
  const records = useAllRecords(profile === null ? schemaId : null);
  const liveLabel = profile ? connectionLabel({ engine: profile.engine, host: profile.host, port: profile.port, database: profile.database, user: profile.user, password: '' }) : '';

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
  const onOverwriteQuery = async (entry: { name: string; sql: string; spec?: QuerySpec }, at = Date.now()) => {
    if (schemaId !== null) await overwriteSavedQuery(schemaId, entry, at);
    setQueries((cur) => ({
      ...cur,
      saved: cur.saved.map((item) => (item.name === entry.name ? { ...item, ...entry, at } : item)).sort((a, b) => (b.at ?? 0) - (a.at ?? 0)),
    }));
    useUiStore.getState().showToast({ tone: 'info', title: t('query.overwritten.title', { name: entry.name }), description: t('query.overwritten.description') });
  };
  const onRenameQuery = async (entry: QueryEntry, name: string): Promise<string | void> => {
    const next = name.trim();
    if (!next) return t('query.save.empty');
    if (queries.saved.some((item) => item.name === next && item !== entry && item.id !== entry.id)) return t('query.save.exists', { name: next });
    const at = Date.now();
    try {
      if (schemaId !== null && entry.id !== undefined) {
        const renamed = await renameSavedQuery(schemaId, entry.id, next, at);
        if (!renamed) return t('query.renameFailed.description');
      }
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : '';
      if (message.includes('already exists')) return t('query.save.exists', { name: next });
      return t('query.renameFailed.description');
    }
    setQueries((cur) => ({
      ...cur,
      saved: cur.saved.map((item) => (item === entry || (entry.id !== undefined && item.id === entry.id) ? { ...item, name: next, at } : item)).sort((a, b) => (b.at ?? 0) - (a.at ?? 0)),
    }));
    useUiStore.getState().showToast({
      tone: 'info',
      title: t('query.renamed.title', { from: entry.name ?? '', to: next }),
      description: t('query.renamed.description'),
    });
  };
  const execute = async (sql: string): Promise<QueryResult> => {
    const parsed = parseQuery(sql);
    if (!parsed.ok) return parsed;
    if (schemaId === null || !profile) return queryFailure(1, t('query.liveFailed'));
    const secrets = useSessionStore.getState().secrets[schemaId];
    if (!secrets) return queryFailure(1, t('data.passwordNeeded', { database: profile.database }));
    const hostKey = profile.ssh ? await knownHostKey(profile.ssh.host, profile.ssh.port) : undefined;
    const answer = await readQuery({
      connection: connectionFromProfile(profile, secrets, hostKey),
      select: parsed.query,
      tables: tables.map((item) => ({ name: item.name, columns: item.columns.map((column) => column.name) })),
    });
    if (!answer.ok) {
      const text = answer.error.detail ? `${answer.error.message} ${answer.error.detail}` : answer.error.message;
      return queryFailure(1, text);
    }
    return liveRun(parsed.query, answer, tables, sql);
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
  } else if (profile && !password) {
    body = (
      <LivePasswordForm
        database={liveLabel}
        onSubmit={(value) => {
          if (schemaId === null) return;
          const current = useSessionStore.getState().secrets[schemaId];
          useSessionStore.getState().setSecrets(schemaId, {
            password: value,
            ...(current?.sshPassword !== undefined ? { sshPassword: current.sshPassword } : {}),
            ...(current?.sshPassphrase ? { sshPassphrase: current.sshPassphrase } : {}),
          });
        }}
      />
    );
  } else if (profile === undefined || (!live && records.failed)) {
    body = records.failed ? (
      <EmptyState
        compact
        title={t('data.loadFailed.title')}
        description={t('data.loadFailed.description')}
        actions={<Button onClick={records.reload}>{t('tableHeader.refresh')}</Button>}
      />
    ) : (
      <EmptyState compact title={t('query.loading')} actions={null} />
    );
  } else if (!live && !records.data) {
    body = <EmptyState compact title={t('query.loading')} actions={null} />;
  } else {
    body = (
      <QueryConsole
        tables={tables}
        data={records.data ?? {}}
        saved={queries.saved}
        recent={queries.recent}
        table={selected ?? undefined}
        live={live}
        execute={live ? execute : undefined}
        onRun={onRun}
        onSaveQuery={(entry) => onSaveQuery(entry)}
        onOverwriteQuery={onOverwriteQuery}
        onRenameQuery={onRenameQuery}
        onDeleteQuery={onDeleteQuery}
        onExportFile={exportFile}
        onSaveRecord={live ? undefined : onSaveRecord}
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
            {live ? t('data.liveData') : t('data.localData')}
          </>,
          live ? liveLabel : `${schemaName}.${tables[0]?.schema || 'public'}`,
          live ? t('data.liveReadOnly') : t('query.readOnly'),
        ]}
        right={[engine]}
      />
    </>
  );
}
