import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '../core/i18n';
import type { Column } from '../core/model';
import type { RecordSort } from '../core/records';
import { cellKind } from '../core/records/cells';
import { filterOps, type RecordFilter } from '../core/records/filter';
import { Badge } from './Badge';
import { BulkActionBar } from './BulkActionBar';
import { Button } from './Button';
import { ButtonGroup } from './ButtonGroup';
import { ColumnsMenu } from './ColumnsMenu';
import { ContextMenu, type MenuItem } from './ContextMenu';
import { Field } from './Field';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { Select } from './Select';
import { usePopover } from './usePopover';

export interface DataToolbarProps {
  columns: readonly Column[];
  /** Table name, for the search placeholder. */
  table?: string;
  search?: string;
  onSearch?: (q: string) => void;
  filters?: readonly RecordFilter[];
  onAddFilter?: (filter: RecordFilter) => void;
  sort?: RecordSort | null;
  onSort?: (sort: RecordSort | null) => void;
  hidden?: readonly string[];
  onHidden?: (names: string[]) => void;
  onRefresh?: () => void;
  loading?: boolean;
  onImport?: () => void;
  onExport?: () => void;
  onAdd?: () => void;
  menuItems?: (MenuItem | '-')[];
  /** When above zero, the left tools become the bulk bar. */
  selectedCount?: number;
  onEditSelected?: () => void;
  onDuplicateSelected?: () => void;
  onExportSelected?: () => void;
  onDeleteSelected?: () => void;
  onClearSelection?: () => void;
}

