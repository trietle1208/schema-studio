import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { formatNumber, t } from '../core/i18n';
import type { Table } from '../core/model';
import type { Row } from '../core/records';
import { rowsText } from '../core/records/cells';
import type { RecordData, RecordValues } from '../core/records/fields';
import {
  buildQuery,
  defaultQuery,
  formatQuery,
  queryFailure,
  queryPlan,
  queryProblems,
  QUERY_MAX_ROWS,
  resultCsv,
  resultJson,
  runQuery,
  type QueryResult,
  type QuerySpec,
} from '../core/records/query';
import { mergeRecord, recordLabel } from '../core/records/record';
import { relativeTime } from '../core/time';
import { useUiStore } from '../store/ui';
import { Badge } from './Badge';
import { Button } from './Button';
import { ContextMenu } from './ContextMenu';
import { cx } from './cx';
import { DataGrid, type CellRef } from './DataGrid';
import { DiscardRecordDialog } from './DiscardRecordDialog';
import { EmptyState } from './EmptyState';
import { Field } from './Field';
import { FilterBuilder } from './FilterBuilder';
import { Icon } from './Icon';
import { Input } from './Input';
import { RecordEditor } from './RecordEditor';
import { ResizeHandle } from './ResizeHandle';
import { SegmentedControl } from './SegmentedControl';
import { SqlEditor, type SqlEditorActions } from './SqlEditor';
import { Alert } from './Toast';
import { usePopover } from './usePopover';

/** A query the console lists in its History: a saved one has a name, a recent one has how its run went. */
export interface QueryEntry {
  /** Tells a saved query apart when it is deleted. */
  id?: number;
  sql: string;
  /** The Builder it was written in; it opens in the Builder again. */
  spec?: QuerySpec;
  name?: string;
  ok?: boolean;
  /** How long it took, in milliseconds. */
  ms?: number;
  /** Milliseconds since the epoch. */
  at?: number;
}

/** What the console tells its host about a run. */
export interface QueryRunEntry {
  sql: string;
  spec?: QuerySpec;
  ok: boolean;
  ms?: number;
}

export interface QueryConsoleProps {
  tables: readonly Table[];
  /** The rows of every table, by name: what the queries run over and the record editor chooses from. */
  data: RecordData;
  saved: readonly QueryEntry[];
  recent: readonly QueryEntry[];
  /** The table the Builder starts on; the first one when left out. */
  table?: string;
  /** A query was run, with or without error. */
  onRun?: (entry: QueryRunEntry) => void;
  /** Keeps a query under a name. Rejects when it could not be kept: the form stays open. */
  onSaveQuery?: (entry: { name: string; sql: string; spec?: QuerySpec }) => Promise<void>;
  /** Replaces the saved query of this name. Rejects when it could not be written. */
  onOverwriteQuery?: (entry: { name: string; sql: string; spec?: QuerySpec }) => Promise<void>;
  /** Gives a saved query another name. Resolves with a message when the name cannot be used. */
  onRenameQuery?: (entry: QueryEntry, name: string) => Promise<string | void>;
  /** Removes a saved query. The host tells the person and offers Undo. */
  onDeleteQuery?: (entry: QueryEntry) => void;
  /** Runs the SQL on a live database. Left out, the query runs over `data`. */
  execute?: (sql: string) => Promise<QueryResult>;
  /** The schema's rows are read from MySQL. The badge says so, and a result row is not edited. */
  live?: boolean;
  /** Saves a file: the result as CSV or JSON. */
  onExportFile?: (fileName: string, text: string) => void;
  /** Writes the values of a row of a result back to its table. Rejects when it could not be written: the editor stays open. */
  onSaveRecord?: (table: Table, source: Row, values: RecordValues) => Promise<void>;
}

type Tab = 'results' | 'messages' | 'plan';
const TABS: Tab[] = ['results', 'messages', 'plan'];
const RESULTS_HEIGHT = 380;
const RESULTS_MIN = 120;
const RESULTS_MAX = 640;

const clamp = (n: number) => Math.round(Math.min(RESULTS_MAX, Math.max(RESULTS_MIN, n)));

