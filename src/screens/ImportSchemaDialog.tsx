import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { DropZone } from '../components/DropZone';
import { Field } from '../components/Field';
import { Input } from '../components/Input';
import { Kbd } from '../components/Kbd';
import { Modal } from '../components/Modal';
import { SegmentedControl } from '../components/SegmentedControl';
import { Select } from '../components/Select';
import { ParseStatus, SqlEditor, type SqlEditorActions } from '../components/SqlEditor';
import { Alert } from '../components/Toast';
import {
  availableName,
  countLines,
  DEFAULT_IMPORT_NAME,
  excerptAround,
  formatBytes,
  MAX_IMPORT_BYTES,
  schemaNameFromFile,
} from '../core/files';
import { IMPORT_ENGINES, parserFor, type ParseOutcome } from '../core/parse';
import { plural } from '../core/plural';
import { ENGINES } from '../core/schemaList';
import { summarize } from '../core/summary';
import { validateSchemaName } from '../core/validate';
import { useSchemas } from '../db/useSchemas';
import { useUiStore } from '../store/ui';
import { importSchema } from './schemaActions';

type Mode = 'file' | 'paste';

/** The chosen file, read. */
interface SqlFile {
  name: string;
  meta: string;
  sql: string;
}

// Typing is not parsed key by key.
const PARSE_DELAY_MS = 150;
/** How many warnings are listed before the rest is only counted. */
const WARNINGS_SHOWN = 5;

/** The command whose output the drop zone says it reads, by dialect. */
const DUMP_COMMANDS: Record<string, string> = { PostgreSQL: 'pg_dump --schema-only', MySQL: 'mysqldump --no-data' };

const DIALECTS = ENGINES.map((engine) => {
  const supported = IMPORT_ENGINES.includes(engine);
  return { value: engine, label: supported ? engine : `${engine} (soon)`, disabled: !supported };
});

/**
 * Parses `sql` a moment after it stops changing. `outcome` is that of the latest parse, which is
 * of an earlier text while `pending`; it is null until there has been one.
 */
function useParsed(sql: string, engine: string): { outcome: ParseOutcome | null; pending: boolean } {
  const [parsed, setParsed] = useState<{ sql: string; engine: string; outcome: ParseOutcome } | null>(null);
  const blank = !sql.trim();
  useEffect(() => {
    if (blank) return;
    const timer = setTimeout(() => {
      const outcome = parserFor(engine)?.parse(sql);
      if (outcome) setParsed({ sql, engine, outcome });
    }, PARSE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [sql, engine, blank]);
  return { outcome: parsed?.outcome ?? null, pending: !blank && (parsed?.sql !== sql || parsed.engine !== engine) };
}

/** Text in which names are wrapped in backticks, with the names set as code. */
function Marked({ text }: { text: string }) {
  return <>{text.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))}</>;
}