function FilterForm({ columns, onAdd }: { columns: readonly Column[]; onAdd: (f: RecordFilter) => void }) {
  const cols = columns;
  const [column, setColumn] = useState(cols[0]?.name ?? '');
  const [op, setOp] = useState<RecordFilter['op']>('=');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const col = cols.find((c) => c.name === column) || cols[0];
  const kind = col ? cellKind(col.type) : 'text';
  const bare = op === 'IS NULL' || op === 'IS NOT NULL';
  const submit = () => {
    if (!col) return;
    if (bare) {
      onAdd({ column: col.name, op });
      return;
    }
    let v: string | number | boolean = value;
    if (v === '') {
      setError(t('dataToolbar.valueEmpty'));
      return;
    }
    if (kind === 'number') {
      const n = Number(v);
      if (Number.isNaN(n)) {
        setError(t('dataToolbar.valueNumber'));
        return;
      }
      v = n;
    } else if (kind === 'boolean') {
      if (v !== 'true' && v !== 'false') {
        setError(t('dataToolbar.valueBoolean'));
        return;
      }
      v = v === 'true';
    }
    onAdd({ column: col.name, op, value: v });
  };
  return (
    <div
      className="ss-menu ss-dt-pop ss-dt-pop--filter"
      role="dialog"
      aria-label={t('dataToolbar.addFilter')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
          e.preventDefault();
          submit();
        }
      }}
    >
      <div className="ss-menu-label">{t('dataToolbar.addFilter')}</div>
      <div className="ss-dt-form">
        <div className="ss-dt-form-row">
          <Select mono size="sm" label={t('field.columnName')} value={column} onChange={(v) => { setColumn(v); setError(null); }} options={cols.map((c) => c.name)} />
          <Select mono size="sm" label={t('dataToolbar.operator')} value={op} onChange={(v) => { setOp(v as RecordFilter['op']); setError(null); }} options={[...filterOps()]} />
        </div>
        {!bare && (
          <Field error={error}>
            <Input
              mono
              size="sm"
              placeholder={kind === 'time' ? 'YYYY-MM-DD HH:mm:ss' : t('dataToolbar.value')}
              aria-label={t('dataToolbar.value')}
              error={!!error}
              value={value}
              inputRef={input}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
            />
          </Field>
        )}
        <div className="ss-dt-form-foot">
          <Button variant="primary" size="sm" kbd="⏎" onClick={submit}>
            {t('dataToolbar.addFilter')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function sortItems(cols: readonly Column[], sort: RecordSort | null | undefined, onSort?: (s: RecordSort | null) => void): (MenuItem | '-')[] {
  const items: (MenuItem | '-')[] = cols.map((c) => {
    const on = !!sort && sort.column === c.name;
    return {
      icon: on ? (sort!.dir === 'asc' ? 'arrow-up' : 'arrow-down') : undefined,
      label: <span className="ss-mono" style={{ fontSize: 12 }}>{c.name}</span>,
      active: on,
      shortcut: on ? sort!.dir.toUpperCase() : undefined,
      onSelect: () => onSort?.(!on ? { column: c.name, dir: 'asc' } : sort!.dir === 'asc' ? { column: c.name, dir: 'desc' } : null),
    };
  });
  return sort ? [...items, '-', { icon: 'x', label: t('dataToolbar.clearSort'), onSelect: () => onSort?.(null) }] : items;
}

/** The tools over the grid: find rows, narrow them, order them, choose columns; import / export / add on the right. */
export function DataToolbar({
  columns,
  table,
  search = '',
  onSearch,
  filters = [],
  onAddFilter,
  sort = null,
  onSort,
  hidden = [],
  onHidden,
  onRefresh,
  loading,
  onImport,
  onExport,
  onAdd,
  menuItems,
  selectedCount = 0,
  onEditSelected,
  onDuplicateSelected,
  onExportSelected,
  onDeleteSelected,
  onClearSelection,
}: DataToolbarProps) {
  const [filterOpen, setFilterOpen, filterRef] = usePopover();
  const [sortOpen, setSortOpen, sortRef] = usePopover();
  const [colsOpen, setColsOpen, colsRef] = usePopover();
  const [moreOpen, setMoreOpen, moreRef] = usePopover();
  const shown = columns.length - hidden.length;
  const items: (MenuItem | '-')[] = menuItems ?? [
    { icon: 'layers', label: t('action.openInDiagram') },
    { icon: 'copy', label: t('action.copyTableName') },
    { icon: 'code', label: t('action.copyCreateTable') },
  ];

  let left: ReactNode;
  if (selectedCount > 0) {
    left = (
      <BulkActionBar
        count={selectedCount}
        onEdit={onEditSelected}
        onDuplicate={onDuplicateSelected}
        onExport={onExportSelected}
        onDelete={onDeleteSelected}
        onClear={onClearSelection}
      />
    );
  } else {
    left = (
      <>
        <div className="ss-dt-search">
          <Input
            icon="search"
            placeholder={t('dataToolbar.search', { table: table || '' })}
            aria-label={t('dataToolbar.searchLabel')}
            value={search}
            onChange={onSearch ? (e) => onSearch(e.target.value) : undefined}
            readOnly={!onSearch}
            spellCheck={false}
          />
        </div>
        <div className="ss-anchor" ref={filterRef}>
          <Button icon="filter" active={filterOpen} aria-haspopup="dialog" aria-expanded={filterOpen} onClick={() => setFilterOpen(!filterOpen)}>
            {t('dataToolbar.filter')}
            {filters.length > 0 && (
              <Badge tone="accent" title={t('count.filters', { count: filters.length })}>
                {filters.length}
              </Badge>
            )}
          </Button>
          {filterOpen && (
            <div className="ss-anchor-pop">
              <FilterForm
                columns={columns}
                onAdd={(f) => {
                  onAddFilter?.(f);
                  setFilterOpen(false);
                }}
              />
            </div>
          )}
        </div>
        <div className="ss-anchor" ref={sortRef}>
          <Button icon="chevrons-ud" active={sortOpen} aria-haspopup="menu" aria-expanded={sortOpen} onClick={() => setSortOpen(!sortOpen)}>
            {t('dataToolbar.sort')}
            {sort && <Badge tone="accent">1</Badge>}
          </Button>
          {sortOpen && (
            <div className="ss-anchor-pop">
              <ContextMenu label={t('dataToolbar.sortBy')} items={sortItems(columns, sort, onSort)} onClose={() => setSortOpen(false)} />
            </div>
          )}
        </div>
        <div className="ss-anchor" ref={colsRef}>
          <Button icon="columns" active={colsOpen} aria-haspopup="dialog" aria-expanded={colsOpen} onClick={() => setColsOpen(!colsOpen)}>
            {t('dataToolbar.columns', { shown, total: columns.length })}
          </Button>
          {colsOpen && (
            <div className="ss-anchor-pop">
              <ColumnsMenu columns={columns} hidden={[...hidden]} onHidden={(names) => onHidden?.(names)} />
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="ss-dt" role="toolbar" aria-label={t('dataToolbar.label')}>
      <div className="ss-dt-start">{left}</div>
      <div className="ss-dt-end">
        <ButtonGroup label={t('dataToolbar.refreshGroup')}>
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
        </ButtonGroup>
        <ButtonGroup label={t('dataToolbar.ioGroup')}>
          <Button icon="upload" disabled={!onImport} onClick={onImport}>
            {t('action.import')}
          </Button>
          <Button icon="download" disabled={!onExport} onClick={onExport}>
            {t('action.export')}
          </Button>
        </ButtonGroup>
        <Button variant="primary" icon="plus" kbd={['⌘', '⏎']} disabled={!onAdd} onClick={onAdd}>
          {t('action.addRecord')}
        </Button>
      </div>
    </div>
  );
}
