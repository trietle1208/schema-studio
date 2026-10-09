import { useEffect, useState } from 'react';
import { BRIDGE_COMMAND, bridgeRunning, readCatalog } from '../bridge/client';
import { Button } from '../components/Button';
import { Checkbox } from '../components/Checkbox';
import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { Input } from '../components/Input';
import { rich } from '../components/rich';
import { Alert } from '../components/Toast';
import { t } from '../core/i18n';
import {
  catalogDdl,
  connectionLabel,
  countTables,
  DEFAULT_PORTS,
  DEFAULT_POSTGRES_SCHEMA,
  toConnection,
  validateConnection,
  type ConnectionForm,
} from '../core/introspect';
import type { BridgeError } from '../core/introspect/catalog';
import { Marked } from './Marked';

/** The tables of a database, read. */
export interface DatabaseRead {
  /** The database as it is named: `shop @ localhost:5432`. */
  label: string;
  /** Its name alone, which the schema is called unless another name is typed. */
  database: string;
  /** The DDL of its tables, in the dialect of its engine. */
  sql: string;
  tables: number;
}

export interface ConnectDatabaseProps {
  engine: string;
  /** The fields as they are typed. They are kept by the dialog, so they are still there after a look at another tab. */
  form: ConnectionForm;
  onForm: (form: ConnectionForm) => void;
  /** What was read; while there is something, it is shown in place of the form. */
  read: DatabaseRead | null;
  onRead: (read: DatabaseRead | null) => void;
}

/**
 * The "Connect to database" tab of the Import Schema dialog: asks where a database is and reads
 * the DDL of its tables through the connection bridge. Nothing is written to the database.
 */
export function ConnectDatabase({ engine, form, onForm, read, onRead }: ConnectDatabaseProps) {
  const [running, setRunning] = useState<boolean | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<BridgeError | null>(null);
  // Problems of the fields are shown once the form has been sent.
  const [sent, setSent] = useState(false);

  const check = () => void bridgeRunning().then(setRunning);
  useEffect(() => {
    let current = true;
    void bridgeRunning().then((is) => {
      if (current) setRunning(is);
    });
    return () => {
      current = false;
    };
  }, []);

  const problems = validateConnection(form);
  const shown = sent ? problems : {};
  const set = (changes: Partial<ConnectionForm>) => onForm({ ...form, ...changes });

  const connect = async () => {
    setSent(true);
    if (reading || Object.keys(problems).length) return;
    const connection = toConnection(form, engine);
    setReading(true);
    setError(null);
    const answer = await readCatalog(connection);
    if (!answer.ok) {
      // The bridge may have been stopped since it was last asked, which the warning above the form says.
      const up = await bridgeRunning();
      setRunning(up);
      setError(up ? answer.error : null);
      setReading(false);
      return;
    }
    setReading(false);
    setRunning(true);
    const tables = countTables(answer.catalog);
    if (!tables) {
      setError({
        message: t('connect.noTables'),
        detail: connection.schema
          ? t('connect.noTablesInSchema', { database: connection.database, schema: connection.schema })
          : t('connect.noTablesDetail', { database: connection.database }),
      });
      return;
    }
    onRead({ label: connectionLabel(connection), database: connection.database, sql: catalogDdl(answer.catalog), tables });
  };

  if (read) {
    return (
      <div className="ss-file">
        <span className="ss-file-icon">
          <Icon name="database" size={16} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ss-file-name">{read.label}</div>
          <div className="ss-file-meta">{t('connect.read', { engine, count: read.tables })}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onRead(null)}>
          {t('connect.change')}
        </Button>
      </div>
    );
  }

  const field = (key: 'host' | 'port' | 'database' | 'user' | 'schema', placeholder?: string) => ({
    mono: true,
    value: form[key],
    placeholder,
    spellCheck: false,
    autoComplete: 'off',
    error: key !== 'schema' && !!shown[key],
    onChange: (e: { target: { value: string } }) => set({ [key]: e.target.value }),
  });

  return (
    <form
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        void connect();
      }}
    >
      {running === false && (
        <Alert
          tone="warn"
          title={t('connect.bridgeDown')}
          action={
            <Button size="sm" onClick={check}>
              {t('connect.checkAgain')}
            </Button>
          }
        >
          {rich('connect.bridgeDownBody', { command: <code>{BRIDGE_COMMAND}</code> })}
        </Alert>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
        <Field label={t('connect.host')} error={shown.host}>
          <Input {...field('host')} />
        </Field>
        <Field label={t('connect.port')} error={shown.port}>
          <Input {...field('port', String(DEFAULT_PORTS[engine] ?? ''))} inputMode="numeric" />
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: engine === 'PostgreSQL' ? '1fr 1fr' : '1fr', gap: 12 }}>
        <Field label={t('field.database')} error={shown.database}>
          <Input {...field('database')} />
        </Field>
        {engine === 'PostgreSQL' && (
          <Field label={t('field.schema')}>
            <Input {...field('schema', DEFAULT_POSTGRES_SCHEMA)} />
          </Field>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label={t('connect.user')} error={shown.user}>
          <Input {...field('user')} />
        </Field>
        <Field label={t('connect.password')} aside={t('connect.notStored')}>
          {/* Not a password field to the browser, which would offer to save what is typed here for this page. */}
          <Input className="ss-secret" value={form.password} spellCheck={false} autoComplete="off" onChange={(e) => set({ password: e.target.value })} />
        </Field>
      </div>
      <div className="ss-row" style={{ gap: 12 }}>
        <Checkbox label={t('connect.ssl')} checked={form.ssl} onChange={(ssl) => set({ ssl })} />
        <span className="ss-spacer" />
        <span className="ss-modal-foot-hint">
          <Icon name="lock" size={14} />
          {t('connect.readOnly')}
        </span>
        <Button type="submit" icon="plug" disabled={reading}>
          {reading ? t('connect.reading') : t('connect.readTables')}
        </Button>
      </div>
      {error && (
        <Alert tone="error" title={error.message}>
          {error.detail && <Marked text={error.detail} />}
        </Alert>
      )}
    </form>
  );
}