export function ImportSchemaDialog() {
  const closeDialog = useUiStore((s) => s.closeDialog);
  const schemas = useSchemas();
  const [mode, setMode] = useState<Mode>('file');
  const [engine, setEngine] = useState(IMPORT_ENGINES[0]);
  const [file, setFile] = useState<SqlFile | null>(null);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  // The name follows the file until it is typed over.
  const [typedName, setTypedName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const editor = useRef<SqlEditorActions>(null);

  const taken = useMemo(() => (schemas ?? []).map((s) => s.name), [schemas]);
  const name = typedName ?? availableName(file ? schemaNameFromFile(file.name) : DEFAULT_IMPORT_NAME, taken);
  const nameProblem = validateSchemaName(name, taken);

  // A chosen file is what the Upload tab imports; without one, what is pasted under the drop zone.
  const fromFile = mode === 'file' && file !== null;
  const sql = fromFile ? file.sql : pasted;
  const { outcome, pending } = useParsed(sql, engine);

  const blank = !sql.trim();
  const tables = outcome?.ok ? outcome.tables : [];
  const state = blank ? 'idle' : !outcome ? 'parsing' : tables.length ? 'ok' : 'error';
  const error =
    state !== 'error' || !outcome
      ? null
      : outcome.ok
        ? { message: 'No CREATE TABLE statement found.', line: null, detail: 'Import needs at least one table.' }
        : outcome.error;
  const errorLine = error?.line ?? null;
  const excerpt = useMemo(
    () => (fromFile && errorLine ? excerptAround(file.sql, errorLine) : null),
    [fromFile, file, errorLine],
  );
  const warnings = outcome?.ok ? outcome.warnings : [];
  const skipped = outcome?.ok ? outcome.skipped : 0;
  const summary = summarize(tables);
  const ready = state === 'ok' && !pending && !nameProblem && !importing && !!schemas;

  const choose = async (picked: File | null) => {
    setFileProblem(null);
    if (!picked) return setFile(null);
    if (picked.size > MAX_IMPORT_BYTES) {
      setFileProblem(`${picked.name} is ${formatBytes(picked.size)}. Files up to 10 MB can be imported.`);
      return;
    }
    try {
      const text = await picked.text();
      setFile({ name: picked.name, meta: `${formatBytes(picked.size)} · ${plural(countLines(text), 'line')}`, sql: text });
    } catch (thrown) {
      console.error(thrown);
      setFileProblem(`${picked.name} could not be read.`);
    }
  };

  const submit = async () => {
    if (!ready) return;
    setImporting(true);
    const imported = await importSchema({ name, engine, tables, file: fromFile ? file.name : undefined });
    // On success the dialog is closed, and this component gone.
    if (!imported) setImporting(false);
  };

  // ⌘⏎ confirms from anywhere in the dialog. The handler is renewed on every render, so it sees the current fields.
  const confirm = useRef(submit);
  useEffect(() => {
    confirm.current = submit;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      void confirm.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pasteEditor = (height: number, placeholder?: string) => (
    <SqlEditor
      value={pasted}
      onChange={setPasted}
      height={height}
      placeholder={placeholder}
      errorLine={!fromFile ? errorLine : null}
      actionsRef={editor}
    />
  );

  return (
    <Modal
      title="Import Schema"
      subtitle="Bring in existing DDL. Nothing is written until you confirm."
      width={680}
      onClose={closeDialog}
      footerStart={
        state === 'ok' ? (
          <ParseStatus state="ok" summary={summary} />
        ) : error ? (
          <ParseStatus
            state="error"
            message={error.message}
            // A file has no editor to go to; the lines around the error are shown instead.
            onJump={errorLine && !fromFile ? () => editor.current?.goToLine(errorLine) : undefined}
          />
        ) : state === 'parsing' ? (
          <ParseStatus state="parsing" />
        ) : (
          <span className="ss-modal-foot-hint">
            <Kbd keys={['⌘', '⏎']} />
            to import
          </span>
        )
      }
      footer={
        <>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="primary" icon="download" disabled={!ready} onClick={() => void submit()}>
            Import Schema
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 12 }}>
        <Field label="Schema name" error={nameProblem}>
          <Input
            mono
            value={name}
            error={!!nameProblem}
            onChange={(e) => setTypedName(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            data-autofocus
          />
        </Field>
        <Field label="Dialect">
          <Select value={engine} onChange={setEngine} options={DIALECTS} label="Dialect" />
        </Field>
      </div>
      <SegmentedControl
        block
        value={mode}
        onChange={(v) => setMode(v as Mode)}
        options={[
          { value: 'file', label: 'Upload SQL file', icon: 'upload' },
          { value: 'paste', label: 'Paste SQL', icon: 'clipboard' },
          { value: 'connect', label: 'Connect to database', icon: 'plug', badge: 'Soon', disabled: true },
        ]}
      />
      {mode === 'file' && (
        <>
          <DropZone
            file={file}
            onFile={(picked) => void choose(picked)}
            hint={`.sql or .ddl · up to 10 MB · ${DUMP_COMMANDS[engine]} output works`}
          />
          {fileProblem && <Alert tone="error" title={fileProblem} />}
          {!file && (
            <>
              <div className="ss-or">or</div>
              <div>
                <div className="ss-field-label" style={{ marginBottom: 6 }}>
                  <span>Paste SQL</span>
                  <span className="ss-faint" style={{ fontWeight: 400 }}>
                    CREATE TABLE, ALTER TABLE, CREATE INDEX
                  </span>
                </div>
                {pasteEditor(132, '-- paste DDL here')}
              </div>
            </>
          )}
          {excerpt && (
            <SqlEditor
              value={excerpt.text}
              readOnly
              // As tall as its lines, with the editor's padding and border.
              height={countLines(excerpt.text) * 18 + 18}
              firstLine={excerpt.firstLine}
              errorLine={errorLine}
              label={`${file?.name ?? 'SQL'} near the error`}
            />
          )}
        </>
      )}
      {mode === 'paste' && pasteEditor(280)}
      {error && (
        <Alert tone="error" title={error.message}>
          {error.detail && <Marked text={error.detail} />}
        </Alert>
      )}
      {state === 'ok' && (fromFile || warnings.length > 0 || skipped > 0) && (
        <Alert tone="success" title="Ready to import">
          <div>
            <code>{summary}</code>
            {skipped > 0 && ` · ${plural(skipped, 'other statement')} skipped`}
            {warnings.length > 0 && ` · ${plural(warnings.length, 'warning')}:`}
          </div>
          {warnings.slice(0, WARNINGS_SHOWN).map((warning, i) => (
            <div key={i}>
              <Marked text={warning} />
            </div>
          ))}
          {warnings.length > WARNINGS_SHOWN && <div>{`and ${warnings.length - WARNINGS_SHOWN} more.`}</div>}
        </Alert>
      )}
    </Modal>
  );
}
