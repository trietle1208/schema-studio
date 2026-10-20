import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { formatNumber, t } from '../core/i18n';
import type { Column, Table } from '../core/model';
import { DELIMITERS, decodeText, type Delimiter } from '../core/records/csv';
import { rowsText } from '../core/records/cells';
import type { SourceCell } from '../core/records/convert';
import { isGenerated, type RecordData } from '../core/records/fields';
import type { Row } from '../core/records';
import {
  analyzeImport,
  CONSTANT,
  convertedColumns,
  groupRows,
  IMPORT_DEFAULTS,
  importPreview,
  importReport,
  importSummary,
  mapColumns,
  PROBLEM_KINDS,
  runImport,
  type ColumnMap,
  type ImportAnalysis,
  type ImportFail,
  type ImportMapping,
  type ImportOutcome,
  type ImportSettings,
  type ProblemKind,
} from '../core/records/import';
import { delimiterName, describeSource, MAX_RECORDS_FILE_BYTES, readRecordsFile, sampleCells, type RecordsSource } from '../core/records/importFile';
import { typeLine } from '../core/records/record';
import { formatBytes } from '../core/files';
import { Badge } from './Badge';
import { Button } from './Button';
import { Checkbox, Radio } from './Checkbox';
import { DataGrid } from './DataGrid';
import { DropZone } from './DropZone';
import { Field } from './Field';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Input } from './Input';
import { Kbd } from './Kbd';
import { Modal } from './Modal';
import { Progress } from './Progress';
import { rich } from './rich';
import { SegmentedControl } from './SegmentedControl';
import { Select } from './Select';
import { ParseStatus, SqlEditor } from './SqlEditor';
import { Stepper } from './Stepper';
import { Alert } from './Toast';

export interface ImportRecordsDialogProps {
  /** The destination. */
  table: Table;
  /** The rows of every table: unique keys and foreign keys are checked against them. */
  data: RecordData;
  /** The first part of `ecommerce.public.users`. */
  schema: string;
  /** Hears the rows that were written, once, when the import ended with at least one inserted or updated. */
  onImport?: (result: ImportResult) => void;
  /** "View imported rows": the dialog closes after it. */
  onViewRows?: (outcome: ImportOutcome) => void;
  onClose?: () => void;
  /** Height of the body, 708 when left out. */
  height?: number;
  /** Makes the database refuse that row, as a clash that appeared after the check does: for a preview or a test. */
  fail?: ImportFail | null;
}

/** What an import wrote: the rows to insert and the rows to update in `table`. */
export interface ImportResult {
  table: string;
  insert: Row[];
  update: { match: Row | null; values: Row }[];
  counts: { processed: number; inserted: number; updated: number; skipped: number; failed: number };
}

type Source = 'file' | 'paste';

/** The chosen file, before and after it is read. */
interface Chosen {
  name: string;
  bytes: number;
}

/** What went wrong with reading a file, as an Alert says it. */
interface ReadProblem {
  title: string;
  detail: string;
}

const STEPS = ['source', 'map', 'settings', 'review'] as const;
const LAST_STEP = STEPS.length - 1;

type Phase = 'review' | 'importing' | 'done';

/** What the review says of a kind of problem: an error stops the row, a warning leaves it out. A duplicate depends on the mode, see `groupTone`. */
type Tone = 'error' | 'warn' | 'info';
const GROUP_TONE: Record<ProblemKind, Tone> = { required: 'error', duplicate: 'warn', type: 'error', fk: 'error', date: 'error' };
const groupTone = (kind: ProblemKind, mode: ImportSettings['mode']): Tone => (kind !== 'duplicate' ? GROUP_TONE[kind] : mode === 'insert' ? 'warn' : 'info');
const toneIcon = (tone: Tone): IconName => (tone === 'error' ? 'alert' : tone === 'warn' ? 'warning' : 'info');

/** How many rows of a group of problems the review lists; the error report has the rest. */
const SHOWN_ITEMS = 5;

/** The progress bar fills in this many steps, one every `TICK_MS`. */
const TICKS = 24;
const TICK_MS = 45;

/** One number of the import, with what it counts above it. */
const Stat = ({ label, value, tone, icon }: { label: string; value: string; tone?: 'ok' | 'warn' | 'error' | null; icon?: IconName | null }) => (
  <div className={`ss-imp-stat${tone ? ` is-${tone}` : ''}`}>
    <div className="ss-imp-stat-label">
      {icon && <Icon name={icon} size={12} />}
      {label}
    </div>
    <div className="ss-imp-stat-n">{value}</div>
  </div>
);

/** Hands a text to the browser as a file. */
function saveText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const Mono = ({ children }: { children: ReactNode }) => (
  <code className="ss-mono" style={{ color: 'var(--ink-1)' }}>
    {children}
  </code>
);

/** Where a row of the file is: `line 5` for CSV, `row 5` for JSON. */
const where = (src: RecordsSource, line: number) => t(src.unit === 'line' ? 'importRecords.where.line' : 'importRecords.where.row', { line });

