import { useEffect, useState } from 'react';
import { highlightSql } from '../../core/highlight';
import { t } from '../../core/i18n';
import { IconButton } from '../IconButton';
import { SqlTokens } from '../SqlTokens';

/** The one-line WHERE clause, highlighted, with copy. */
export function SqlPreview({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = () => {
    if (!sql) return;
    try {
      navigator.clipboard.writeText(sql).then(
        () => setCopied(true),
        () => undefined,
      );
    } catch {
      // No clipboard here.
    }
  };
  return (
    <div className="ss-fb-sql">
      <span className="ss-caption">{t('builder.sql')}</span>
      <div className="ss-fb-sql-text" title={sql}>
        {sql ? <SqlTokens tokens={highlightSql(sql)} /> : null}
      </div>
      <IconButton icon={copied ? 'check' : 'copy'} size="sm" label={copied ? t('builder.copied') : t('common.copy')} disabled={!sql} onClick={copy} />
    </div>
  );
}
