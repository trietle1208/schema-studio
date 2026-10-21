import { useEffect, useState } from 'react';
import { BRIDGE_COMMAND, bridgeRunning, readCatalog } from '../bridge/client';
import { Button } from '../components/Button';
import { Checkbox } from '../components/Checkbox';
import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { Input } from '../components/Input';
import { rich } from '../components/rich';
import { Select } from '../components/Select';
import { Alert } from '../components/Toast';
import { t } from '../core/i18n';
import {
  catalogDdl,
  connectionLabel,
  countTables,
  DEFAULT_PORTS,
  DEFAULT_POSTGRES_SCHEMA,
  DEFAULT_SSH_PORT,
  SSH_AUTHS,
  toConnection,
  validateConnection,
  type ConnectionField,
  type ConnectionForm,
} from '../core/introspect';
import type { BridgeError, Connection } from '../core/introspect/catalog';
import { knownHostKey, trustHost } from '../db/knownHosts';
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
  /** The connection that was read, password included. The password stays in memory. */
  connection: Connection;
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

/** An SSH server whose key is not yet trusted, as the bridge found it. */
interface UntrustedHost {
  host: string;
  port: number;
  fingerprint: string;
  /** Another key was trusted for the server before. */
  changed: boolean;
}

const SSH_AUTH_LABELS = {
  password: 'connect.sshAuthPassword',
  key: 'connect.sshAuthKey',
  agent: 'connect.sshAuthAgent',
} as const;

/**
 * The "Connect to database" tab of the Import Schema dialog: asks where a database is and reads
 * the DDL of its tables through the connection bridge. Nothing is written to the database.
 */
export function ConnectDatabase({ engine, form, onForm, read, onRead }: ConnectDatabaseProps) {
  const [running, setRunning] = useState<boolean | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<BridgeError | null>(null);
  const [untrusted, setUntrusted] = useState<UntrustedHost | null>(null);
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
  const set = (changes: Partial<ConnectionForm>) => {
    // A key was asked about for the server as it was typed.
    setUntrusted(null);
    onForm({ ...form, ...changes });
  };

  const connect = async () => {
    setSent(true);
    if (reading || Object.keys(problems).length) return;
    setReading(true);
    setError(null);
    setUntrusted(null);
    const asked = toConnection(form, engine);
    // The bridge logs in only to a server whose key it is told.
    const hostKey = asked.ssh ? await knownHostKey(asked.ssh.host, asked.ssh.port) : undefined;
    const connection = toConnection(form, engine, hostKey);
    const answer = await readCatalog(connection);
    if (!answer.ok && answer.error.code === 'hostKey' && answer.error.hostKey && connection.ssh) {
      const { host, port } = connection.ssh;
      setUntrusted({ host, port, ...answer.error.hostKey });
      setReading(false);
      return;
    }
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
    onRead({ label: connectionLabel(connection), database: connection.database, sql: catalogDdl(answer.catalog), tables, connection });
  };

  const trust = async ({ host, port, fingerprint }: UntrustedHost) => {
    await trustHost(host, port, fingerprint);
    void connect();
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

  const field = (key: ConnectionField | 'schema', placeholder?: string) => ({
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
      <Checkbox label={t('connect.ssh')} checked={form.ssh} onChange={(ssh) => set({ ssh })} />
      {form.ssh && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 12,
            border: '1px solid var(--line-2)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-1)',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
            <Field label={t('connect.sshHost')} error={shown.sshHost}>
              <Input {...field('sshHost')} />
            </Field>
            <Field label={t('connect.port')} error={shown.sshPort}>
              <Input {...field('sshPort', String(DEFAULT_SSH_PORT))} inputMode="numeric" />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={t('connect.sshUser')} error={shown.sshUser}>
              <Input {...field('sshUser')} />
            </Field>
            <Field label={t('connect.sshAuth')}>
              <Select
                value={form.sshAuth}
                label={t('connect.sshAuth')}
                options={SSH_AUTHS.map((auth) => ({ value: auth, label: t(SSH_AUTH_LABELS[auth]) }))}
                onChange={(sshAuth) => set({ sshAuth: SSH_AUTHS.find((auth) => auth === sshAuth) ?? form.sshAuth })}
              />
            </Field>
          </div>
          {form.sshAuth === 'password' && (
            <Field label={t('connect.password')} aside={t('connect.notStored')}>
              <Input className="ss-secret" value={form.sshPassword} spellCheck={false} autoComplete="off" onChange={(e) => set({ sshPassword: e.target.value })} />
            </Field>
          )}
          {form.sshAuth === 'key' && (
            <>
              <Field label={t('connect.sshKeyPath')} hint={t('connect.sshKeyPathHint')} error={shown.sshKeyPath}>
                <Input {...field('sshKeyPath', '~/.ssh/id_ed25519')} />
              </Field>
              <Field label={t('connect.sshPassphrase')} aside={t('connect.sshPassphraseAside')}>
                <Input className="ss-secret" value={form.sshPassphrase} spellCheck={false} autoComplete="off" onChange={(e) => set({ sshPassphrase: e.target.value })} />
              </Field>
            </>
          )}
          {form.sshAuth === 'agent' && <div className="ss-field-hint">{t('connect.sshAgentHint')}</div>}
          <div className="ss-field-hint">{t('connect.sshNote')}</div>
        </div>
      )}
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
      {untrusted && (
        <Alert tone={untrusted.changed ? 'error' : 'warn'} title={t(untrusted.changed ? 'connect.hostChangedTitle' : 'connect.hostTitle')}>
          <div>{t(untrusted.changed ? 'connect.hostChangedBody' : 'connect.hostBody', { host: untrusted.host, port: untrusted.port })}</div>
          <code style={{ display: 'block', margin: '8px 0', wordBreak: 'break-all' }}>{untrusted.fingerprint}</code>
          <div className="ss-row" style={{ gap: 8 }}>
            <Button size="sm" variant={untrusted.changed ? 'danger' : 'primary'} onClick={() => void trust(untrusted)}>
              {t(untrusted.changed ? 'connect.hostTrustNew' : 'connect.hostTrust')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setUntrusted(null)}>
              {t('connect.hostDismiss')}
            </Button>
          </div>
        </Alert>
      )}
      {error && (
        <Alert tone="error" title={error.message}>
          {error.detail && <Marked text={error.detail} />}
        </Alert>
      )}
    </form>
  );
}
