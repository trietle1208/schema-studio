import { Fragment, type KeyboardEvent } from 'react';
import { t } from '../core/i18n';
import type { Table } from '../core/model';
import { rowsText } from '../core/records/cells';
import { Badge } from './Badge';
import { Button } from './Button';
import { ContextMenu, type MenuItem } from './ContextMenu';
import { cx } from './cx';
import { IconButton } from './IconButton';
import { usePopover } from './usePopover';

export type TableTab = 'data' | 'structure' | 'relationships';

const TABS: TableTab[] = ['data', 'structure', 'relationships'];

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
  // Each button stays disabled without a handler.
  onAdd?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onRefresh?: () => void;
  /** The items of the "More actions" menu; without them the menu lists the usual ones with nothing behind them. */
  menuItems?: (MenuItem | '-')[];
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
  onAdd,
  onImport,
  onExport,
  onRefresh,
  menuItems,
  loading,
}: TableHeaderProps) {
  const [moreOpen, setMoreOpen, moreRef] = usePopover();
  const counts: Partial<Record<TableTab, number>> = { structure: table.columns.length, relationships };
  const meta = t('tableHeader.meta', {
    rows: rows != null ? rowsText(rows) : '',
    columns: t('count.columns', { count: table.columns.length }),
  });
  const items: (MenuItem | '-')[] = menuItems ?? [
    { icon: 'layers', label: t('action.openInDiagram') },
    { icon: 'copy', label: t('action.copyTableName') },
    { icon: 'code', label: t('action.copyCreateTable') },
  ];

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const n = (i + step + TABS.length) % TABS.length;
    (e.currentTarget.parentNode?.children[n] as HTMLElement | undefined)?.focus();
    onTab?.(TABS[n]);
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
        <span className="ss-tbh-meta">{rows != null ? meta : t('count.columns', { count: table.columns.length })}</span>
        <span className="ss-spacer" />
        <IconButton icon="refresh" label={t('tableHeader.refresh')} disabled={loading || !onRefresh} onClick={onRefresh} />
        <div className="ss-anchor" ref={moreRef}>
          <IconButton
            icon="more"
            label={t('tableHeader.more')}
            active={moreOpen}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(!moreOpen)}
          />
          {moreOpen && (
            <div className="ss-anchor-pop ss-anchor-pop--end">
              <ContextMenu items={items} onClose={() => setMoreOpen(false)} />
            </div>
          )}
        </div>
        <Button icon="upload" disabled={!onImport} onClick={onImport}>
          {t('action.importRecords')}
        </Button>
        <Button icon="download" disabled={!onExport} onClick={onExport}>
          {t('common.export')}
        </Button>
        <Button variant="primary" icon="plus" kbd={['⌘', '⏎']} disabled={!onAdd} onClick={onAdd}>
          {t('action.addRecord')}
        </Button>
      </div>
      <div className="ss-tabs" role="tablist" aria-label={t('tableHeader.views')}>
        {TABS.map((value, i) => {
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
              {t(`tableHeader.tab.${value}`)}
              {n != null && <span className="ss-tab-count">{n}</span>}
            </button>
          );
        })}
      </div>
    </header>
  );
}
