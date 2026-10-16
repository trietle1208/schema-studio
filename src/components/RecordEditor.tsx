import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { formatNumber, t } from '../core/i18n';
import type { Column, Table } from '../core/model';
import type { RecordValue, Row } from '../core/records';
import { rowsText } from '../core/records/cells';
import { canon, fieldMeta, isIntegerType, isTextField, typeScale, type FieldMeta, type RecordData, type RecordValues } from '../core/records/fields';
import { isJsonObject, parseJson } from '../core/records/json';
import { fromJson, initialValues, jsonNotes, recordJson, recordLabel, relatedOf, toRecord, typeLine, type RelatedRows } from '../core/records/record';
import { validateRecord } from '../core/records/validate';
import { qualifiedName } from '../core/relations';
import { Button } from './Button';
import { cx } from './cx';
import { DataGrid } from './DataGrid';
import { DiscardRecordDialog } from './DiscardRecordDialog';
import { Field } from './Field';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { FkPicker, MomentInput } from './RecordFields';
import { ResizeHandle } from './ResizeHandle';
import { Select, type SelectOption } from './Select';
import { SqlEditor, type SqlEditorActions } from './SqlEditor';
import { Switch } from './Switch';
import { Alert } from './Toast';
import { SaveStatus } from './Toolbar';

export type RecordTab = 'form' | 'json' | 'related';

const RECORD_WIDTH = 520;
const RECORD_MIN_WIDTH = 480;
const RECORD_MAX_WIDTH = 720;
/** The most rows of one foreign key the Related records tab shows. */
const RELATED_ROWS = 50;

const TABS: RecordTab[] = ['form', 'json', 'related'];
const NO_TABLES: readonly Table[] = [];
const NO_DATA: RecordData = {};
const NO_ROWS: readonly Row[] = [];

export interface RecordEditorProps {
  table: Table;
  /** Every table, for foreign keys and related records. */
  tables?: readonly Table[];
  /** The rows of every table, by name: what foreign keys are chosen from and checked against. */
  data?: RecordData;
  /** The record to edit; leave it out (or `null`) for a new record. It must be one of the rows of `data[table.name]`. */
  record?: Row | null;
  /** Values the form opens with over the record's own (it opens with unsaved changes); for a new record, the values of a duplicate. */
  draft?: RecordValues;
  tab?: RecordTab;
  /** Starts at 520. */
  width?: number;
  onWidth?: (width: number) => void;
  /** Focus the first column that can be edited when it opens (opened by F2 or Add record, not by a click). */
  autoFocus?: boolean;
  /** Gets the values that were set, converted to what each column holds; a new record leaves out what the database fills in. */
  onSave?: (values: RecordValues) => void;
  onClose?: () => void;
  /** Whether the draft holds changes, and the names of the columns that differ from the record. */
  onDirty?: (dirty: boolean, changed: string[]) => void;
  // Initial state, for previews of a state that otherwise needs a click.
  /** The text of the JSON tab, if it is not the record's. */
  jsonText?: string;
  /** The Validate report of the JSON tab is open. */
  validated?: boolean;
  /** Problems show for every column, as after a click on Create record. */
  attempted?: boolean;
  /** The Discard changes dialog is open. */
  confirmDiscard?: boolean;
  /** The key of the open relation of the Related records tab (`in:orders.user_id`, `out:user_id`). */
  related?: string;
  /** The column whose foreign key picker is open, and what is typed in its search. */
  picking?: string;
  pickQuery?: string;
}

/** Puts the focus in the control of a column of the form, or of the first one that can be edited. */
function focusIn(root: HTMLElement | null, name: string | null) {
  const scope = name ? root?.querySelector(`[data-field="${CSS.escape(name)}"]`) : root?.querySelector('.ss-rf:not(.is-generated)');
  const el = scope?.querySelector<HTMLElement>('.ss-input:not([readonly]), textarea, .ss-fkpick-btn, select, .ss-switch input');
  if (el) {
    el.focus();
    el.scrollIntoView({ block: 'nearest' });
  }
}

function copyText(text: string) {
  try {
    void navigator.clipboard?.writeText(text).catch(() => undefined);
  } catch {
    // There is no clipboard here.
  }
}

/**
 * The panel at the right of the grid that edits one record, or makes a new one. It keeps its own
 * draft: mount it with a `key` for the record, so that another record starts from its own values.
 */
