import { t } from '../core/i18n';
import type { Table } from '../core/model';
import { incomingRelations, outgoingRelations, qualifiedName, type Relation } from '../core/relations';
import { Button } from './Button';
import { DataTable } from './DataTable';

export interface TableRelationshipsProps {
  table: Table;
  /** Every table of the schema, to find the foreign keys that point at `table`. */
  tables: readonly Table[];
  /** "Open in Data" on a row: the table at the other end of the foreign key. */
  onOpen?: (table: string) => void;
}

interface Row {
  key: string;
  /** The table at the other end. */
  table: string;
  relation: Relation;
}

const MONO = { fontSize: 12 } as const;

/** The foreign keys that leave a table and the ones that point at it: the Relationships tab of the Data mode. */
export function TableRelationships({ table, tables, onOpen }: TableRelationshipsProps) {
  const out: Row[] = outgoingRelations(table).map((r) => ({ key: `out:${r.from.column}`, table: r.to.table, relation: r }));
  const inn: Row[] = incomingRelations(table, tables).map((r) => ({ key: `in:${qualifiedName(r.from)}`, table: r.from.table, relation: r }));

  const group = (title: string, list: Row[], none: string) => (
    <section className="ss-pane-group" aria-label={title}>
      <div className="ss-row">
        <span className="ss-caption">{title}</span>
        <span className="ss-tl-count">{list.length}</span>
      </div>
      {list.length ? (
        <div className="ss-pane-card">
          <DataTable<Row>
            rowKey="key"
            rows={list}
            columns={[
              {
                key: 'from',
                label: t('relationships.relationship'),
                sortable: false,
                render: ({ relation }) => (
                  <span className="ss-mono" style={MONO} title={relation.inferred ? t('column.inferredNote') : undefined}>
                    {qualifiedName(relation.from)}
                    <span className="ss-faint"> → </span>
                    {qualifiedName(relation.to)}
                  </span>
                ),
              },
              {
                key: 'onDelete',
                label: t('relationships.onDelete'),
                width: 160,
                sortable: false,
                render: ({ relation }) => (
                  <span className="ss-mono" style={{ ...MONO, color: 'var(--ink-2)' }}>
                    {relation.onDelete}
                  </span>
                ),
              },
              {
                key: 'open',
                label: '',
                width: 148,
                sortable: false,
                align: 'right',
                render: (r) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    iconRight="arrow-right"
                    aria-label={t('relationships.openInDataLabel', { table: r.table })}
                    onClick={() => onOpen?.(r.table)}
                  >
                    {t('relationships.openInData')}
                  </Button>
                ),
              },
            ]}
          />
        </div>
      ) : (
        <div className="ss-pane-none">{none}</div>
      )}
    </section>
  );

  return (
    <div className="ss-pane">
      {group(t('relationships.references'), out, t('relationships.noneOut', { table: table.name }))}
      {group(t('relationships.referencedBy'), inn, t('relationships.noneIn', { table: table.name }))}
    </div>
  );
}
