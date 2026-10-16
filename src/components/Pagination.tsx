import { useState } from 'react';
import { formatNumber, t } from '../core/i18n';
import { rowsText } from '../core/records/cells';
import { IconButton } from './IconButton';
import { Input } from './Input';

export interface PaginationProps {
  /** Counts from 1. */
  page: number;
  pageSize: number;
  /** The rows there are, all pages together. */
  total: number;
  onPage?: (page: number) => void;
  loading?: boolean;
}

export function Pagination({ page: asked, pageSize, total, onPage, loading }: PaginationProps) {
  const size = pageSize || 50;
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(1, asked || 1), pages);
  const from = total ? (page - 1) * size + 1 : 0;
  const to = Math.min(total, page * size);
  // What is being typed in the page box; null shows the page itself.
  const [draft, setDraft] = useState<string | null>(null);

  const go = (n: number) => {
    const next = Math.min(pages, Math.max(1, Math.round(n)));
    if (next !== page) onPage?.(next);
  };
  const commit = () => {
    if (draft !== null && draft.trim() !== '' && !isNaN(Number(draft))) go(Number(draft));
    setDraft(null);
  };

  const range = loading
    ? t('pager.loading')
    : total
      ? t('pager.range', { from: formatNumber(from), to: formatNumber(to), rows: rowsText(total) })
      : t('pager.none');

  return (
    <div className="ss-pager" role="navigation" aria-label={t('pager.label')}>
      <span className="ss-pager-range">{range}</span>
      <span className="ss-spacer" />
      <IconButton icon="chevron-left" size="sm" label={t('pager.previous')} disabled={loading || page <= 1} onClick={() => go(page - 1)} />
      <span className="ss-pager-page">
        {t('pager.page')}
        <Input
          mono
          size="sm"
          className="ss-pager-input"
          inputMode="numeric"
          aria-label={t('pager.pageNumber')}
          disabled={loading || pages === 1}
          value={draft ?? String(page)}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            else if (e.key === 'Escape') {
              e.stopPropagation();
              setDraft(null);
            }
          }}
        />
        {t('pager.of', { pages: formatNumber(pages) })}
      </span>
      <IconButton icon="chevron-right" size="sm" label={t('pager.next')} disabled={loading || page >= pages} onClick={() => go(page + 1)} />
    </div>
  );
}
