import { useEffect, useState, type ReactNode } from 'react';
import { t } from '../core/i18n';
import { highlightSql } from '../core/highlight';
import type { Table } from '../core/model';
import { cellKind } from '../core/records/cells';
import {
  buildQuery,
  countConditions,
  defaultQuery,
  isBare,
  isGroup,
  mapAt,
  newCondition,
  QUERY_LIMITS,
  queryOps,
  queryProblems,
  removeAt,
  valueHint,
  valueProblem,
  withColumn,
  type QueryCondition,
  type QueryGroup,
  type QuerySpec,
} from '../core/records/query';
import { Button } from './Button';
import { ColumnsMenu } from './ColumnsMenu';
import { cx } from './cx';
import { Field } from './Field';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { SegmentedControl } from './SegmentedControl';
import { Select } from './Select';
import { SqlTokens } from './SqlTokens';
import { usePopover } from './usePopover';

const GROUP_OPS = [
  { value: 'AND', label: 'AND' },
  { value: 'OR', label: 'OR' },
];
const DIRS = [
  { value: 'asc', label: 'ASC' },
  { value: 'desc', label: 'DESC' },
];
const BOOLEANS = ['true', 'false'];

function QueryConditionRow({
  condition,
  table,
  error,
  onChange,
  onRemove,
}: {
  condition: QueryCondition;
  table: Table;
  /** What is wrong with the condition, shown under it. */
  error: string | null;
  onChange: (next: QueryCondition) => void;
  onRemove: () => void;
}) {
  const column = table.columns.find((x) => x.name === condition.column) ?? table.columns[0];
  const kind = cellKind(column.type);
  const set = (patch: Partial<QueryCondition>) => onChange({ ...condition, ...patch });
  const input = (field: 'value' | 'value2', label: string) => (
    <Input
      mono
      placeholder={valueHint(column)}
      aria-label={label}
      error={!!error && !!valueProblem(column, condition[field])}
      value={condition[field]}
      onChange={(e) => set({ [field]: e.target.value })}
    />
  );
  const value = isBare(condition.op) ? (
    <span className="ss-qb-bare">{t('builder.noValue')}</span>
  ) : kind === 'boolean' ? (
    <Select mono label={t('builder.value')} value={condition.value || 'true'} onChange={(v) => set({ value: v })} options={BOOLEANS} />
  ) : condition.op === 'between' ? (
    <div className="ss-qb-pair">
      {input('value', t('builder.valueFrom'))}
      <span className="ss-qb-and">{t('builder.and')}</span>
      {input('value2', t('builder.valueTo'))}
    </div>
  ) : (
    input('value', t('builder.value'))
  );
  return (
    <div className="ss-qb-cond">
      <Select
        mono
        label={t('builder.column')}
        value={column.name}
        onChange={(name) => onChange(withColumn(condition, column, table.columns.find((x) => x.name === name)!))}
        options={table.columns.map((x) => x.name)}
      />
      <Select mono label={t('builder.operator')} value={condition.op} onChange={(op) => set({ op: op as QueryCondition['op'] })} options={queryOps(column)} />
      <div className="ss-qb-value">{value}</div>
      <IconButton icon="x" size="sm" label={t('builder.removeCondition')} onClick={onRemove} />
      {error && (
        <div className="ss-field-error ss-qb-err" role="alert">
          <Icon name="alert" size={13} />
          {error}
        </div>
      )}
    </div>
  );
}

export interface FilterBuilderProps {
  tables: readonly Table[];
  /** The query: the Builder keeps nothing of its own. `defaultQuery(table)` makes an empty one. */
  value: QuerySpec;
  onChange: (spec: QuerySpec) => void;
  /** Puts each problem under its row, and the count in the side. */
  showErrors?: boolean;
  /** Under the SQL: the console's Run. */
  actions?: ReactNode;
  /** Shows Edit as SQL, which hands over the SQL the Builder writes. */
  onEditSql?: (sql: string) => void;
  /** Starts with the Columns menu open. */
  columnsOpen?: boolean;
}

