import { t } from '../core/i18n';
import type { Column, Table } from '../core/model';
import { Badge } from './Badge';
import { DataTable } from './DataTable';
import { Icon } from './Icon';

export interface TableStructureProps {
  table: Table;
}

type Numbered = Column & { n: number };

const MONO = { fontSize: 12, color: 'var(--ink-2)' } as const;

/** The columns of a table, read-only: the Structure tab of the Data mode. */
export function TableStructure({ table }: TableStructureProps) {
  const rows: Numbered[] = table.columns.map((c, i) => ({ ...c, n: i + 1 }));
  return (
    <div className="ss-pane">
      {table.comment && <div className="ss-pane-note">{table.comment}</div>}
      <div className="ss-pane-card">
        <DataTable<Numbered>
          rowKey="name"
          rows={rows}
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
              key: 'keys',
              label: t('structure.keys'),
              sortable: false,
              render: (c) => (
                <span className="ss-row" style={{ gap: 4 }}>
                  {c.pk && <Badge tone="pk">PK</Badge>}
                  {c.unique && <Badge>UQ</Badge>}
                  {c.fk && (
                    <Badge tone="fk" icon="link" title={t('structure.references', { target: `${c.fk.table}.${c.fk.column}` })}>
                      {c.fk.table}.{c.fk.column}
                    </Badge>
                  )}
                </span>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