/** Import Records: a CSV or JSON file, or pasted text, becomes rows of one table, in four steps: Source, Map columns, Settings, Review & import. */
export function ImportRecordsDialog({ table, data, schema, onImport, onViewRows, onClose, height, fail = null }: ImportRecordsDialogProps) {
  const dest = `${schema}.${table.schema || 'public'}.${table.name}`;
  const existing = data[table.name] ?? [];
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Source>('file');
  const [file, setFile] = useState<Chosen | null>(null);
  const [fileText, setFileText] = useState('');
  const [pasted, setPasted] = useState('');
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<ReadProblem | null>(null);
  const [delimiter, setDelimiter] = useState<Delimiter | null>(null);
  const [header, setHeader] = useState<boolean | null>(null);
  // What was chosen over what the dialog matched.
  const [edits, setEdits] = useState<ImportMapping>({});
  const [settings, setSettings] = useState<ImportSettings>(IMPORT_DEFAULTS);
  const [phase, setPhase] = useState<Phase>('review');
  const [processed, setProcessed] = useState(0);
  const [cancelledAt, setCancelledAt] = useState<number | null>(null);
  // The import runs on the analysis of the moment it starts: once rows are written the host's `data` holds them, and checking the file against it again would call every row a duplicate.
  const [snap, setSnap] = useState<{ analysis: ImportAnalysis; settings: ImportSettings } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  // The groups of problems the user opened or closed; null while the review shows its first one.
  const [openGroups, setOpenGroups] = useState<ProblemKind[] | null>(null);
  // Only the file picked last is read into the dialog.
  const picked = useRef(0);
  const startedAt = useRef(0);
  const reported = useRef(false);

  const text = useDeferredValue(mode === 'file' ? fileText : pasted);
  const src = useMemo(() => (text ? readRecordsFile(text, { delimiter, header }) : null), [text, delimiter, header]);
  const ok = !!src && !src.error && src.rows.length > 0;
  const current = ok ? step : 0;
  const auto = useMemo(() => (ok ? mapColumns(table, src, data) : {}), [ok, src, table, data]);
  const mapping = useMemo<ImportMapping>(() => ({ ...auto, ...edits }), [auto, edits]);
  const analysis = useMemo(() => (ok && current >= 1 ? analyzeImport(table, src, mapping, settings, data) : null), [ok, current, src, mapping, settings, table, data]);
  const converts = useMemo(() => (ok && current === 1 ? convertedColumns(table, src, mapping, settings, data) : new Set<string>()), [ok, current, src, mapping, settings, table, data]);
  const preview = useMemo(() => (analysis && current === 1 ? importPreview(table, analysis, 10) : null), [analysis, current, table]);
  const ran = snap?.analysis ?? analysis;
  const ranSet = snap?.settings ?? settings;
  const outcome = useMemo(
    () => (snap ? runImport(snap.analysis, snap.settings, fail, cancelledAt ?? undefined, cancelledAt != null) : null),
    [snap, cancelledAt, fail],
  );
  const hasFks = table.columns.some((c) => c.fk);
  const counts = analysis?.counts ?? null;
  const left = counts ? counts.warnings + counts.errors : 0;
  const blocked = !!analysis && (analysis.missing.length > 0 || analysis.filled.length === 0);
  const canImport = !!counts && counts.valid > 0 && (settings.skipInvalid || left === 0);
  const canNext = current === 0 ? ok : current === 1 ? ok && !blocked : current === 2 ? ok : canImport;
  const busy = current === LAST_STEP && phase === 'importing';
  const live = useMemo(() => (busy && snap ? runImport(snap.analysis, snap.settings, fail, processed) : null), [busy, snap, fail, processed]);

  const forget = () => {
    setEdits({});
    setCancelledAt(null);
    setDelimiter(null);
    setHeader(null);
    setProblem(null);
  };

  const pickFile = async (f: File | null) => {
    const id = ++picked.current;
    forget();
    setFileText('');
    setReading(false);
    if (!f) return setFile(null);
    setFile({ name: f.name, bytes: f.size });
    if (f.size > MAX_RECORDS_FILE_BYTES) return setProblem({ title: t('importRecords.tooLarge'), detail: t('importRecords.tooLargeDetail') });
    setReading(true);
    try {
      const read = decodeText(new Uint8Array(await f.arrayBuffer()));
      if (picked.current !== id) return;
      if (read === null) setProblem({ title: t('importRecords.notUtf8'), detail: t('importRecords.notUtf8Detail') });
      else setFileText(read);
    } catch (thrown) {
      console.error(thrown);
      if (picked.current === id) setProblem({ title: t('importRecords.unreadable'), detail: t('importRecords.fixFile') });
    } finally {
      if (picked.current === id) setReading(false);
    }
  };

  const edit = (name: string, patch: Partial<ColumnMap>) => setEdits({ ...edits, [name]: { ...mapping[name], ...patch, by: 'manual' } });

  const setting = (patch: Partial<ImportSettings>) => setSettings({ ...settings, ...patch });

  // ---- the import
  const start = () => {
    if (!canImport || busy || !analysis) return;
    reported.current = false;
    startedAt.current = Date.now();
    setSnap({ analysis, settings });
    setCancelledAt(null);
    setProcessed(0);
    setPhase('importing');
  };
  /** Tells the host what was written, once. */
  const report = (o: ImportOutcome) => {
    if (reported.current) return;
    reported.current = true;
    if (o.inserted + o.updated > 0) {
      onImport?.({ table: table.name, insert: o.insert, update: o.update, counts: { processed: o.processed, inserted: o.inserted, updated: o.updated, skipped: o.skipped, failed: o.failed } });
    }
  };
  const seconds = () => Math.max(0.1, (Date.now() - startedAt.current) / 1000);
  // The progress bar fills over the rows the run processes; the last tick ends the import.
  useEffect(() => {
    if (phase !== 'importing' || !outcome) return;
    const last = outcome.processed;
    const size = Math.max(1, Math.ceil(last / TICKS));
    let done = 0;
    const id = setInterval(() => {
      done = Math.min(last, done + size);
      setProcessed(done);
      if (done < last) return;
      clearInterval(id);
      setElapsed(seconds());
      setPhase('done');
      report(outcome);
    }, TICK_MS);
    return () => clearInterval(id);
    // The run is fixed when it starts: `snap` is set together with the phase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  const cancelImport = () => {
    if (!snap) return;
    const part = runImport(snap.analysis, snap.settings, fail, processed, true);
    setElapsed(seconds());
    setCancelledAt(processed);
    setPhase('done');
    report(part);
  };
  const again = () => {
    picked.current++;
    forget();
    setSnap(null);
    setStep(0);
    setPhase('review');
    setFile(null);
    setFileText('');
    setPasted('');
    setProcessed(0);
  };
  const viewRows = () => {
    if (outcome) onViewRows?.(outcome);
    onClose?.();
  };
  const download = () => {
    if (ran) saveText(`${table.name}_import_errors.csv`, importReport(ran, outcome));
  };

  const next = () => {
    if (busy) return;
    if (current < LAST_STEP) {
      if (canNext) setStep(current + 1);
    } else if (phase === 'review') start();
    else if (phase === 'done') viewRows();
  };
  // ⌘⏎ is the primary button of the step. The handler is renewed on every render, so it sees the current step.
  const primary = useRef(next);
  useEffect(() => {
    primary.current = next;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      primary.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---- step 1: source
  const renderSource = () => {
    const meta = file ? formatBytes(file.bytes) + (ok && src ? ` · ${describeSource(src)}` : reading ? ` · ${t('importRecords.reading')}` : '') : '';
    return (
      <>
        <Field label={t('importRecords.destination')}>
          <div className="ss-imp-dest">
            <Icon name="table" size={14} />
            <span>{dest}</span>
            <span className="ss-spacer" />
            <span className="ss-imp-dim">{t('data.rowsOfColumns', { rows: rowsText(existing.length), columns: t('count.columns', { count: table.columns.length }) })}</span>
          </div>
        </Field>
        <SegmentedControl
          block
          value={mode}
          onChange={(v) => setMode(v as Source)}
          options={[
            { value: 'file', label: t('importRecords.mode.file'), icon: 'upload' },
            { value: 'paste', label: t('importRecords.mode.paste'), icon: 'clipboard' },
          ]}
        />
        {mode === 'file' ? (
          <DropZone
            file={file ? { name: file.name, meta } : null}
            onFile={(f) => void pickFile(f)}
            accept=".csv,.tsv,.txt,.json"
            noun={t('importRecords.drop.noun')}
            fileIcon="file"
            hint={t('importRecords.drop.hint')}
          />
        ) : (
          <SqlEditor
            value={pasted}
            onChange={(v) => {
              forget();
              setPasted(v);
            }}
            height={224}
            language="text"
            label={t('importRecords.paste.label')}
            placeholder={t('importRecords.paste.placeholder')}
          />
        )}
        {problem && (
          <Alert tone="error" title={problem.title}>
            {problem.detail}
          </Alert>
        )}
        {src?.error && (
          <Alert tone="error" title={src.error}>
            {mode === 'paste' ? t('importRecords.fixPaste') : t('importRecords.fixFile')}
          </Alert>
        )}
        {src && src.columns.length > 0 && (
          <div className="ss-imp-detect">
            <Badge tone="outline">{src.format === 'json' ? 'JSON' : 'CSV'}</Badge>
            {src.format === 'csv' && (
              <>
                <label className="ss-imp-opt">
                  {t('importRecords.delimiter')}
                  <Select
                    size="sm"
                    label={t('importRecords.delimiter')}
                    value={src.delimiter ?? ','}
                    options={DELIMITERS.map((d) => ({ value: d, label: delimiterName(d) }))}
                    onChange={(v) => {
                      setEdits({});
                      setDelimiter(v as Delimiter);
                    }}
                  />
                </label>
                <Checkbox
                  label={t('importRecords.header')}
                  checked={src.header}
                  onChange={(v) => {
                    setEdits({});
                    setHeader(v);
                  }}
                />
              </>
            )}
            <span className="ss-spacer" />
            <span className="ss-imp-dim">{t('importRecords.found', { rows: rowsText(src.rows.length), columns: t('count.columns', { count: src.columns.length }) })}</span>
          </div>
        )}
        {ok && src && (
          <>
            <div className="ss-imp-sect">
              <span className="ss-caption">{t('importRecords.firstRows', { count: Math.min(8, src.rows.length) })}</span>
            </div>
            <div className="ss-imp-raw-box">
              <table className="ss-imp-raw" style={{ minWidth: src.columns.length * 144 }}>
                <thead>
                  <tr>
                    {src.columns.map((n) => (
                      <th key={n} title={n}>
                        {n}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {src.rows.slice(0, 8).map((r, ri) => (
                    <tr key={ri}>
                      {r.map((v, ci) => (
                        <td key={ci} title={v === null ? undefined : String(v)}>
                          {v === null ? <span className="ss-null">NULL</span> : String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </>
    );
  };

  // ---- step 2: map columns
  const mapRow = (c: Column, source: RecordsSource) => {
    const m: ColumnMap = mapping[c.name] ?? { from: '', by: 'auto' };
    const generated = isGenerated(c);
    const constant = m.from === CONSTANT;
    const options = generated
      ? [{ value: '', label: t('importRecords.map.generated') }]
      : [
          { value: '', label: t('importRecords.map.ignore') },
          ...source.columns.map((n) => ({ value: n, label: n })),
          { value: CONSTANT, label: t('importRecords.map.constant') },
        ];
    const k = m.from && !constant ? source.columns.indexOf(m.from) : -1;
    const sample: SourceCell | undefined = k >= 0 ? sampleCells(source, k, 1)[0] : undefined;
    let badges: ReactNode[];
    if (generated) {
      badges = [<Badge key="g" title={t('importRecords.badge.generatedTitle')}>{t('importRecords.badge.generated', { name: c.name })}</Badge>];
    } else if (!m.from) {
      badges = [
        !c.nullable && !c.default ? (
          <Badge key="r" tone="removed" icon="alert" title={t('importRecords.badge.requiredTitle')}>
            {t('importRecords.badge.required')}
          </Badge>
        ) : (
          <Badge key="s" title={c.nullable ? t('importRecords.badge.skippedNull') : t('importRecords.badge.skippedDefault', { value: c.default ?? '' })}>
            {t('importRecords.badge.skipped')}
          </Badge>
        ),
      ];
    } else {
      badges = [
        m.by === 'auto' ? (
          <Badge key="a" tone="added" icon="check" title={t(`importRecords.badge.why.${m.why ?? 'same'}`)}>
            {t('importRecords.badge.matched')}
          </Badge>
        ) : (
          <Badge key="m" tone="outline" icon="pencil" title={t('importRecords.badge.manualTitle')}>
            {t('importRecords.badge.manual')}
          </Badge>
        ),
      ];
      if (converts.has(c.name)) {
        badges.push(
          <Badge key="c" tone="modified" title={t(source.format === 'json' ? 'importRecords.badge.convertValue' : 'importRecords.badge.convertText', { type: c.type })}>
            {t('importRecords.badge.convert')}
          </Badge>,
        );
      }
    }
    return (
      <div key={c.name} className="ss-imp-row" role="row">
        <div role="cell">
          <Select
            size="sm"
            mono
            label={t('importRecords.map.selectLabel', { name: c.name })}
            value={generated ? '' : m.from}
            options={options}
            disabled={generated}
            onChange={(v) => edit(c.name, { from: v, value: v === CONSTANT ? (m.value ?? '') : undefined })}
          />
        </div>
        <div className="ss-imp-sample" role="cell" title={sample != null ? String(sample) : undefined}>
          {constant ? (
            <Input
              size="sm"
              mono
              value={m.value ?? ''}
              placeholder={t('importRecords.map.constantPlaceholder')}
              aria-label={t('importRecords.map.constantLabel', { name: c.name })}
              onChange={(e) => edit(c.name, { from: CONSTANT, value: e.target.value })}
            />
          ) : sample != null ? (
            String(sample)
          ) : (
            <span className="ss-imp-dim">—</span>
          )}
        </div>
        <div className="ss-imp-arrow" aria-hidden>
          <Icon name="arrow-right" size={14} />
        </div>
        <div className="ss-imp-col" role="cell">
          <div className="ss-imp-col-name">
            {c.pk && <Icon name="key" size={12} className="ss-grid-key is-pk" label={t('grid.primaryKey')} />}
            {c.fk && <Icon name="link" size={12} className="ss-grid-key is-fk" label={t('grid.foreignKey')} />}
            {c.name}
          </div>
          <div className="ss-imp-col-type" title={typeLine(c)}>
            {typeLine(c)}
          </div>
        </div>
        <div className="ss-imp-status" role="cell">
          {badges}
        </div>
      </div>
    );
  };

  /** The first thing wrong with the mapping or the rows, as an Alert; null when there is nothing. */
  const mapAlert = (a: ImportAnalysis, source: RecordsSource) => {
    if (a.missing.length) {
      const name = a.missing[0];
      return (
        <Alert tone="error" title={t('import.problem.required', { name })}>
          {rich('importRecords.alert.missing', { column: <Mono>{name}</Mono> })}
        </Alert>
      );
    }
    const kind = (['required', 'type', 'date', 'fk'] as const).find((k) => a.groups[k].length > 0);
    if (!kind) return null;
    const items = a.groups[kind];
    const first = items[0];
    const n = groupRows(items);
    const other = a.counts.errors - n;
    return (
      <Alert tone="error" title={first.message}>
        {rich(kind === 'required' ? 'importRecords.alert.required' : 'importRecords.alert.type', {
          count: n,
          column: <Mono>{first.column}</Mono>,
          where: where(source, first.line),
        })}{' '}
        {t('importRecords.alert.cannot', { count: n })}
        {other > 0 && ` ${t('importRecords.alert.others', { count: other })}`}
      </Alert>
    );
  };

  const renderMap = (source: RecordsSource, a: ImportAnalysis, pv: NonNullable<typeof preview>) => {
    const used = new Set<string>();
    for (const c of table.columns) {
      const m = mapping[c.name];
      if (m?.from && m.from !== CONSTANT) used.add(m.from);
    }
    const unused = source.columns.filter((n) => !used.has(n));
    const alert = mapAlert(a, source);
    return (
      <>
        <div className="ss-imp-sect">
          <span className="ss-caption">{t('importRecords.columns')}</span>
          {unused.length > 0 && (
            <span className="ss-imp-dim">
              {t('importRecords.notImported')}{' '}
              {unused.map((n, i) => (
                <Fragment key={n}>
                  {i > 0 && ', '}
                  <span className="ss-mono">{n}</span>
                </Fragment>
              ))}
            </span>
          )}
          <span className="ss-spacer" />
          <Button size="sm" variant="ghost" icon="restore" disabled={!Object.keys(edits).length} onClick={() => setEdits({})}>
            {t('importRecords.reset')}
          </Button>
        </div>
        <div className="ss-imp-map" role="table" aria-label={t('importRecords.map.label')}>
          <div className="ss-imp-row is-head" role="row">
            <div role="columnheader">{t('importRecords.map.file')}</div>
            <div role="columnheader">{t('importRecords.map.sample')}</div>
            <div aria-hidden />
            <div role="columnheader">{t('importRecords.map.destination')}</div>
            <div role="columnheader">{t('importRecords.map.mapping')}</div>
          </div>
          {table.columns.map((c) => mapRow(c, source))}
        </div>
        {alert}
        <div className="ss-imp-sect">
          <span className="ss-caption">{t('importRecords.preview')}</span>
          <span className="ss-imp-dim">{t('importRecords.preview.after', { count: pv.rows.length })}</span>
        </div>
        <div className="ss-imp-preview" style={{ height: 34 + Math.max(pv.rows.length, 1) * 24 + (pv.columns.length ? 0 : 60) }}>
          {pv.columns.length ? (
            <DataGrid columns={pv.columns} rows={pv.rows} invalid={pv.invalid} density="compact" selectable={false} label={t('importRecords.preview.label')} />
          ) : (
            <div className="ss-imp-none">{t('importRecords.preview.none', { table: table.name })}</div>
          )}
        </div>
      </>
    );
  };

  // ---- step 3: settings
  const renderSettings = (a: ImportAnalysis, c: NonNullable<typeof counts>) => {
    const { keys, key } = a;
    const overwrites = a.filled.filter((n) => n !== key);
    const radio = (value: ImportSettings['mode'], label: ReactNode, description: string, disabled?: boolean) => (
      <Radio key={value} name="import-mode" label={label} description={description} checked={settings.mode === value} disabled={disabled} onChange={() => setting({ mode: value })} />
    );
    const note = [
      !c.valid
        ? t('importRecords.settings.note.none')
        : settings.mode === 'upsert' && c.update
          ? t('importRecords.settings.note.upsert', { count: c.insert, insert: formatNumber(c.insert), update: formatNumber(c.update) })
          : t('importRecords.settings.note.add', { count: c.valid }),
      left > 0 && (settings.skipInvalid ? t('importRecords.settings.note.leftOut', { count: left }) : t('importRecords.settings.note.blocked', { count: left })),
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <>
        <div className="ss-imp-cols">
          <div className="ss-imp-block">
            <div className="ss-caption">{t('importRecords.settings.whenExists')}</div>
            {radio('insert', t('importRecords.settings.insert'), t('importRecords.settings.insertHint'))}
            {radio(
              'upsert',
              rich('importRecords.settings.upsert', { key: <span className="ss-mono">{key || t('importRecords.settings.upsertKeyFallback')}</span> }),
              keys.length ? t('importRecords.settings.upsertHint') : t('importRecords.settings.upsertNeedsKey'),
              !keys.length,
            )}
            {settings.mode === 'upsert' && keys.length > 0 && (
              <div className="ss-imp-sub">
                <div className="ss-imp-sub-row">
                  <span className="ss-imp-dim">{t('importRecords.settings.conflictKey')}</span>
                  {keys.length > 1 ? (
                    <Select size="sm" mono label={t('importRecords.settings.conflictKey')} value={key} options={keys} onChange={(v) => setting({ key: v })} style={{ width: 168 }} />
                  ) : (
                    <span className="ss-mono">{key}</span>
                  )}
                </div>
                <div className="ss-imp-sub-row">
                  <span className="ss-imp-dim">{t('importRecords.settings.overwrites')}</span>
                  {overwrites.length ? (
                    <span className="ss-imp-chips">
                      {overwrites.map((n) => (
                        <Badge key={n} tone="modified">
                          {n}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    <span className="ss-imp-dim">{t('importRecords.settings.overwritesNone')}</span>
                  )}
                </div>
              </div>
            )}
            {radio('skip', t('importRecords.settings.skip'), t('importRecords.settings.skipHint'))}
          </div>
          <div className="ss-imp-block">
            <div className="ss-caption">{t('importRecords.settings.options')}</div>
            <Checkbox
              label={t('importRecords.settings.emptyNull')}
              description={t('importRecords.settings.emptyNullHint')}
              checked={settings.emptyNull}
              onChange={(v) => setting({ emptyNull: v })}
            />
            <Checkbox
              label={t('importRecords.settings.skipInvalid')}
              description={t('importRecords.settings.skipInvalidHint')}
              checked={settings.skipInvalid}
              onChange={(v) => setting({ skipInvalid: v })}
            />
            <Checkbox
              label={t('importRecords.settings.checkFk')}
              description={hasFks ? t('importRecords.settings.checkFkHint') : t('importRecords.settings.checkFkNone', { table: table.name })}
              checked={settings.checkFk}
              disabled={!hasFks}
              onChange={(v) => setting({ checkFk: v })}
            />
            <Checkbox
              label={t('importRecords.settings.stopOnError')}
              description={settings.oneTx ? t('importRecords.settings.stopOnErrorTx') : t('importRecords.settings.stopOnErrorHint')}
              checked={settings.stopOnError || settings.oneTx}
              disabled={settings.oneTx}
              onChange={(v) => setting({ stopOnError: v })}
            />
            <Checkbox
              label={t('importRecords.settings.oneTx')}
              description={t('importRecords.settings.oneTxHint')}
              checked={settings.oneTx}
              onChange={(v) => setting({ oneTx: v })}
            />
          </div>
        </div>
        <div className="ss-imp-sum" role="status">
          <div className="ss-caption">{t('importRecords.settings.summary')}</div>
          <div className="ss-imp-sum-line">{importSummary(c)}</div>
          <div className="ss-imp-sum-note">{note}</div>
        </div>
      </>
    );
  };

  // ---- step 4: review
  /** What to do about a group of problems. */
  const fixText = (kind: ProblemKind, items: ImportAnalysis['groups'][ProblemKind], a: ImportAnalysis) => {
    const message = items[0]?.message ?? '';
    switch (kind) {
      case 'required':
        return t('importRecords.group.fix.required');
      case 'duplicate':
        return t(`importRecords.group.fix.duplicate.${settings.mode}`, { key: a.key || t('importRecords.settings.upsertKeyFallback') });
      case 'type':
        return /longer/.test(message)
          ? t('importRecords.group.fix.type.length')
          : /number|whole|decimal/.test(message)
            ? t('importRecords.group.fix.type.number')
            : /true or false/.test(message)
              ? t('importRecords.group.fix.type.bool')
              : /JSON/.test(message)
                ? t('importRecords.group.fix.type.json')
                : t('importRecords.group.fix.type');
      case 'fk':
        return t('importRecords.group.fix.fk');
      default:
        return t('importRecords.group.fix.date');
    }
  };

  const cleanText = (kind: ProblemKind) =>
    kind === 'fk' ? (!hasFks ? t('importRecords.group.clean.fkNone', { table: table.name }) : settings.checkFk ? t('importRecords.group.clean.fk') : t('importRecords.group.clean.fkOff')) : t(`importRecords.group.clean.${kind}`);

  const renderGroup = (kind: ProblemKind, a: ImportAnalysis, source: RecordsSource, firstKind: ProblemKind | undefined) => {
    const items = a.groups[kind];
    const n = items.length ? groupRows(items) : 0;
    const tone = groupTone(kind, settings.mode);
    const open = items.length > 0 && (openGroups ? openGroups.includes(kind) : kind === firstKind);
    const toggle = () => {
      const cur = openGroups ?? (firstKind ? [firstKind] : []);
      setOpenGroups(cur.includes(kind) ? cur.filter((x) => x !== kind) : [...cur, kind]);
    };
    return (
      <div key={kind} className={`ss-imp-group is-${items.length ? tone : 'ok'}`}>
        <button type="button" className="ss-imp-group-head" disabled={!items.length} aria-expanded={items.length ? open : undefined} onClick={toggle}>
          <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} className="ss-imp-chev" />
          <Icon name={items.length ? toneIcon(tone) : 'check-circle'} size={14} className="ss-imp-gicon" />
          <span className="ss-imp-gtitle">{t(`importRecords.group.${kind}`)}</span>
          {items.length ? <span className="ss-imp-gcount">{rowsText(n)}</span> : <span className="ss-imp-gclean">{cleanText(kind)}</span>}
        </button>
        {open && (
          <div className="ss-imp-gbody">
            <div className="ss-imp-fix">{fixText(kind, items, a)}</div>
            <div className="ss-imp-items">
              {items.slice(0, SHOWN_ITEMS).map((it, i) => (
                <div key={i} className="ss-imp-item">
                  <span className="ss-imp-dim">{t(source.unit === 'line' ? 'importRecords.group.line' : 'importRecords.group.row', { line: it.line })}</span>
                  <span>{it.column}</span>
                  <span className="ss-imp-item-v" title={it.value == null ? undefined : String(it.value)}>
                    {it.value == null || it.value === '' ? <span className="ss-null">NULL</span> : String(it.value)}
                  </span>
                  <span className="ss-imp-item-msg">{it.message}</span>
                </div>
              ))}
            </div>
            {items.length > SHOWN_ITEMS && <div className="ss-imp-dim">{t('importRecords.group.more', { count: formatNumber(items.length - SHOWN_ITEMS) })}</div>}
          </div>
        )}
      </div>
    );
  };

  const renderReview = (a: ImportAnalysis, c: NonNullable<typeof counts>, source: RecordsSource) => {
    const firstKind = PROBLEM_KINDS.find((k) => a.groups[k].length > 0);
    const recap = [
      settings.mode === 'upsert' && a.key ? t('importRecords.settings.upsert', { key: a.key }) : t(`importRecords.review.mode.${settings.mode}`),
      settings.emptyNull && t('importRecords.review.recap.emptyNull'),
      settings.skipInvalid ? t('importRecords.review.recap.skipInvalid') : t('importRecords.review.recap.stopInvalid'),
      settings.checkFk && hasFks && t('importRecords.review.recap.checkFk'),
      settings.oneTx ? t('importRecords.review.recap.oneTx') : settings.stopOnError ? t('importRecords.review.recap.stopOnError') : t('importRecords.review.recap.noTx'),
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      <>
        <div className="ss-imp-stats">
          <Stat label={t('importRecords.review.rows')} value={formatNumber(c.total)} />
          <Stat label={t('importRecords.review.willImport')} value={formatNumber(c.valid)} tone="ok" icon="check-circle" />
          <Stat label={t('importRecords.review.warnings')} value={formatNumber(c.warnings)} tone={c.warnings ? 'warn' : null} icon="warning" />
          <Stat label={t('importRecords.review.errors')} value={formatNumber(c.errors)} tone={c.errors ? 'error' : null} icon="alert" />
          {c.skip > 0 && <Stat label={t('importRecords.review.skipped')} value={formatNumber(c.skip)} icon="info" />}
        </div>
        <div className="ss-imp-recap">
          <span className="ss-imp-dim">{recap}</span>
          <span className="ss-spacer" />
          <Button size="sm" variant="ghost" icon="settings" onClick={() => setStep(2)}>
            {t('importRecords.review.editSettings')}
          </Button>
        </div>
        {!settings.skipInvalid && left > 0 && (
          <Alert tone="error" title={t('importRecords.review.blocked', { count: left })}>
            {t('importRecords.review.blockedBody')}
          </Alert>
        )}
        <div className="ss-imp-groups">{PROBLEM_KINDS.map((k) => renderGroup(k, a, source, firstKind))}</div>
      </>
    );
  };

  const renderRunning = (total: number, o: ImportOutcome) => (
    <>
      <div className="ss-imp-result">
        <div className="ss-imp-result-icon">
          <Icon name="upload" size={18} />
        </div>
        <div>
          <div className="ss-imp-result-title">{t('importRecords.running')}</div>
          <div className="ss-imp-result-sub">
            <span className="ss-mono">{t('importRecords.running.of', { shown: formatNumber(processed), total: formatNumber(total) })}</span> {t('importRecords.running.into')}{' '}
            <span className="ss-mono">{dest}</span>
          </div>
        </div>
      </div>
      <Progress value={processed} max={total} label={t('importRecords.running.progress')} />
      <div className="ss-imp-stats">
        <Stat label={t('importRecords.running.processed')} value={formatNumber(o.processed)} />
        <Stat label={t('importRecords.running.inserted')} value={formatNumber(o.inserted)} tone="ok" />
        {ranSet.mode === 'upsert' && <Stat label={t('importRecords.running.updated')} value={formatNumber(o.updated)} />}
        <Stat label={t('importRecords.running.skipped')} value={formatNumber(o.skipped)} />
        <Stat label={t('importRecords.running.failed')} value={formatNumber(o.failed)} tone={o.failed ? 'error' : null} />
      </div>
      {ranSet.oneTx && (
        <Alert tone="info" title={t('importRecords.running.oneTx')}>
          {t('importRecords.running.oneTxBody')}
        </Alert>
      )}
    </>
  );

  const renderResult = (a: ImportAnalysis, o: ImportOutcome) => {
    const total = a.counts.total;
    const failed = o.failed > 0;
    const cancelled = cancelledAt != null;
    const tone = cancelled ? 'warn' : failed ? 'error' : 'ok';
    const rolled = o.rolledBack || (ranSet.oneTx && (failed || cancelled));
    const written = o.inserted + o.updated;
    // What the rows that were left out were left out for.
    const tally: Partial<Record<ProblemKind, number>> = {};
    for (const r of a.rows.slice(0, o.processed)) {
      if (r.kind === 'insert' || r.kind === 'update') continue;
      const k: ProblemKind = r.kind === 'invalid' ? r.problems[0].kind : 'duplicate';
      tally[k] = (tally[k] ?? 0) + 1;
    }
    const title = cancelled ? t('importRecords.done.cancelled') : failed ? t('importRecords.done.failed') : t('importRecords.done.completed');
    const sub =
      failed || cancelled
        ? rolled
          ? t('importRecords.done.nothingTo')
          : t('importRecords.done.written', { count: formatNumber(written) })
        : t('importRecords.done.added', { count: o.inserted });
    const ending =
      tone === 'ok' ? `${t('importRecords.done.in', { secs: `${elapsed.toFixed(1)} s` })}${o.updated ? t('importRecords.done.andUpdated', { count: o.updated }) : ''}.` : '.';
    const lines = o.error?.line ?? 0;
    const iconName: IconName = tone === 'ok' ? 'check-circle' : tone === 'error' ? 'alert' : 'warning';
    return (
      <>
        <div className={`ss-imp-result is-${tone}`}>
          <div className="ss-imp-result-icon">
            <Icon name={iconName} size={18} />
          </div>
          <div>
            <div className="ss-imp-result-title">{title}</div>
            <div className="ss-imp-result-sub">
              {sub}
              <span className="ss-mono">{dest}</span>
              {ending}
            </div>
          </div>
        </div>
        <div className="ss-imp-stats">
          <Stat label={t('importRecords.running.processed')} value={o.processed === total ? formatNumber(total) : t('importRecords.running.of', { shown: formatNumber(o.processed), total: formatNumber(total) })} />
          <Stat label={t('importRecords.running.inserted')} value={formatNumber(o.inserted)} tone={o.inserted ? 'ok' : null} icon={o.inserted ? 'check-circle' : null} />
          {ranSet.mode === 'upsert' && <Stat label={t('importRecords.running.updated')} value={formatNumber(o.updated)} tone={o.updated ? 'ok' : null} />}
          <Stat label={t('importRecords.running.skipped')} value={formatNumber(o.skipped)} icon={o.skipped ? 'info' : null} />
          <Stat label={t('importRecords.running.failed')} value={formatNumber(o.failed)} tone={o.failed ? 'error' : null} icon={o.failed ? 'alert' : null} />
        </div>
        {failed && o.error && (
          <Alert tone="error" title={rolled ? t('importRecords.done.nothingWritten') : t('importRecords.done.refused', { line: lines })}>
            {ranSet.oneTx
              ? t('importRecords.done.failTx', { line: lines, message: o.error.message })
              : `${t('importRecords.done.failLine', { line: lines, message: o.error.message })}${o.stopped ? t('importRecords.done.failStopped') : t('importRecords.done.failOthers')}`}
          </Alert>
        )}
        {cancelled && (
          <Alert tone="warn" title={rolled ? t('importRecords.done.nothingWritten') : t('importRecords.done.cancelPartial', { count: formatNumber(written) })}>
            {rolled ? t('importRecords.done.cancelTx') : t('importRecords.done.cancelPartialBody')}
          </Alert>
        )}
        {!failed && !cancelled && o.skipped > 0 && (
          <>
            <div className="ss-imp-sect">
              <span className="ss-caption">{t('importRecords.done.skippedRows')}</span>
              <span className="ss-imp-dim">{t('importRecords.done.skippedHint')}</span>
            </div>
            <div className="ss-imp-items">
              {PROBLEM_KINDS.filter((k) => tally[k]).map((k) => {
                const rowTone = groupTone(k, ranSet.mode);
                return (
                  <div key={k} className={`ss-imp-reason is-${rowTone}`}>
                    <Icon name={toneIcon(rowTone)} size={14} />
                    <span>{t(`importRecords.group.${k}`)}</span>
                    <span className="ss-imp-gcount">{rowsText(tally[k] ?? 0)}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {written > 0 && (
          <div className="ss-imp-recap">
            <Icon name="info" size={14} style={{ color: 'var(--ink-3)' }} />
            <span className="ss-imp-dim">{t('importRecords.done.undoHint', { count: written })}</span>
          </div>
        )}
      </>
    );
  };

  // ---- the dialog
  let body: ReactNode;
  let footerStart: ReactNode;
  let footer: ReactNode;
  const cancel = <Button onClick={onClose}>{t('common.cancel')}</Button>;
  const back = (
    <Button icon="chevron-left" onClick={() => setStep(current - 1)}>
      {t('common.back')}
    </Button>
  );
  if (current === LAST_STEP && phase === 'importing' && ran && live) {
    body = renderRunning(ran.counts.total, live);
    footerStart = !ranSet.oneTx && <span className="ss-modal-foot-hint">{t('importRecords.running.hint')}</span>;
    footer = <Button onClick={cancelImport}>{t('importRecords.running.cancel')}</Button>;
  } else if (current === LAST_STEP && phase === 'done' && ran && outcome) {
    body = renderResult(ran, outcome);
    footerStart = (
      <>
        {outcome.skipped + outcome.failed > 0 && (
          <Button icon="download" onClick={download}>
            {t('importRecords.done.download')}
          </Button>
        )}
        <Button variant="ghost" onClick={again}>
          {t('importRecords.done.again')}
        </Button>
      </>
    );
    footer = (
      <>
        <Button kbd="Esc" onClick={onClose}>
          {t('importRecords.done.close')}
        </Button>
        <Button variant="primary" icon="eye" kbd={['⌘', '⏎']} disabled={outcome.inserted + outcome.updated === 0} onClick={viewRows}>
          {t('importRecords.done.view')}
        </Button>
      </>
    );
  } else {
    if (current === 1 && src && analysis && preview) {
      body = renderMap(src, analysis, preview);
      const fillable = table.columns.filter((c) => !isGenerated(c)).length;
      const problems = analysis.missing.length ? t('importRecords.problem.missing') : analysis.counts.errors > 0 ? t('importRecords.problem.rows', { count: analysis.counts.errors }) : null;
      footerStart = (
        <span className="ss-modal-foot-hint">
          {t('importRecords.filled', { filled: analysis.filled.length, total: fillable })}
          {problems && <span style={{ color: 'var(--removed)' }}> · {problems}</span>}
        </span>
      );
    } else if (current === 2 && analysis && counts) {
      body = renderSettings(analysis, counts);
      footerStart = (
        <span className="ss-modal-foot-hint">
          <Kbd keys={['⌘', '⏎']} />
          {t('importRecords.settings.toReview')}
        </span>
      );
    } else if (current === 3 && analysis && counts && src) {
      body = renderReview(analysis, counts, src);
      footerStart = (
        <span className="ss-modal-foot-hint">
          {canImport
            ? t('importRecords.review.willAdd', { count: counts.valid, table: table.name })
            : !settings.skipInvalid && left > 0
              ? t('importRecords.review.fixOrSkip')
              : t('importRecords.review.nothing')}
        </span>
      );
    } else {
      body = renderSource();
      const summary = src ? `${rowsText(src.rows.length)} · ${t('count.columns', { count: src.columns.length })}` : '';
      footerStart = ok ? (
        <ParseStatus state="ok" summary={summary} />
      ) : src?.error ? (
        <ParseStatus state="error" message={src.error} />
      ) : problem ? (
        <ParseStatus state="error" message={problem.title} />
      ) : reading ? (
        <ParseStatus state="parsing" />
      ) : (
        <ParseStatus state="idle" message={t('importRecords.idle')} />
      );
    }
    footer = (
      <>
        {cancel}
        {current > 0 && back}
        {current < LAST_STEP ? (
          <Button variant="primary" kbd={['⌘', '⏎']} disabled={!canNext} onClick={next}>
            {t('common.next')}
          </Button>
        ) : (
          <Button variant="primary" icon="upload" kbd={['⌘', '⏎']} disabled={!canImport} onClick={start}>
            {t('importRecords.review.import', { count: counts?.valid ?? 0 })}
          </Button>
        )}
      </>
    );
  }

  return (
    <Modal
      title={t('action.importRecords')}
      subtitle={rich('importRecords.subtitle', { table: <span className="ss-mono">{dest}</span> })}
      width={960}
      // Esc and the backdrop do not close it while rows are being written: Cancel import is the way out.
      onClose={busy ? undefined : onClose}
      bodyStyle={{ padding: 0, gap: 0, overflow: 'hidden', height: height ?? 708 }}
      footerStart={footerStart}
      footer={footer}
    >
      <Stepper
        steps={STEPS.map((s) => t(`importRecords.step.${s}`))}
        current={current}
        label={t('importRecords.steps')}
        onStep={busy || (current === LAST_STEP && phase === 'done') ? undefined : setStep}
      />
      <div className="ss-imp-content">{body}</div>
    </Modal>
  );
}
