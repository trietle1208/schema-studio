import { useMemo, useState, type MouseEvent } from 'react';
import { t } from '../core/i18n';
import type { Column, Index, Table } from '../core/model';
import { Badge } from './Badge';
import { cx } from './cx';
import { DataTable } from './DataTable';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { SegmentedControl } from './SegmentedControl';

export type StructureDensity = 'regular' | 'compact';
export type StructureFilter = 'all' | 'keys' | 'nullable';

export interface TableStructureProps {
  table: Table;
  /** Open the column in the diagram inspector. */
  onOpenColumn?: (column: string) => void;
  /** Switch to the Relationships tab (e.g. from an FK badge). */
  onOpenRelationships?: () => void;
  /** Copy a column name to the clipboard. */
  onCopyColumn?: (column: string) => void;
}

type Numbered = Column & { n: number };

const MONO = { fontSize: 12, color: 'var(--ink-2)' } as const;
const DENSITIES = [
  { value: 'regular', label: () => t('structure.density.regular') },
  { value: 'compact', label: () => t('structure.density.compact') },
];
const FILTERS: { value: StructureFilter; label: () => string }[] = [
  { value: 'all', label: () => t('structure.filter.all') },
  { value: 'keys', label: () => t('structure.filter.keys') },
  { value: 'nullable', label: () => t('structure.filter.nullable') },
];