export function RecordEditor({
  table,
  tables = NO_TABLES,
  data = NO_DATA,
  record,
  draft: given,
  tab: initialTab,
  width: initialWidth,
  onWidth,
  autoFocus,
  onSave,
  onClose,
  onDirty,
  jsonText: initialJson,
  validated,
  attempted,
  confirmDiscard,
  related: initialRelated,
  picking,
  pickQuery,
}: RecordEditorProps) {
  const rows = data[table.name] ?? NO_ROWS;
  const mode = record ? 'edit' : 'new';
  const metas = useMemo(() => table.columns.map((c) => fieldMeta(c, rows, data)), [table, rows, data]);
  const base = useMemo<RecordValues>(() => record ?? initialValues(table, metas), [record, table, metas]);
  const [draft, setDraft] = useState<RecordValues>(() => ({ ...base, ...given }));
  const [tab, setTab] = useState<RecordTab>(initialTab === 'related' && mode === 'new' ? 'form' : (initialTab ?? 'form'));
  const [jsonText, setJsonText] = useState(() => initialJson ?? recordJson(table, metas, { ...base, ...given }));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [tried, setTried] = useState(!!attempted);
  const [report, setReport] = useState(!!validated);
  const [confirm, setConfirm] = useState(!!confirmDiscard);
  const [width, setWidth] = useState(initialWidth ?? RECORD_WIDTH);
  const [open, setOpen] = useState<string | null>(initialRelated ?? null);
  const [copied, setCopied] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);
  const editor = useRef<SqlEditorActions>(null);

  const changed = useMemo(
    () =>
      table.columns
        .filter((c, i) => JSON.stringify(canon(c, metas[i], draft[c.name])) !== JSON.stringify(canon(c, metas[i], base[c.name])))
        .map((c) => c.name),
    [table, metas, draft, base],
  );
  const parsed = tab === 'json' ? parseJson(jsonText) : null;
  const object = parsed?.ok && isJsonObject(parsed.value) ? parsed.value : null;
  const jsonOk = !parsed || !!object;
  const dirty = changed.length > 0 || !jsonOk;
  const errors = useMemo(() => validateRecord(table, draft, { rows, record, data, mode, metas }), [table, draft, rows, record, data, mode, metas]);
  const visible = (name: string) => !!errors[name] && (mode === 'edit' || tried || touched[name] || changed.includes(name));
  const problems = table.columns.filter((c) => visible(c.name)).length;
  const rels = useMemo(() => (record ? relatedOf(table, record, tables, data) : { out: [], inn: [] }), [record, table, tables, data]);
  const relTotal = [...rels.out, ...rels.inn].reduce((n, r) => n + r.rows.length, 0);
  const label = record ? recordLabel(table, record) : t('record.newLabel', { table: table.name });

  // The host hears about the draft by what it holds, not by every render.
  const heard = useRef(onDirty);
  useEffect(() => {
    heard.current = onDirty;
  });
  useEffect(() => {
    heard.current?.(dirty, changed);
  }, [dirty, changed]);
  useEffect(() => () => heard.current?.(false, []), []);
  useEffect(() => {
    if (autoFocus) focusIn(root.current, null);
  }, [autoFocus]);

  const change = (name: string, v: RecordValue) => {
    setDraft({ ...draft, [name]: v });
    setTouched({ ...touched, [name]: true });
    setReport(false);
  };
  const editJson = (text: string) => {
    setJsonText(text);
    setReport(false);
    const r = parseJson(text);
    if (r.ok && isJsonObject(r.value)) setDraft(fromJson(table, metas, draft, r.value));
  };
  const gotoLine = (n: number) => editor.current?.goToLine(n);
  const goTab = (next: RecordTab) => {
    if (next === tab) return;
    // Another tab only opens once the text of the JSON tab is a record again.
    if (tab === 'json' && !jsonOk) {
      gotoLine(parsed?.ok === false ? parsed.line : 1);
      return;
    }
    if (next === 'json') setJsonText(recordJson(table, metas, draft));
    setTab(next);
  };
  const onTabKey = (e: ReactKeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    (e.currentTarget.parentElement?.children[(i + step + TABS.length) % TABS.length] as HTMLElement | undefined)?.focus();
  };
  const requestClose = () => (dirty ? setConfirm(true) : onClose?.());
  const discard = () => {
    setConfirm(false);
    onClose?.();
  };
  const save = () => {
    if (confirm) return;
    if (tab === 'json' && !jsonOk) {
      gotoLine(parsed?.ok === false ? parsed.line : 1);
      return;
    }
    const bad = table.columns.filter((c) => errors[c.name]);
    if (bad.length) {
      setTried(true);
      if (tab === 'json') setReport(true);
      else if (tab === 'form') focusIn(root.current, bad[0].name);
      else setTab('form');
      return;
    }
    if (mode === 'edit' && !dirty) return;
    onSave?.(toRecord(table, metas, draft));
  };
  const onKey = (e: ReactKeyboardEvent<HTMLElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (confirm) {
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        discard();
      }
      return;
    }
    if (mod && ((e.key.toLowerCase() === 's' && mode === 'edit') || e.key === 'Enter')) {
      e.preventDefault();
      e.stopPropagation();
      save();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      requestClose();
    }
  };
  const copy = (name: string, text: string) => {
    copyText(text);
    setCopied(name);
    setTimeout(() => setCopied((c) => (c === name ? null : c)), 1200);
  };
  const resize = (w: number) => {
    setWidth(w);
    onWidth?.(w);
  };

  // ---- the form
  const renderField = (c: Column, i: number) => {
    const meta: FieldMeta = metas[i];
    const kind = meta.kind;
    const v = draft[c.name];
    const err = visible(c.name) ? errors[c.name] : null;
    const generated = kind === 'generated';
    const nullOn = canon(c, meta, v) === null;
    const isChanged = changed.includes(c.name);
    const placeholder = v === null ? 'NULL' : v === undefined ? (c.default ?? '') : '';
    const scale = typeScale(c.type);
    const shown = v == null ? '' : typeof v === 'number' && scale !== null ? v.toFixed(scale) : String(v);
    const set = (x: RecordValue) => change(c.name, x);

    let control: ReactNode;
    if (generated) {
      control = <Input mono icon="lock" readOnly value={v == null ? '' : String(v)} placeholder={t('record.field.default')} aria-label={c.name} />;
    } else if (kind === 'boolean') {
      control = (
        <Switch
          checked={v === true}
          ariaLabel={c.name}
          onChange={set}
          label={
            <span className={cx('ss-mono', v == null && 'ss-faint')} style={{ fontSize: 12 }}>
              {v == null ? (v === null ? 'NULL' : t('record.field.default')) : String(v)}
            </span>
          }
        />
      );
    } else if (kind === 'time') {
      control = <MomentInput column={c} kind={meta.moment} value={v} placeholder={placeholder} error={!!err} onChange={set} />;
    } else if (kind === 'enum') {
      const cur = v == null ? '' : String(v);
      const options: SelectOption[] = meta.options.map((o) => ({ value: o, label: o }));
      if (cur !== '' && !meta.options.includes(cur)) options.push({ value: cur, label: cur });
      if (cur === '') options.unshift({ value: '', label: v === null ? 'NULL' : v === undefined && c.default ? c.default : t('record.field.chooseValue') });
      control = (
        <div className={cx(err && 'ss-rf-err')}>
          <Select mono value={cur} label={c.name} options={options} onChange={set} />
        </div>
      );
    } else if (kind === 'json') {
      const read = v == null || v === '' ? null : parseJson(String(v));
      control = (
        <SqlEditor
          language="json"
          value={v == null ? '' : String(v)}
          onChange={set}
          height={120}
          errorLine={err && read && !read.ok ? read.line : null}
          label={c.name}
          placeholder={v === null ? 'NULL' : ''}
        />
      );
    } else if (kind === 'reference' && c.fk) {
      control = (
        <FkPicker
          column={{ ...c, fk: c.fk }}
          value={v}
          rows={data[c.fk.table] ?? NO_ROWS}
          table={tables.find((x) => x.name === c.fk?.table)}
          error={!!err}
          defaultOpen={picking === c.name}
          query={picking === c.name ? pickQuery : undefined}
          onChange={set}
        />
      );
    } else if (kind === 'longtext') {
      control = (
        <textarea
          className={cx('ss-input ss-input--mono', err && 'ss-input--error')}
          rows={3}
          spellCheck={false}
          value={v == null ? '' : String(v)}
          placeholder={placeholder}
          aria-label={c.name}
          aria-invalid={err ? true : undefined}
          onChange={(e) => set(e.target.value)}
        />
      );
    } else {
      control = (
        <Input
          mono
          value={shown}
          placeholder={placeholder}
          error={!!err}
          spellCheck={false}
          aria-label={c.name}
          inputMode={kind === 'number' ? (isIntegerType(c.type) ? 'numeric' : 'decimal') : undefined}
          onChange={(e) => set(e.target.value)}
        />
      );
    }

    const toggleNull = () => {
      if (!nullOn) set(null);
      else if (isTextField(meta)) set('');
      else if (kind === 'boolean') set(false);
      else if (kind === 'enum') set(meta.options[0]);
      else focusIn(root.current, c.name);
    };
    const nullButton = c.nullable && !c.pk && !generated && (
      <Button size="sm" active={nullOn} aria-pressed={nullOn} title={t('record.field.setNull')} onClick={toggleNull}>
        NULL
      </Button>
    );
    const glyph = c.pk ? (
      <Icon name="key" size={12} className="ss-grid-key is-pk" label={t('grid.primaryKey')} />
    ) : c.fk ? (
      <Icon name="link" size={12} className="ss-grid-key is-fk" label={t('grid.foreignKey')} />
    ) : null;
    const isCopied = copied === c.name;
    return (
      <div key={c.name} className={cx('ss-rf', generated && 'is-generated')} data-field={c.name}>
        <Field
          label={
            <span className="ss-rf-name">
              {glyph}
              {c.name}
              {isChanged && <span className="ss-dirty-dot" title={t('record.field.changed')} />}
            </span>
          }
          error={err}
          hint={generated ? t('record.field.generated') : undefined}
        >
          <div className="ss-rf-type">{typeLine(c)}</div>
          <div className={cx('ss-rf-row', (kind === 'json' || kind === 'longtext') && 'ss-rf-row--top')}>
            <div className="ss-rf-grow">{control}</div>
            {nullButton}
          </div>
        </Field>
        <IconButton
          className={cx('ss-rf-copy', isCopied && 'is-copied')}
          icon={isCopied ? 'check' : 'copy'}
          size="sm"
          label={isCopied ? t('record.field.copied') : t('record.field.copy')}
          disabled={v == null || v === ''}
          onClick={() => copy(c.name, String(v))}
        />
      </div>
    );
  };

  // ---- the JSON
  const jsonBody = () => {
    const notes = object ? jsonNotes(table, metas, draft, object) : [];
    const bad = Object.keys(errors);
    return (
      <div className="ss-rec-json">
        <div className="ss-rec-tools">
          <Button size="sm" icon="code" disabled={!jsonOk || !parsed?.ok} onClick={() => parsed?.ok && setJsonText(JSON.stringify(parsed.value, null, 2))}>
            {t('record.json.format')}
          </Button>
          <Button size="sm" icon={copied === '__json' ? 'check' : 'copy'} onClick={() => copy('__json', jsonText)}>
            {copied === '__json' ? t('record.field.copied') : t('common.copy')}
          </Button>
          <Button size="sm" icon="check-circle" onClick={() => setReport(true)}>
            {t('record.json.validate')}
          </Button>
        </div>
        <div className="ss-rec-editor">
          <SqlEditor
            language="json"
            value={jsonText}
            onChange={editJson}
            label={t('record.json.label')}
            errorLine={parsed && !parsed.ok ? parsed.line : null}
            actionsRef={editor}
            style={{ height: 'auto', flex: '1 1 0', minHeight: 0 }}
          />
        </div>
        {parsed && !parsed.ok && (
          <div className="ss-parse is-error" role="alert">
            <Icon name="alert" size={16} />
            <span>{t('record.problem.json', { line: parsed.line })}</span>
            <a onClick={() => gotoLine(parsed.line)}>{t('record.json.goToLine')}</a>
          </div>
        )}
        {parsed?.ok && !object && (
          <div className="ss-parse is-error" role="alert">
            <Icon name="alert" size={16} />
            <span>{t('record.json.notObject')}</span>
          </div>
        )}
        {notes.map((n, i) => (
          <div key={i} className="ss-parse ss-parse--warn">
            <Icon name="warning" size={16} />
            <span>{n}</span>
          </div>
        ))}
        {report &&
          object &&
          (bad.length ? (
            <Alert tone="error" title={t('count.problems', { count: bad.length })}>
              {bad.map((n) => (
                <div key={n}>
                  <code>{n}</code> {errors[n]}
                </div>
              ))}
            </Alert>
          ) : (
            <Alert tone="success" title={t('record.json.valid.title')}>
              {t('record.json.valid.body', { columns: t('count.columns', { count: table.columns.length }) })}
            </Alert>
          ))}
      </div>
    );
  };

  // ---- the related records
  const relItem = (r: RelatedRows) => {
    const isOpen = open === r.key;
    const n = r.rows.length;
    return (
      <div key={r.key} className={cx('ss-rel', isOpen && 'is-open')}>
        <button type="button" className="ss-rel-head" aria-expanded={isOpen} disabled={!n} onClick={() => setOpen(isOpen ? null : r.key)}>
          <Icon name="chevron-down" size={14} />
          <span className="ss-rel-name">
            {r.dir === 'in' ? (
              qualifiedName(r.relation.from)
            ) : (
              <>
                {qualifiedName(r.relation.from)}
                <span className="ss-faint"> → </span>
                {qualifiedName(r.relation.to)}
              </>
            )}
            <span className="ss-faint">{` · ${rowsText(n)}`}</span>
          </span>
        </button>
        {isOpen && (
          <div className="ss-rel-body">
            <DataGrid columns={r.table.columns} rows={r.rows.slice(0, RELATED_ROWS)} density="compact" selectable={false} label={r.table.name} />
            {n > RELATED_ROWS && <div className="ss-rel-foot">{t('record.shownOf', { shown: formatNumber(RELATED_ROWS), rows: rowsText(n) })}</div>}
          </div>
        )}
      </div>
    );
  };
  const relGroup = (title: string, list: RelatedRows[], none: string) => (
    <section key={title} className="ss-pane-group" aria-label={title}>
      <div className="ss-row">
        <span className="ss-caption">{title}</span>
        <span className="ss-tl-count">{list.length}</span>
      </div>
      {list.length ? <div className="ss-rel-list">{list.map(relItem)}</div> : <div className="ss-pane-none">{none}</div>}
    </section>
  );

  const body =
    tab === 'json' ? (
      jsonBody()
    ) : tab === 'related' ? (
      <>
        {relGroup(t('relationships.references'), rels.out, t('relationships.noneOut', { table: table.name }))}
        {relGroup(t('relationships.referencedBy'), rels.inn, t('relationships.noneIn', { table: table.name }))}
      </>
    ) : (
      table.columns.map(renderField)
    );

  return (
    <Fragment>
      <ResizeHandle
        label={t('record.resize')}
        edge="left"
        width={width}
        min={RECORD_MIN_WIDTH}
        max={RECORD_MAX_WIDTH}
        onResize={resize}
        onReset={() => resize(RECORD_WIDTH)}
      />
      <aside ref={root} className="ss-recedit" aria-label={t('record.editorLabel')} style={{ width }} onKeyDown={onKey}>
        <div className="ss-tbh ss-rec-head">
          <div className="ss-tbh-row">
            <div className="ss-rec-titles">
              <h2 className="ss-rec-title">{t(mode === 'edit' ? 'record.title.edit' : 'record.title.new')}</h2>
              <div className="ss-rec-sub" title={label}>
                {label}
              </div>
            </div>
            <span className="ss-spacer" />
            {dirty && <SaveStatus state="dirty" />}
            <IconButton icon="x" label={t('record.close')} onClick={requestClose} />
          </div>
          <div className="ss-tabs" role="tablist" aria-label={t('record.views')}>
            {TABS.map((value, i) => {
              const on = tab === value;
              const off = value === 'related' && mode === 'new';
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  tabIndex={on ? 0 : -1}
                  disabled={off}
                  title={off ? t('record.noRelatedYet') : undefined}
                  className={cx('ss-tab', on && 'is-active')}
                  onClick={() => goTab(value)}
                  onKeyDown={(e) => onTabKey(e, i)}
                >
                  {t(`record.tab.${value}`)}
                  {value === 'related' && mode === 'edit' && <span className="ss-tab-count">{relTotal}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className={cx('ss-rec-body', tab === 'json' && 'is-json')} role="tabpanel" aria-label={t(`record.tab.${tab}`)}>
          {body}
        </div>
        <div className="ss-modal-foot ss-rec-foot">
          {problems > 0 && <span className="ss-rec-problems">{t('count.problems', { count: problems })}</span>}
          <span className="ss-spacer" />
          <Button onClick={requestClose} kbd="Esc">
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={mode === 'edit' && !dirty} kbd={mode === 'edit' ? ['⌘', 'S'] : ['⌘', '⏎']} onClick={save}>
            {t(mode === 'edit' ? 'record.save' : 'record.create')}
          </Button>
        </div>
        {confirm && <DiscardRecordDialog table={table.name} record={record ? label : null} changed={changed} onKeep={() => setConfirm(false)} onDiscard={discard} />}
      </aside>
    </Fragment>
  );
}
