import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { t } from '../core/i18n';
import type { Column, Table } from '../core/model';
import { DELIMITERS, decodeText, type Delimiter } from '../core/records/csv';
import { rowsText } from '../core/records/cells';
import type { SourceCell } from '../core/records/convert';
import { isGenerated, type RecordData } from '../core/records/fields';
import {
  analyzeImport,
  CONSTANT,
  convertedColumns,
  groupRows,
  importPreview,
  mapColumns,
  type ColumnMap,
  type ImportAnalysis,
  type ImportMapping,
} from '../core/records/import';
import { delimiterName, describeSource, MAX_RECORDS_FILE_BYTES, readRecordsFile, sampleCells, type RecordsSource } from '../core/records/importFile';
import { typeLine } from '../core/records/record';
import { formatBytes } from '../core/files';
import { Badge } from './Badge';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { DataGrid } from './DataGrid';
import { DropZone } from './DropZone';
import { Field } from './Field';
import { Icon } from './Icon';
import { Input } from './Input';
import { Modal } from './Modal';
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
  onClose?: () => void;
  /** Height of the body, 708 when left out. */
  height?: number;
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
/** The steps that exist so far: Source and Map columns. */
const LAST_STEP = 1;

const Mono = ({ children }: { children: ReactNode }) => (
  <code className="ss-mono" style={{ color: 'var(--ink-1)' }}>
    {children}
  </code>
);

/** Where a row of the file is: `line 5` for CSV, `row 5` for JSON. */
const where = (src: RecordsSource, line: number) => t(src.unit === 'line' ? 'importRecords.where.line' : 'importRecords.where.row', { line });

/** Import Records: a CSV or JSON file, or pasted text, becomes rows of one table. Steps 1 and 2 of 4: Source and Map columns. */
export function ImportRecordsDialog({ table, data, schema, onClose, height }: ImportRecordsDialogProps) {
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
  // Only the file picked last is read into the dialog.
  const picked = useRef(0);

  const text = useDeferredValue(mode === 'file' ? fileText : pasted);
  const src = useMemo(() => (text ? readRecordsFile(text, { delimiter, header }) : null), [text, delimiter, header]);
  const ok = !!src && !src.error && src.rows.length > 0;
  const current = ok ? step : 0;
  const auto = useMemo(() => (ok ? mapColumns(table, src, data) : {}), [ok, src, table, data]);
  const mapping = useMemo<ImportMapping>(() => ({ ...auto, ...edits }), [auto, edits]);
  const analysis = useMemo(() => (ok && current === 1 ? analyzeImport(table, src, mapping, {}, data) : null), [ok, current, src, mapping, table, data]);
  const converts = useMemo(() => (ok && current === 1 ? convertedColumns(table, src, mapping, {}, data) : new Set<string>()), [ok, current, src, mapping, table, data]);
  const preview = useMemo(() => (analysis ? importPreview(table, analysis, 10) : null), [analysis, table]);

  const forget = () => {
    setEdits({});
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

  const next = () => {
    if (current === 0 && ok) setStep(1);
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

  // ---- the dialog
  let body: ReactNode;
  let footerStart: ReactNode;
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

  return (
    <Modal
      title={t('action.importRecords')}
      subtitle={rich('importRecords.subtitle', { table: <span className="ss-mono">{dest}</span> })}
      width={960}
      onClose={onClose}
      bodyStyle={{ padding: 0, gap: 0, overflow: 'hidden', height: height ?? 708 }}
      footerStart={footerStart}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          {current > 0 && (
            <Button icon="chevron-left" onClick={() => setStep(current - 1)}>
              {t('common.back')}
            </Button>
          )}
          <Button
            variant="primary"
            kbd={['⌘', '⏎']}
            // Settings and Review & import are the next step: the button waits for them.
            disabled={current === 0 ? !ok : current >= LAST_STEP}
            title={current >= LAST_STEP ? t('importRecords.laterSteps') : undefined}
            onClick={next}
          >
            {t('common.next')}
          </Button>
        </>
      }
    >
      <Stepper
        steps={STEPS.map((s) => t(`importRecords.step.${s}`))}
        current={current}
        label={t('importRecords.steps')}
        onStep={setStep}
      />
      <div className="ss-imp-content">{body}</div>
    </Modal>
  );
}