function matchesQuery(c: Column, q: string): boolean {
  if (!q) return true;
  const hay = [c.name, c.type, c.default, c.comment, c.fk ? `${c.fk.table}.${c.fk.column}` : '']
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

function matchesFilter(c: Column, filter: StructureFilter): boolean {
  if (filter === 'keys') return !!(c.pk || c.fk || c.unique);
  if (filter === 'nullable') return !!c.nullable;
  return true;
}

function indexMatches(index: Index, q: string): boolean {
  if (!q) return true;
  const hay = [index.name, index.type, index.using, ...index.columns].join(' ').toLowerCase();
  return hay.includes(q);
}

function summaryParts(table: Table): string[] {
  const cols = table.columns;
  const pk = cols.filter((c) => c.pk).length;
  const fk = cols.filter((c) => c.fk).length;
  const nullable = cols.filter((c) => c.nullable).length;
  const indexes = table.indexes?.length ?? 0;
  const parts = [t('count.columns', { count: cols.length })];
  if (pk) parts.push(t('structure.summary.pk', { count: pk }));
  if (fk) parts.push(t('structure.summary.fk', { count: fk }));
  if (nullable) parts.push(t('structure.summary.nullable', { count: nullable }));
  if (indexes) parts.push(t('count.indexes', { count: indexes }));
  return parts;
}

/** The columns (and indexes) of a table, read-only: the Structure tab of the Data mode. */
export function TableStructure({ table, onOpenColumn, onOpenRelationships, onCopyColumn }: TableStructureProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StructureFilter>('all');
  const [density, setDensity] = useState<StructureDensity>('regular');
  const [selected, setSelected] = useState<string | null>(null);
  const q = search.trim().toLowerCase();

  const rows: Numbered[] = useMemo(
    () =>
      table.columns
        .map((c, i) => ({ ...c, n: i + 1 }))
        .filter((c) => matchesFilter(c, filter) && matchesQuery(c, q)),
    [table.columns, filter, q],
  );

  const indexes = useMemo(
    () => (table.indexes ?? []).filter((i) => indexMatches(i, q)),
    [table.indexes, q],
  );

  const summary = summaryParts(table).join(' · ');
  const empty =
    table.columns.length === 0
      ? t('structure.empty')
      : rows.length === 0
        ? q
          ? t('structure.emptySearch', { query: search.trim() })
          : t('structure.emptyFilter')
        : null;

  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <div className="ss-pane">
      {table.comment && <div className="ss-pane-note">{table.comment}</div>}
      <div className="ss-pane-summary" aria-label={t('structure.summaryLabel')}>
        {summary}
      </div>
      <div className="ss-pane-bar" role="toolbar" aria-label={t('structure.toolbar')}>
        <div className="ss-dt-search">
          <Input
            icon="search"
            size="sm"
            placeholder={t('structure.search')}
            aria-label={t('structure.searchLabel')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            spellCheck={false}
          />
        </div>
        <SegmentedControl
          options={FILTERS.map((f) => ({ value: f.value, label: f.label() }))}
          value={filter}
          onChange={(v) => setFilter(v as StructureFilter)}
        />
        <div className="ss-pane-bar-end">
          <SegmentedControl
            options={DENSITIES.map((d) => ({ value: d.value, label: d.label() }))}
            value={density}
            onChange={(v) => setDensity(v as StructureDensity)}
          />
        </div>
      </div>

      <section className="ss-pane-group" aria-label={t('structure.columns')}>
        <div className="ss-row">
          <span className="ss-caption">{t('structure.columns')}</span>
          <span className="ss-tl-count">{rows.length}</span>
        </div>
        {empty ? (
          <div className="ss-pane-none">
            {empty}
            {(q || filter !== 'all') && (
              <button
                type="button"
                className="ss-pane-clear"
                onClick={() => {
                  setSearch('');
                  setFilter('all');
                }}
              >
                {t('structure.clearFilters')}
              </button>
            )}
          </div>
        ) : (
          <div className={cx('ss-pane-card', density === 'compact' && 'ss-pane-card--compact')}>
            <DataTable<Numbered>
              rowKey="name"
              rows={rows}
              selectedKey={selected ?? undefined}
              onRowClick={(c) => setSelected(c.name)}
              onRowDoubleClick={(c) => onOpenColumn?.(c.name)}
              columns={[
                { key: 'n', label: t('structure.number'), width: 56, numeric: true, align: 'right', sortable: false },
                {
                  key: 'name',
                  label: t('structure.column'),
                  sortable: false,
                  render: (c) => (
                    <span className="ss-pane-name">
                      <span className="ss-pane-key">
                        {c.pk && <Icon name="key" size={14} className="ss-grid-key is-pk" label={t('grid.primaryKey')} />}
                        {!c.pk && c.fk && <Icon name="link" size={14} className="ss-grid-key is-fk" label={t('grid.foreignKey')} />}
                      </span>
                      <span className="ss-mono" style={{ fontWeight: 500 }}>
                        {c.name}
                      </span>
                    </span>
                  ),
                },
                {
                  key: 'type',
                  label: t('structure.type'),
                  sortable: false,
                  render: (c) => (
                    <span className="ss-mono" style={MONO}>
                      {c.type}
                    </span>
                  ),
                },
                {
                  key: 'nullable',
                  label: t('structure.nullable'),
                  sortable: false,
                  render: (c) => (
                    <span className="ss-mono" style={MONO}>
                      {c.nullable ? 'NULL' : 'NOT NULL'}
                    </span>
                  ),
                },
                {
                  key: 'default',
                  label: t('structure.default'),
                  sortable: false,
                  render: (c) =>
                    c.default ? (
                      <span className="ss-mono" style={{ fontSize: 12 }}>
                        {c.default}
                      </span>
                    ) : (
                      <span className="ss-faint">—</span>
                    ),
                },
                {
                  key: 'comment',
                  label: t('structure.comment'),
                  sortable: false,
                  render: (c) =>
                    c.comment ? (
                      <span className="ss-pane-comment" title={c.comment}>
                        {c.comment}
                      </span>
                    ) : (
                      <span className="ss-faint">—</span>
                    ),
                },
                {
                  key: 'keys',
                  label: t('structure.keys'),
                  sortable: false,
                  render: (c) => (
                    <span className="ss-row" style={{ gap: 4 }} onClick={stop} onDoubleClick={stop}>
                      {c.pk && <Badge tone="pk">PK</Badge>}
                      {c.unique && <Badge>UQ</Badge>}
                      {c.fk && (
                        <button
                          type="button"
                          className="ss-pane-fk"
                          title={t('structure.references', { target: `${c.fk.table}.${c.fk.column}` })}
                          onClick={() => onOpenRelationships?.()}
                        >
                          <Badge tone="fk" icon="link">
                            {c.fk.table}.{c.fk.column}
                          </Badge>
                        </button>
                      )}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  label: '',
                  width: 72,
                  sortable: false,
                  align: 'right',
                  render: (c) => (
                    <span className="ss-table-actions" onClick={stop} onDoubleClick={stop}>
                      <IconButton
                        icon="copy"
                        size="sm"
                        label={t('structure.copyColumn')}
                        onClick={() => onCopyColumn?.(c.name)}
                      />
                      <IconButton
                        icon="layers"
                        size="sm"
                        label={t('structure.openInDiagram')}
                        onClick={() => onOpenColumn?.(c.name)}
                      />
                    </span>
                  ),
                },
              ]}
            />
          </div>
        )}
      </section>

      <section className="ss-pane-group" aria-label={t('structure.indexes')}>
        <div className="ss-row">
          <span className="ss-caption">{t('structure.indexes')}</span>
          <span className="ss-tl-count">{indexes.length}</span>
        </div>
        {indexes.length === 0 ? (
          <div className="ss-pane-none">
            {table.indexes?.length
              ? t('structure.indexesEmptyFiltered', { query: search.trim() })
              : t('structure.indexesNone', { table: table.name })}
          </div>
        ) : (
          <div className={cx('ss-pane-card', density === 'compact' && 'ss-pane-card--compact')}>
            <DataTable<Index>
              rowKey="name"
              rows={indexes}
              columns={[
                {
                  key: 'name',
                  label: t('structure.indexName'),
                  sortable: false,
                  render: (i) => (
                    <span className="ss-mono" style={{ fontWeight: 500, fontSize: 12 }}>
                      {i.name}
                    </span>
                  ),
                },
                {
                  key: 'type',
                  label: t('structure.indexType'),
                  width: 120,
                  sortable: false,
                  render: (i) => (
                    <span className="ss-mono" style={MONO}>
                      {i.type}
                    </span>
                  ),
                },
                {
                  key: 'using',
                  label: t('structure.indexUsing'),
                  width: 96,
                  sortable: false,
                  render: (i) => (
                    <span className="ss-mono" style={MONO}>
                      {i.using}
                    </span>
                  ),
                },
                {
                  key: 'columns',
                  label: t('structure.indexColumns'),
                  sortable: false,
                  render: (i) => (
                    <span className="ss-mono" style={{ fontSize: 12 }}>
                      {i.columns.join(', ')}
                    </span>
                  ),
                },
              ]}
            />
          </div>
        )}
      </section>
    </div>
  );
}