function QuerySaveForm({
  names,
  onSave,
  onOverwrite,
}: {
  names: readonly string[];
  onSave: (name: string) => Promise<void>;
  onOverwrite?: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const taken = name.trim() !== '' && names.includes(name.trim());
  const submit = () => {
    const v = name.trim();
    if (!v) setError(t('query.save.empty'));
    else if (taken) overwrite();
    else onSave(v).catch(() => setError(t('query.save.failed.description')));
  };
  const overwrite = () => {
    onOverwrite?.(name.trim()).catch(() => setError(t('query.save.failed.description')));
  };
  return (
    <div
      className="ss-menu ss-dt-pop"
      role="dialog"
      aria-label={t('query.save')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
          e.preventDefault();
          submit();
        }
      }}
    >
      <div className="ss-menu-label">{t('query.save')}</div>
      <div className="ss-dt-form">
        <Field error={error} hint={taken ? t('query.save.exists', { name: name.trim() }) : t('query.save.hint')}>
          <Input
            placeholder={t('query.save.placeholder')}
            aria-label={t('query.save.nameLabel')}
            error={!!error}
            value={name}
            inputRef={input}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
        </Field>
        <div className="ss-dt-form-foot">
          {taken ? (
            <Button variant="primary" size="sm" onClick={overwrite}>
              {t('query.save.overwrite')}
            </Button>
          ) : (
            <Button variant="primary" size="sm" kbd="⏎" onClick={submit}>
              {t('query.save')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** One list of queries in a popup: the saved ones, which can be deleted, or the recent runs. */
function QueryList({
  kind,
  entries,
  onPick,
  onDelete,
  onRename,
}: {
  kind: 'saved' | 'recent';
  entries: readonly QueryEntry[];
  onPick: (entry: QueryEntry) => void;
  onDelete?: (entry: QueryEntry) => void;
  onRename?: (entry: QueryEntry, name: string) => Promise<string | void>;
}) {
  // When the list opened: the times beside the recent queries are told from it.
  const [now] = useState(() => Date.now());
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isSaved = kind === 'saved';
  const rename = async (entry: QueryEntry) => {
    const name = draft.trim();
    if (!name) {
      setError(t('query.save.empty'));
      return;
    }
    if (name === entry.name) {
      setEditing(null);
      return;
    }
    try {
      const message = await onRename?.(entry, name);
      if (message) setError(message);
      else setEditing(null);
    } catch {
      setError(t('query.renameFailed.description'));
    }
  };
  const item = (x: QueryEntry, i: number) => {
    const line = x.sql.replace(/\s+/g, ' ');
    const meta = [x.ok === false ? t('query.history.failed') : x.ms !== undefined ? t('query.history.ms', { ms: x.ms }) : null, x.at !== undefined ? relativeTime(x.at, now) : null]
      .filter(Boolean)
      .join(' · ');
    const pick = (
      <button type="button" className="ss-qh-item" title={x.sql} onClick={() => onPick(x)}>
        <span className="ss-qh-main">
          {isSaved && <span className="ss-qh-name">{x.name}</span>}
          <span className={cx('ss-qh-sql', isSaved && 'is-sub')}>{line}</span>
        </span>
        {!isSaved && (
          <span className={cx('ss-qh-meta', x.ok === false && 'is-error')}>
            {x.ok === false && <Icon name="alert" size={12} />}
            {meta}
          </span>
        )}
      </button>
    );
    if (!isSaved || (!onDelete && !onRename)) return <div key={`${kind}${i}`}>{pick}</div>;
    const renaming = editing === i;
    return (
      <div key={`s${x.id ?? i}`} className="ss-qh-row">
        {renaming ? (
          <form
            className="ss-qh-rename"
            onSubmit={(e) => {
              e.preventDefault();
              void rename(x);
            }}
          >
            <Input
              size="sm"
              value={draft}
              aria-label={t('query.save.nameLabel')}
              error={!!error}
              autoFocus
              onChange={(e) => {
                setDraft(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setEditing(null);
                }
              }}
            />
            <Button size="sm" variant="primary" type="submit">
              {t('query.rename.action')}
            </Button>
            {error && <span className="ss-field-error">{error}</span>}
          </form>
        ) : (
          pick
        )}
        {!renaming && onRename && (
          <Button
            variant="ghost"
            size="sm"
            icon="pencil"
            title={t('query.rename')}
            aria-label={t('query.rename')}
            onClick={() => {
              setDraft(x.name ?? '');
              setError(null);
              setEditing(i);
            }}
          />
        )}
        {!renaming && onDelete && (
          <Button variant="ghost" size="sm" icon="trash" title={t('query.history.delete')} aria-label={t('query.history.delete')} onClick={() => onDelete(x)} />
        )}
      </div>
    );
  };
  return (
    <div className="ss-menu ss-qh" role="dialog" aria-label={t(isSaved ? 'query.saved.label' : 'query.history.label')}>
      <div className="ss-qh-list">
        <div className="ss-menu-label ss-qh-head">
          <span>{t(isSaved ? 'query.history.saved' : 'query.history.recent')}</span>
          <span className="ss-tl-count">{entries.length}</span>
        </div>
        {entries.length ? entries.map(item) : <div className="ss-pane-none ss-qh-none">{t(isSaved ? 'query.history.noSaved' : 'query.history.noRecent')}</div>}
      </div>
    </div>
  );
}

/** The record that is open in the editor: a row of a result opens the row of the table it came from. */
interface Editing {
  /** Tells one opening from the next, so that the editor starts over for another row. */
  id: number;
  table: string;
  source: Row;
}

/** A link-like control: a press or Enter does `act`. */
const linkProps = (act: () => void) => ({
  role: 'button',
  tabIndex: 0,
  onClick: act,
  onKeyDown: (e: ReactKeyboardEvent) => {
    if (e.key === 'Enter') act();
  },
});

/** What happens to the keys that type text: ⌘⏎ runs the query from anywhere in Query mode but a form that has its own use for it. */
const OWN_KEYS = 'aside, [aria-modal="true"]';

/**
 * Query mode: a console over the sample rows of the schema. A Builder or an SQL editor on top,
 * Results / Messages / Plan below, divided by a line that is dragged. It keeps the query and its
 * results; the host keeps the rows, the saved and recent queries and hears what is run and saved.
 */
export function QueryConsole({
  tables,
  data,
  saved,
  recent,
  table: startTable,
  onRun,
  onSaveQuery,
  onOverwriteQuery,
  onRenameQuery,
  onDeleteQuery,
  onExportFile,
  onSaveRecord,
  execute,
  live,
}: QueryConsoleProps) {
  const [mode, setMode] = useState<'builder' | 'sql'>('builder');
  const [spec, setSpec] = useState<QuerySpec>(() => defaultQuery(tables.find((x) => x.name === startTable) ?? tables[0]));
  const [sql, setSql] = useState('');
  const [tried, setTried] = useState(false);
  const [ran, setRan] = useState<{ sql: string; ms: number } | null>(null);
  const [tab, setTab] = useState<Tab>('results');
  const [height, setHeight] = useState(RESULTS_HEIGHT);
  const [notes, setNotes] = useState<string[]>([]);
  const [cleared, setCleared] = useState<string | null>(null);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [active, setActive] = useState<CellRef | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [editDirty, setEditDirty] = useState(false);
  const [editChanged, setEditChanged] = useState<string[]>([]);
  const [editWidth, setEditWidth] = useState<number | undefined>();
  const [pending, setPending] = useState<{ run: () => void } | null>(null);
  const opened = useRef(0);
  // What the editor holds was typed (or came from the Builder): the Builder no longer writes over it.
  const sqlEdited = useRef(false);
  const editor = useRef<SqlEditorActions>(null);
  const [historyOpen, setHistoryOpen, historyRef] = usePopover();
  const [savedOpen, setSavedOpen, savedRef] = usePopover();
  const [saveOpen, setSaveOpen, saveRef] = usePopover();
  const [exportOpen, setExportOpen, exportRef] = usePopover();
  const [remote, setRemote] = useState<QueryResult | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const builderTable = tables.find((x) => x.name === spec.table) ?? tables[0];
  const currentSql = mode === 'builder' ? buildQuery(spec, builderTable, tables) : sql;
  // The results follow the rows: a row saved from the editor changes what the last query shows.
  // A live query keeps the rows the bridge returned until it is run again.
  const local = useMemo(() => (live || !ran ? null : runQuery(ran.sql, tables, data)), [live, ran, tables, data]);
  const result = live ? remote : local;
  const ok = result?.ok ? result : null;

  // ---- running
  const runSql = async (text: string, from?: QuerySpec) => {
    if (busyRef.current) return;
    const start = performance.now();
    setNotes([]);
    setActive(null);
    setCleared(null);
    setFormatError(null);
    let r: QueryResult;
    if (execute) {
      busyRef.current = true;
      setBusy(true);
      try {
        r = await execute(text);
      } catch (error) {
        console.error(error);
        r = queryFailure(1, t('query.liveFailed'));
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
      setRemote(r);
    } else {
      r = runQuery(text, tables, data);
    }
    const ms = Math.max(1, Math.round(performance.now() - start));
    setRan({ sql: text, ms });
    setTab(r.ok ? (tab === 'plan' ? 'plan' : 'results') : 'messages');
    onRun?.({ sql: text, spec: from, ok: r.ok, ms: r.ok ? ms : undefined });
  };
  const run = () => {
    if (mode === 'builder') {
      if (queryProblems(spec, builderTable, tables).length) {
        setTried(true);
        return;
      }
      setTried(false);
      void runSql(buildQuery(spec, builderTable, tables), spec);
    } else if (sql.trim()) {
      void runSql(sql);
    }
  };

  // ⌘⏎ runs the query wherever the focus is in Query mode, except in a form or a dialog that has its own use for it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.defaultPrevented) return;
      if (pending || useUiStore.getState().dialog) return;
      if (e.target instanceof Element && e.target.closest(OWN_KEYS)) return;
      e.preventDefault();
      run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const switchMode = (next: string) => {
    if (next === mode) return;
    // Going to SQL carries over what the Builder writes, unless the editor was already written in by hand.
    if (next === 'sql' && !sqlEdited.current) setSql(buildQuery(spec, builderTable, tables));
    setMode(next as 'builder' | 'sql');
  };
  const load = (entry: QueryEntry) => {
    setHistoryOpen(false);
    setSavedOpen(false);
    const from = entry.spec;
    if (from && tables.some((x) => x.name === from.table)) {
      setSpec(from);
      setMode('builder');
      setTried(false);
    } else {
      setSql(entry.sql);
      sqlEdited.current = true;
      setMode('sql');
      setCleared(null);
      setFormatError(null);
    }
  };
  const saveQuery = async (name: string) => {
    await onSaveQuery?.({ name, sql: currentSql, ...(mode === 'builder' ? { spec } : null) });
    setSaveOpen(false);
  };
  const overwriteQuery = async (name: string) => {
    await onOverwriteQuery?.({ name, sql: currentSql, ...(mode === 'builder' ? { spec } : null) });
    setSaveOpen(false);
  };
  const format = () => {
    const r = formatQuery(sql);
    if (!r.ok) {
      setFormatError(r.message);
      return;
    }
    setSql(r.sql);
    setFormatError(null);
    sqlEdited.current = true;
  };
  const exportAs = (kind: 'csv' | 'json' | 'copy') => {
    setExportOpen(false);
    if (!ok) return;
    const count = rowsText(ok.rows.length);
    if (kind === 'csv') onExportFile?.('query-results.csv', resultCsv(ok.columns, ok.rows));
    else if (kind === 'json') onExportFile?.('query-results.json', resultJson(ok.columns, ok.rows));
    else {
      try {
        void navigator.clipboard.writeText(resultJson(ok.columns, ok.rows));
      } catch (error) {
        console.error(error);
        useUiStore.getState().showToast({ tone: 'error', title: t('toast.copyFailed.title'), description: t('toast.copyFailed.description') });
        return;
      }
    }
    setNotes((cur) => [...cur, t(kind === 'copy' ? 'query.messages.copied' : kind === 'csv' ? 'query.messages.exportedCsv' : 'query.messages.exportedJson', { rows: count })]);
  };

  // ---- the record editor
  const leave = (next: () => void) => {
    if (editing && editDirty) setPending({ run: next });
    else next();
  };
  const openRow = (r: number) => {
    if (!ok) return;
    const source = ok.sources[r];
    if (!source || (editing && editing.source === source)) return;
    leave(() => {
      setEditing({ id: ++opened.current, table: ok.table.name, source });
      setEditDirty(false);
    });
  };
  const closeEditor = () => {
    setEditing(null);
    setEditDirty(false);
  };
  const saveRecord = async (values: RecordValues) => {
    if (!editing || !onSaveRecord) return;
    const target = tables.find((x) => x.name === editing.table);
    if (!target) return;
    try {
      await onSaveRecord(target, editing.source, values);
    } catch {
      // The host has said so; the editor stays open with what was typed.
      return;
    }
    setNotes((cur) => [...cur, t('query.messages.updated', { record: recordLabel(target, mergeRecord(editing.source, values)) })]);
    closeEditor();
  };

  // Esc closes the record when nothing else has used it: a field, the grid, a menu or a dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || !editing || pending || useUiStore.getState().dialog) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      leave(closeEditor);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---- the header
  const header = (
    <div className="ss-qc-head">
      <h2 className="ss-rec-title">{t('query.title')}</h2>
      <Badge dot title={live ? t('data.liveReadOnly') : t('query.sampleHint')}>
        {live ? t('data.liveData') : t('data.localData')}
      </Badge>
      <SegmentedControl
        options={[
          { value: 'builder', label: t('query.mode.builder'), icon: 'filter' },
          { value: 'sql', label: t('query.mode.sql'), icon: 'code' },
        ]}
        value={mode}
        onChange={switchMode}
      />
      <span className="ss-spacer" />
      <div className="ss-anchor" ref={saveRef}>
        <Button
          icon="bookmark"
          active={saveOpen}
          disabled={!currentSql.trim()}
          aria-haspopup="dialog"
          aria-expanded={saveOpen}
          title={t('query.save')}
          onClick={() => {
            setHistoryOpen(false);
            setSavedOpen(false);
            setSaveOpen(!saveOpen);
          }}
        >
          <span className="ss-qc-lbl">{t('query.save')}</span>
        </Button>
        {saveOpen && (
          <div className="ss-anchor-pop ss-anchor-pop--end">
            <QuerySaveForm names={saved.flatMap((x) => (x.name ? [x.name] : []))} onSave={saveQuery} onOverwrite={onOverwriteQuery ? overwriteQuery : undefined} />
          </div>
        )}
      </div>
      <div className="ss-anchor" ref={savedRef}>
        <Button
          icon="folder"
          active={savedOpen}
          aria-haspopup="dialog"
          aria-expanded={savedOpen}
          title={t('query.saved')}
          onClick={() => {
            setSaveOpen(false);
            setHistoryOpen(false);
            setSavedOpen(!savedOpen);
          }}
        >
          <span className="ss-qc-lbl">{t('query.saved')}</span>
          {saved.length > 0 && <span className="ss-tl-count">{saved.length}</span>}
        </Button>
        {savedOpen && (
          <div className="ss-anchor-pop ss-anchor-pop--end">
            <QueryList kind="saved" entries={saved} onPick={load} onDelete={onDeleteQuery} onRename={onRenameQuery} />
          </div>
        )}
      </div>
      <div className="ss-anchor" ref={historyRef}>
        <Button
          icon="history"
          active={historyOpen}
          aria-haspopup="dialog"
          aria-expanded={historyOpen}
          title={t('query.history')}
          onClick={() => {
            setSaveOpen(false);
            setSavedOpen(false);
            setHistoryOpen(!historyOpen);
          }}
        >
          <span className="ss-qc-lbl">{t('query.history')}</span>
        </Button>
        {historyOpen && (
          <div className="ss-anchor-pop ss-anchor-pop--end">
            <QueryList kind="recent" entries={recent} onPick={load} />
          </div>
        )}
      </div>
    </div>
  );

  // ---- the top: the Builder or the SQL
  const runButton = (
    <Button variant="primary" icon="play" disabled={busy || (mode === 'sql' && !sql.trim())} kbd={['⌘', '⏎']} onClick={run}>
      {busy ? t('query.running') : t('query.run')}
    </Button>
  );
  let status: ReactNode = null;
  if (formatError) {
    status = (
      <span className="ss-qc-status is-error">
        <Icon name="alert" size={13} />
        {formatError}
      </span>
    );
  } else if (cleared !== null) {
    status = (
      <span className="ss-qc-status">
        {t('query.status.cleared')}
        <a
          {...linkProps(() => {
            setSql(cleared);
            setCleared(null);
          })}
        >
          {t('common.undo')}
        </a>
      </span>
    );
  } else if (ran && ok) {
    status = <span className="ss-qc-status">{t('query.status.ran', { ms: ran.ms })}</span>;
  } else if (ran && result) {
    status = (
      <span className="ss-qc-status is-error">
        <Icon name="alert" size={13} />
        {t('query.status.failed')}
        <a {...linkProps(() => setTab('messages'))}>
          {t('query.status.showMessages')}
        </a>
      </span>
    );
  }
  const failedLine = result && !result.ok && ran && ran.sql === sql ? result.line : null;
  const top =
    mode === 'builder' ? (
      <FilterBuilder
        tables={tables}
        value={spec}
        showErrors={tried}
        rows={data[builderTable.name]?.length ?? 0}
        onChange={setSpec}
        onEditSql={(text) => {
          setSql(text);
          sqlEdited.current = true;
          setMode('sql');
        }}
        onApply={run}
      />
    ) : (
      <div className="ss-qc-sql">
        <div className="ss-qc-tools">
          {runButton}
          <Button icon="code" disabled={!sql.trim()} onClick={format}>
            {t('query.format')}
          </Button>
          <Button
            variant="ghost"
            icon="x"
            disabled={!sql.length}
            onClick={() => {
              setCleared(sql);
              setSql('');
              setFormatError(null);
              sqlEdited.current = true;
            }}
          >
            {t('query.clear')}
          </Button>
          <span className="ss-spacer" />
          {status}
        </div>
        <SqlEditor
          value={sql}
          onChange={(v) => {
            setSql(v);
            sqlEdited.current = true;
            setCleared(null);
            setFormatError(null);
          }}
          label={t('query.sqlLabel')}
          placeholder={t('query.sqlPlaceholder', { table: tables[0].name })}
          errorLine={failedLine}
          actionsRef={editor}
          style={{ height: 'auto', flex: '1 1 0', minHeight: 0 }}
        />
      </div>
    );

  // ---- the bottom
  const messages: ReactNode[] = [];
  if (result && !result.ok) {
    messages.push(
      <Alert
        key="error"
        tone="error"
        title={result.message}
        action={
          mode === 'sql' && ran && ran.sql === sql ? (
            <Button size="sm" variant="ghost" onClick={() => editor.current?.goToLine(result.line)}>
              {t('query.messages.goToLine')}
            </Button>
          ) : undefined
        }
      >
        <span className="ss-mono">{t('query.messages.line', { line: result.line })}</span>
      </Alert>,
    );
  } else if (ok && ran) {
    const info = (key: string, text: string) => (
      <div key={key} className="ss-qc-msg">
        <Icon name="info" size={14} />
        <span>{text}</span>
      </div>
    );
    messages.push(
      <div key="ok" className="ss-qc-msg is-ok">
        <Icon name="check-circle" size={14} />
        <span>{t('query.messages.returned', { rows: rowsText(ok.shown), ms: ran.ms })}</span>
      </div>,
    );
    if (ok.capped) messages.push(info('cap', t('query.messages.capped', { max: formatNumber(QUERY_MAX_ROWS), rows: rowsText(ok.total) })));
    else if (ok.query.limit !== null && ok.total > ok.shown) {
      messages.push(info('limit', t('query.messages.limited', { rows: rowsText(ok.total), shown: formatNumber(ok.shown), limit: ok.query.limit })));
    }
  }
  notes.forEach((text, i) =>
    messages.push(
      <div key={`n${i}`} className="ss-qc-msg">
        <Icon name="info" size={14} />
        <span>{text}</span>
      </div>,
    ),
  );

  const tabLabel = (value: Tab) => t(value === 'results' ? 'query.tab.results' : value === 'messages' ? 'query.tab.messages' : 'query.tab.plan');
  const onTabKey = (e: ReactKeyboardEvent<HTMLButtonElement>, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = TABS[(i + d + TABS.length) % TABS.length];
    setTab(next);
    e.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus();
  };
  const resultsHead = (
    <div className="ss-qc-rhead">
      <div className="ss-tabs" role="tablist" aria-label={t('query.views')}>
        {TABS.map((value, i) => {
          const on = tab === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              data-tab={value}
              className={cx('ss-tab', on && 'is-active')}
              onClick={() => setTab(value)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {tabLabel(value)}
              {value === 'results' && ok && <span className="ss-tab-count">{formatNumber(ok.shown)}</span>}
              {value === 'messages' && messages.length > 0 && <span className={cx('ss-tab-count', result && !result.ok && 'is-error')}>{messages.length}</span>}
            </button>
          );
        })}
      </div>
      <span className="ss-spacer" />
      {ok && ran && <span className="ss-qc-meta">{t('query.meta', { rows: rowsText(ok.shown), ms: ran.ms })}</span>}
      <div className="ss-anchor" ref={exportRef}>
        <Button size="sm" icon="download" active={exportOpen} disabled={!ok || !ok.shown} aria-haspopup="menu" aria-expanded={exportOpen} onClick={() => setExportOpen(!exportOpen)}>
          {t('common.export')}
        </Button>
        {exportOpen && (
          <div className="ss-anchor-pop ss-anchor-pop--end">
            <ContextMenu
              label={t('query.export.label', { rows: rowsText(ok ? ok.shown : 0) })}
              onClose={() => setExportOpen(false)}
              items={[
                { icon: 'download', label: 'CSV', shortcut: '.csv', onSelect: () => exportAs('csv') },
                { icon: 'download', label: 'JSON', shortcut: '.json', onSelect: () => exportAs('json') },
                '-',
                { icon: 'copy', label: t('query.export.copy'), onSelect: () => exportAs('copy') },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );

  let body: ReactNode;
  if (tab === 'messages') {
    body = <div className="ss-qc-pane">{result ? messages : <div className="ss-pane-none">{t('query.messages.none')}</div>}</div>;
  } else if (tab === 'plan') {
    body = (
      <div className="ss-qc-pane">
        {!result ? (
          <div className="ss-pane-none">{t('query.plan.empty')}</div>
        ) : ok && ran ? (
          <pre className="ss-qc-plan" aria-label={t('query.plan.label')}>
            {queryPlan(ok, ran.ms).join('\n')}
          </pre>
        ) : (
          <div className="ss-pane-none">{t('query.plan.failedNone')}</div>
        )}
      </div>
    );
  } else if (!result) {
    body = (
      <EmptyState
        compact
        title={t('query.results.none.title')}
        description={t('query.results.none.description')}
        actions={
          <Button variant="primary" icon="play" kbd={['⌘', '⏎']} onClick={run}>
            {t('query.run')}
          </Button>
        }
      />
    );
  } else if (!ok) {
    body = (
      <EmptyState
        compact
        title={t('query.results.failed.title')}
        description={t('query.results.failed.description')}
        actions={<Button onClick={() => setTab('messages')}>{t('query.status.showMessages')}</Button>}
      />
    );
  } else {
    body = (
      <DataGrid
        columns={ok.columns}
        rows={ok.rows}
        selectable={false}
        label={t('query.tab.results')}
        activeCell={active}
        onActiveCell={setActive}
        onOpenRow={ok.sources.length ? openRow : undefined}
        empty={
          ok.rows.length ? (
            false
          ) : (
            <EmptyState
              compact
              title={t('query.results.empty.title')}
              description={t('query.results.empty.description', { count: ok.all, rows: rowsText(ok.all), table: ok.table.name })}
              actions={null}
            />
          )
        }
      />
    );
  }

  const editTable = ok ? ok.table : null;
  const open = editing && editTable && editing.table === editTable.name ? editing : null;

  return (
    <div className="ss-qc">
      <div className="ss-qc-col">
        {header}
        <div className="ss-qc-top">{top}</div>
        <section className="ss-qc-res" style={{ height }} aria-label={t('query.views')}>
          <ResizeHandle label={t('query.resize')} edge="top" width={height} min={RESULTS_MIN} max={RESULTS_MAX} onResize={(h) => setHeight(clamp(h))} onReset={() => setHeight(RESULTS_HEIGHT)} />
          {resultsHead}
          <div className="ss-qc-body" role="tabpanel" aria-label={tabLabel(tab)}>
            {body}
          </div>
        </section>
      </div>
      {open && editTable && (
        <RecordEditor
          key={open.id}
          table={editTable}
          tables={tables}
          data={data}
          record={open.source}
          width={editWidth}
          onWidth={setEditWidth}
          onSave={(values) => void saveRecord(values)}
          onDirty={(dirty, changed) => {
            setEditDirty(dirty);
            setEditChanged(changed);
          }}
          onClose={closeEditor}
        />
      )}
      {pending && open && editTable && (
        <DiscardRecordDialog
          table={editTable.name}
          record={recordLabel(editTable, open.source)}
          changed={editChanged}
          onKeep={() => setPending(null)}
          onDiscard={() => {
            const { run: next } = pending;
            setPending(null);
            next();
          }}
        />
      )}
    </div>
  );
}