/** A filter written by choosing instead of typing: the table, groups of conditions that nest, the columns, a sort and a limit, with the SQL it writes as the summary. */
export function FilterBuilder({ tables, value: spec, onChange, showErrors, actions, onEditSql, columnsOpen }: FilterBuilderProps) {
  const table = tables.find((x) => x.name === spec.table) ?? tables[0];
  const [columnsShown, setColumnsShown, columnsRef] = usePopover(!!columnsOpen);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(timer);
  }, [copied]);

  const problems = queryProblems(spec, table);
  const shown = new Map(problems.map((x) => [x.path.join('.'), x.message]));
  const sql = buildQuery(spec, table);
  const total = countConditions(spec.where);
  const change = (patch: Partial<QuerySpec>) => onChange({ ...spec, ...patch });
  const edit = (path: number[], fn: (g: QueryGroup) => QueryGroup) => change({ where: mapAt(spec.where, path, fn) });
  const copy = () => {
    try {
      navigator.clipboard.writeText(sql).then(
        () => setCopied(true),
        () => undefined,
      );
    } catch {
      // No clipboard here.
    }
  };

  const group = (g: QueryGroup, path: number[]): ReactNode => {
    const nested = path.length > 0;
    return (
      <div key={path.join('.') || 'root'} className={cx('ss-qb-group', nested && 'is-nested')} role="group" aria-label={nested ? t('builder.group') : t('builder.conditions')}>
        <div className="ss-qb-ghead">
          <SegmentedControl options={GROUP_OPS} value={g.op} onChange={(v) => edit(path, (x) => ({ ...x, op: v as 'AND' | 'OR' }))} />
          <span className="ss-qb-gtext">{g.op === 'AND' ? t('builder.allMatch') : t('builder.anyMatch')}</span>
          {nested && <span className="ss-spacer" />}
          {nested && <IconButton icon="x" size="sm" label={t('builder.removeGroup')} onClick={() => change({ where: removeAt(spec.where, path) })} />}
        </div>
        {g.items.length ? (
          g.items.map((item, i) => {
            const at = [...path, i];
            return isGroup(item) ? (
              group(item, at)
            ) : (
              <QueryConditionRow
                key={at.join('.')}
                condition={item}
                table={table}
                error={showErrors ? (shown.get(at.join('.')) ?? null) : null}
                onChange={(next) => edit(path, (x) => ({ ...x, items: x.items.map((y, k) => (k === i ? next : y)) }))}
                onRemove={() => change({ where: removeAt(spec.where, at) })}
              />
            );
          })
        ) : (
          <div className="ss-pane-none">{nested ? t('builder.emptyGroup') : t('builder.noConditions', { table: table.name })}</div>
        )}
        <div className="ss-qb-add">
          <Button variant="ghost" size="sm" icon="plus" onClick={() => edit(path, (x) => ({ ...x, items: [...x.items, newCondition(table)] }))}>
            {t('builder.addCondition')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon="layers"
            onClick={() => edit(path, (x) => ({ ...x, items: [...x.items, { op: x.op === 'AND' ? 'OR' : 'AND', items: [newCondition(table)] }] }))}
          >
            {t('builder.addGroup')}
          </Button>
        </div>
      </div>
    );
  };

  const hidden = spec.columns ? table.columns.filter((c) => !spec.columns!.includes(c.name)).map((c) => c.name) : [];
  const visible = table.columns.length - hidden.length;
  const sortOptions = [{ value: '', label: t('common.none') }, ...table.columns.map((c) => ({ value: c.name, label: c.name }))];
  const limits = [...new Set([...QUERY_LIMITS, ...(spec.limit !== null ? [spec.limit] : [])])].sort((a, b) => a - b);
  const limitOptions = [{ value: '', label: t('builder.noLimit') }, ...limits.map((n) => ({ value: String(n), label: String(n) }))];

  return (
    <div className="ss-qb">
      <div className="ss-qb-main">
        <div className="ss-qb-from">
          <span className="ss-caption">{t('builder.from')}</span>
          <div className="ss-qb-table">
            <Select
              mono
              label={t('builder.table')}
              value={table.name}
              onChange={(name) => onChange(defaultQuery(tables.find((x) => x.name === name)!))}
              options={tables.map((x) => x.name)}
            />
          </div>
          <span className="ss-spacer" />
          <Button variant="ghost" size="sm" disabled={!total} onClick={() => change({ where: { op: 'AND', items: [] } })}>
            {t('builder.clearAll')}
          </Button>
        </div>
        {group(spec.where, [])}
      </div>
      <aside className="ss-qb-side" aria-label={t('builder.output')}>
        <div className="ss-qb-fields">
          <Field label={t('builder.columns')}>
            <div className="ss-anchor ss-qb-anchor" ref={columnsRef}>
              <Button icon="columns" active={columnsShown} aria-haspopup="dialog" aria-expanded={columnsShown} onClick={() => setColumnsShown(!columnsShown)}>
                {visible === table.columns.length ? t('builder.allColumns', { count: table.columns.length }) : t('builder.someColumns', { shown: visible, count: table.columns.length })}
              </Button>
              {columnsShown && (
                <div className="ss-anchor-pop">
                  <ColumnsMenu
                    columns={table.columns}
                    hidden={hidden}
                    onHidden={(list) => {
                      const keep = table.columns.filter((c) => !list.includes(c.name)).map((c) => c.name);
                      change({ columns: keep.length === table.columns.length ? null : keep });
                    }}
                  />
                </div>
              )}
            </div>
          </Field>
          <Field label={t('builder.limit')}>
            <Select mono label={t('builder.limit')} value={spec.limit === null ? '' : String(spec.limit)} onChange={(v) => change({ limit: v === '' ? null : Number(v) })} options={limitOptions} />
          </Field>
          <Field label={t('builder.sort')} className="ss-qb-sort">
            <div className="ss-qb-sortrow">
              <Select
                mono
                label={t('builder.sortBy')}
                value={spec.sort ? spec.sort.column : ''}
                onChange={(v) => change({ sort: v ? { column: v, dir: spec.sort ? spec.sort.dir : 'asc' } : null })}
                options={sortOptions}
              />
              <SegmentedControl
                options={spec.sort ? DIRS : DIRS.map((d) => ({ ...d, disabled: true }))}
                value={spec.sort ? spec.sort.dir : 'asc'}
                onChange={(v) => spec.sort && change({ sort: { ...spec.sort, dir: v as 'asc' | 'desc' } })}
              />
            </div>
          </Field>
        </div>
        <div className="ss-qb-sqlbar">
          <span className="ss-caption">{t('builder.sql')}</span>
          <span className="ss-spacer" />
          <Button variant="ghost" size="sm" icon={copied ? 'check' : 'copy'} onClick={copy}>
            {copied ? t('builder.copied') : t('common.copy')}
          </Button>
          {onEditSql && (
            <Button variant="ghost" size="sm" icon="code" onClick={() => onEditSql(sql)}>
              {t('builder.editAsSql')}
            </Button>
          )}
        </div>
        <pre className="ss-qb-sql" aria-label={t('builder.generatedSql')}>
          <SqlTokens tokens={highlightSql(sql)} />
        </pre>
        {showErrors && problems.length > 0 && (
          <div className="ss-field-error" role="alert">
            <Icon name="alert" size={13} />
            {t('builder.complete', { conditions: t('count.conditions', { count: problems.length }) })}
          </div>
        )}
        {actions && <div className="ss-qb-actions">{actions}</div>}
      </aside>
    </div>
  );
}
