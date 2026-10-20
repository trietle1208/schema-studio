import { Fragment, type KeyboardEvent } from 'react';
import { t } from '../core/i18n';
import type { Table } from '../core/model';
import { rowsText } from '../core/records/cells';
import { Badge } from './Badge';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

export type TableTab = 'data' | 'structure' | 'relationships';

const TABS: { value: TableTab; icon: IconName }[] = [
  { value: 'data', icon: 'table' },
  { value: 'structure', icon: 'columns' },
  { value: 'relationships', icon: 'link' },
];

export interface TableHeaderProps {
  table: Table;
  /** The schema's name, the first step of the breadcrumb. */
  schema?: string;
  engine?: string;
  /** The rows the table has; left out until they are known. */
  rows?: number;
  /** The foreign keys that leave the table and the ones that point at it. */
  relationships?: number;
  tab?: TableTab;
  onTab?: (tab: TableTab) => void;
  /** Kept for callers that still pass them; the data toolbar owns these actions now. */
  onAdd?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onRefresh?: () => void;
  menuItems?: unknown;
  loading?: boolean;
}

export function TableHeader({
  table,
  schema,
  engine,
  rows,
  relationships,
  tab = 'data',
  onTab,
}: TableHeaderProps) {
  const counts: Partial<Record<TableTab, number>> = { structure: table.columns.length, relationships };
  const storage = engine && /mysql/i.test(engine) ? 'InnoDB' : undefined;
  const meta =
    rows != null
      ? storage
        ? t('tableHeader.metaStorage', {
            rows: rowsText(rows),
            columns: t('count.columns', { count: table.columns.length }),
            storage,
          })
        : t('tableHeader.meta', {
            rows: rowsText(rows),
            columns: t('count.columns', { count: table.columns.length }),
          })
      : t('count.columns', { count: table.columns.length });

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const n = (i + step + TABS.length) % TABS.length;
    (e.currentTarget.parentNode?.children[n] as HTMLElement | undefined)?.focus();
    onTab?.(TABS[n].value);
  };

  return (
    <header className="ss-tbh">
      <nav className="ss-tbh-crumb" aria-label={t('tableHeader.breadcrumb')}>
        {[schema, table.schema || 'public', table.name]
          .filter(Boolean)
          .map((part, i, all) => (
            <Fragment key={i}>
              {i > 0 && <span aria-hidden>/</span>}
              <span className={i === all.length - 1 ? 'is-last' : undefined}>{part}</span>
            </Fragment>
          ))}
      </nav>
      <div className="ss-tbh-row">
        <h2 className="ss-tbh-name">{table.name}</h2>
        {engine && (
          <Badge dot title={t('toolbar.engine')}>
            {engine}
          </Badge>
        )}
        <span className="ss-tbh-meta">{meta}</span>
      </div>
      <div className="ss-tabs" role="tablist" aria-label={t('tableHeader.views')}>
        {TABS.map(({ value, icon }, i) => {
          const on = tab === value;
          const n = counts[value];
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              className={cx('ss-tab', on && 'is-active')}
              onClick={() => onTab?.(value)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              <Icon name={icon} size={14} />
              {t(`tableHeader.tab.${value}`)}
              {n != null && <span className="ss-tab-count">({n})</span>}
            </button>
          );
        })}
      </div>
    </header>
  );
}
