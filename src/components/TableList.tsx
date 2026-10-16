import { useState } from 'react';
import { formatNumber, t } from '../core/i18n';
import type { Table } from '../core/model';
import { rowsText } from '../core/records/cells';
import { searchTableNames } from '../core/search';
import { cx } from './cx';
import { Icon } from './Icon';
import { Input } from './Input';

export interface TableListProps {
  tables: readonly Table[];
  /** How many rows each table has, by name; a table that is not in it shows no count. */
  counts?: Record<string, number>;
  selected?: string;
  onSelect?: (name: string) => void;
  /** Makes the search a controlled field; without it the list keeps what was typed itself. */
  search?: string;
  onSearch?: (query: string) => void;
}

/** The tables of the schema at the left of the Data mode, each with its number of rows. */
export function TableList({ tables, counts = {}, selected, onSelect, search, onSearch }: TableListProps) {
  const [own, setOwn] = useState('');
  const q = search ?? own;
  const shown = searchTableNames(tables, q);
  const total = tables.reduce((n, table) => n + (counts[table.name] ?? 0), 0);

  return (
    <aside className="ss-tablelist" aria-label={t('tableList.title')}>
      <div className="ss-tl-head">
        <span className="ss-caption">{t('tableList.title')}</span>
        <span className="ss-tl-count">{tables.length}</span>
      </div>
      <div className="ss-tl-search">
        <Input
          icon="search"
          size="sm"
          placeholder={t('tableList.search')}
          aria-label={t('tableList.searchLabel')}
          value={q}
          spellCheck={false}
          onChange={(e) => {
            setOwn(e.target.value);
            onSearch?.(e.target.value);
          }}
        />
      </div>
      <div className="ss-tl-list" role="listbox" aria-label={t('tableList.title')}>
        {shown.length ? (
          shown.map((table) => {
            const on = selected === table.name;
            const count = counts[table.name];
            return (
              <button
                key={table.name}
                type="button"
                role="option"
                aria-selected={on}
                className={cx('ss-tl-item', on && 'is-active')}
                onClick={() => onSelect?.(table.name)}
              >
                <Icon name="table" size={14} />
                <span className="ss-tl-name">{table.name}</span>
                {count != null && (
                  <span className="ss-tl-rows" title={rowsText(count)}>
                    {formatNumber(count)}
                  </span>
                )}
              </button>
            );
          })
        ) : (
          <div className="ss-tl-none">{t('tableList.none', { query: q.trim() })}</div>
        )}
      </div>
      <div className="ss-tl-foot">{t('tableList.foot', { tables: t('count.tables', { count: tables.length }), rows: rowsText(total) })}</div>
    </aside>
  );
}
