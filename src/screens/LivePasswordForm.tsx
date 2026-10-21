import { useState } from 'react';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Input } from '../components/Input';
import { Alert } from '../components/Toast';
import { t } from '../core/i18n';
import type { BridgeError } from '../core/introspect/catalog';

export interface LivePasswordFormProps {
  /** The database, as the status bar names it. */
  database: string;
  /** A read that failed after a password was sent. */
  error?: BridgeError | null;
  onSubmit: (password: string) => void;
}

/** Asks for the database password again. It is kept in the session, not stored. */
export function LivePasswordForm({ database, error, onSubmit }: LivePasswordFormProps) {
  const [password, setPassword] = useState('');
  return (
    <form
      style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420, margin: '48px auto', padding: '0 24px' }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(password);
      }}
    >
      <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>{t('data.passwordNeeded', { database })}</p>
      {error && (
        <Alert tone="error" title={error.message}>
          {error.detail}
        </Alert>
      )}
      <Field label={t('connect.password')} aside={t('connect.notStored')}>
        <Input className="ss-secret" value={password} spellCheck={false} autoComplete="off" onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <div>
        <Button variant="primary" type="submit">
          {t('data.passwordConnect')}
        </Button>
      </div>
    </form>
  );
}
