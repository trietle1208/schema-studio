import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { t } from '../core/i18n';
import type { Table } from '../core/model';
import { rowsText } from '../core/records/cells';
import {
  buildQuery,
  defaultQuery,
  newCondition,
  queryProblems,
  wherePreview,
  type QueryCondition,
  type QueryJoin,
  type QuerySpec,
} from '../core/records/query';
import { searchTableNames } from '../core/search';
import { Button } from './Button';
import { ConditionGroup } from './filter/ConditionGroup';
import { SqlPreview } from './filter/SqlPreview';
import { isFilterGroup, toFilterGroup, toQueryGroup, type FilterGroup } from './filter/types';
import { cx } from './cx';
import { Icon } from './Icon';
import { Input } from './Input';
import { Select } from './Select';
import { ConfirmDialog } from './Modal';
import { usePopover } from './usePopover';

/** The part of a table name that matches what was typed, so the list can mark it. */
function markedName(name: string, query: string): ReactNode {
  const needle = query.trim();
  const at = needle ? name.toLowerCase().indexOf(needle.toLowerCase()) : -1;
  if (at < 0) return name;
  return (
    <>
      {name.slice(0, at)}
      <mark>{name.slice(at, at + needle.length)}</mark>
      {name.slice(at + needle.length)}
    </>
  );
}

/** The FROM table, picked from a list that can be searched by name. */
function TablePicker({ tables, value, onChange }: { tables: readonly Table[]; value: string; onChange: (name: string) => void }) {
  const [open, setOpen, ref] = usePopover(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  const shown = searchTableNames(tables, query);
  const at = shown.length === 0 ? 0 : Math.min(active, shown.length - 1);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [at, open, query]);

  const choose = (name: string) => {
    setOpen(false);
    if (name !== value) onChange(name);
  };
  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!shown.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(shown.length - 1, at + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(0, at - 1));
    } else if (e.key === 'Enter' && !(e.metaKey || e.ctrlKey) && !e.shiftKey) {
      e.preventDefault();
      const table = shown[at];
      if (table) choose(table.name);
    }
  };

  return (
    <div className="ss-fkpick" ref={ref}>
      <button
        type="button"
        className={cx('ss-fkpick-btn', open && 'is-open')}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={value}
        onClick={() => {
          if (!open) {
            setQuery('');
            const index = tables.findIndex((table) => table.name === value);
            setActive(index < 0 ? 0 : index);
          }
          setOpen(!open);
        }}
      >
        <Icon name="table" size={15} className="ss-fb-table-icon" />
        <span className="ss-fkpick-key">{value}</span>
        <Icon name="chevron-down" size={14} />
      </button>
      {open && (
        <div className="ss-pop ss-fkpick-pop ss-qb-tables">
          <div className="ss-fkpick-search">
            <Input
              icon="search"
              size="sm"
              placeholder={t('builder.searchTables')}
              aria-label={t('builder.searchTablesLabel')}
              aria-controls={listId}
              aria-activedescendant={shown[at] ? `${listId}-${at}` : undefined}
              role="combobox"
              aria-expanded={open}
              aria-autocomplete="list"
              value={query}
              autoFocus
              spellCheck={false}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
            />
          </div>
          {shown.length ? (
            <div role="listbox" id={listId} aria-label={t('builder.table')} ref={list}>
              {shown.map((table, i) => (
                <div
                  key={table.name}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={table.name === value}
                  className={cx('ss-pop-item', i === at && 'is-active')}
                  title={table.name}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(table.name);
                  }}
                >
                  <span>{markedName(table.name, query)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="ss-fkpick-none">{t('builder.noTables', { query: query.trim() })}</div>
          )}
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
  /** How many rows the table has, shown next to the column count. */
  rows?: number;
  /** Puts each problem under its row. */
  showErrors?: boolean;
  /** Kept so a host can still pass the old Run button. It sits with Reset. */
  actions?: ReactNode;
  /** View SQL hands over the SQL the Builder writes. */
  onEditSql?: (sql: string) => void;
  /** Apply filter. Disabled while a condition is unfinished. */
  onApply?: () => void;
  /** Starts with the Columns menu open. The menu is no longer in this layout. */
  columnsOpen?: boolean;
}

/** A filter written by choosing: the table, groups of conditions that nest, and the WHERE it writes. */
export function FilterBuilder(props: FilterBuilderProps) {
  return <FilterBuilderBody key={props.value.table} {...props} />;
}

function FilterBuilderBody({ tables, value: spec, onChange, rows, showErrors, actions, onEditSql, onApply }: FilterBuilderProps) {
  const table = tables.find((item) => item.name === spec.table) ?? tables[0];
  const group = toFilterGroup(spec.where);
  const [clearing, setClearing] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const baseline = useRef(spec);

  const joins = spec.joins ?? [];
  const scope = [table, ...joins.flatMap((join) => {
    const found = tables.find((item) => item.name === join.table);
    return found ? [found] : [];
  })];
  const choices = scope.flatMap((item) => item.columns.map((column) => ({ value: scope.length > 1 ? `${item.name}.${column.name}` : column.name, column })));
  const problems = queryProblems(spec, table, tables);
  const reveal = !!showErrors || attempted;
  const errors = new Map(problems.filter(() => reveal).map((item) => [item.path.join('.'), item.message]));
  // A value that is filled in and still wrong shows at once, before Apply.
  if (!reveal) {
    for (const item of problems) {
      const node = nodeAt(group, item.path);
      if (node && !isFilterGroup(node) && (node.value.trim() !== '' || node.value2.trim() !== '')) errors.set(item.path.join('.'), item.message);
    }
  }
  const blocked = problems.length > 0;
  const sql = buildQuery(spec, table, tables);
  const preview = wherePreview(spec.where, table, tables, spec.joins);
  const total = problems.length;
  const changeWhere = (next: FilterGroup) => onChange({ ...spec, where: toQueryGroup(next) });

  const apply = () => {
    if (blocked) {
      setAttempted(true);
      return;
    }
    setAttempted(false);
    onApply?.();
  };
  const addAt = (path: number[]) => {
    const next = insertCondition(group, path, table);
    changeWhere(next.group);
    setFocusKey(next.focus);
  };
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (document.querySelector('[role="dialog"]')) return;
    const meta = e.metaKey || e.ctrlKey;
    if (e.key === 'Enter' && meta && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      const raw = e.target instanceof Element ? e.target.closest('[data-filter-group]')?.getAttribute('data-filter-path') : '';
      addAt(raw ? raw.split('.').map(Number) : []);
    } else if (e.key === 'Enter' && e.shiftKey && !meta && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      apply();
    }
  };

  return (
    <div className="ss-fb" onKeyDown={onKeyDown}>
      <div className="ss-fb-head">
        <div className="ss-fb-from">
          <span className="ss-caption">{t('builder.from')}</span>
          <div className="ss-fb-table">
            <TablePicker tables={tables} value={table.name} onChange={(name) => onChange(defaultQuery(tables.find((item) => item.name === name)!))} />
          </div>
          <span className="ss-fb-meta">
            {rows != null && (
              <>
                {rowsText(rows)}
                <span className="ss-fb-dot"> · </span>
              </>
            )}
            {t('count.columns', { count: table.columns.length })}
          </span>
        </div>
        <span className="ss-spacer" />
        <Button variant="secondary" icon="code" onClick={() => onEditSql?.(sql)}>
          {t('builder.viewSql')}
        </Button>
        <Button variant="danger-ghost" icon="trash" disabled={!group.items.length} onClick={() => setClearing(true)}>
          {t('builder.clearAll')}
        </Button>
      </div>
      {tables.length > 1 && (
        <div className="ss-fb-joins">
          {joins.map((join, index) => (
            <JoinRow
              key={`${index}${join.table}`}
              join={join}
              tables={tables}
              earlier={scope.slice(0, index + 1)}
              taken={new Set([spec.table, ...joins.filter((_, i) => i !== index).map((item) => item.table)])}
              onChange={(next) => onChange({ ...spec, joins: joins.map((item, i) => (i === index ? next : item)) })}
              onRemove={() => onChange({ ...spec, joins: joins.filter((_, i) => i !== index) })}
            />
          ))}
          <Button variant="ghost" size="sm" icon="plus" disabled={scope.length >= tables.length} onClick={() => addJoin(spec, tables, onChange)}>
            {t('builder.addJoin')}
          </Button>
        </div>
      )}
      <ConditionGroup
        group={group}
        table={table}
        choices={choices}
        path={[]}
        focusKey={focusKey}
        onFocused={() => setFocusKey(null)}
        errors={errors}
        onChange={changeWhere}
        onFocus={setFocusKey}
      />
      <div className="ss-fb-foot">
        <SqlPreview sql={preview} />
        <div className="ss-fb-foot-actions">
          {actions}
          <Button variant="secondary" onClick={() => onChange(baseline.current)}>
            {t('builder.reset')}
          </Button>
          <span className="ss-fb-apply" title={blocked ? t('builder.fixErrors', { count: total }) : undefined}>
            <Button variant="primary" icon="play" kbd={['⇧', '⏎']} disabled={blocked} onClick={apply}>
              {t('builder.apply')}
            </Button>
            {blocked && (
              <span className="ss-fb-apply-hit" title={t('builder.fixErrors', { count: total })} onClick={() => setAttempted(true)} />
            )}
          </span>
        </div>
      </div>
      {clearing && (
        <ConfirmDialog
          danger
          title={t('builder.clearTitle')}
          confirmLabel={t('builder.clearConfirm')}
          onCancel={() => setClearing(false)}
          onConfirm={() => {
            setClearing(false);
            changeWhere({ logic: 'AND', items: [] });
          }}
        >
          {t('builder.clearBody')}
        </ConfirmDialog>
      )}
    </div>
  );
}

/** The equality a new join starts from: a foreign key between the tables, or the first column of each. */
function suggestJoin(joined: Table, earlier: readonly Table[]): Pick<QueryJoin, 'leftTable' | 'leftColumn' | 'rightColumn'> {
  for (const column of joined.columns) {
    const left = column.fk && earlier.find((item) => item.name === column.fk?.table && item.columns.some((c) => c.name === column.fk?.column));
    if (left && column.fk) return { leftTable: left.name, leftColumn: column.fk.column, rightColumn: column.name };
  }
  for (const left of earlier) {
    const column = left.columns.find((item) => item.fk?.table === joined.name && joined.columns.some((c) => c.name === item.fk?.column));
    if (column?.fk) return { leftTable: left.name, leftColumn: column.name, rightColumn: column.fk.column };
  }
  const left = earlier[earlier.length - 1];
  return { leftTable: left.name, leftColumn: left.columns[0]?.name ?? '', rightColumn: joined.columns[0]?.name ?? '' };
}

function addJoin(spec: QuerySpec, tables: readonly Table[], onChange: (spec: QuerySpec) => void) {
  const used = new Set([spec.table, ...(spec.joins ?? []).map((join) => join.table)]);
  const next = tables.find((item) => !used.has(item.name));
  const earlier = [spec.table, ...(spec.joins ?? []).map((join) => join.table)].flatMap((name) => {
    const found = tables.find((item) => item.name === name);
    return found ? [found] : [];
  });
  if (!next || !earlier.length) return;
  onChange({ ...spec, joins: [...(spec.joins ?? []), { type: 'INNER', table: next.name, ...suggestJoin(next, earlier) }] });
}

function JoinRow({
  join,
  tables,
  earlier,
  taken,
  onChange,
  onRemove,
}: {
  join: QueryJoin;
  tables: readonly Table[];
  earlier: readonly Table[];
  /** Tables already in the query, apart from this join, so a table is not joined twice. */
  taken: ReadonlySet<string>;
  onChange: (join: QueryJoin) => void;
  onRemove: () => void;
}) {
  const joined = tables.find((item) => item.name === join.table) ?? tables[0];
  const left = earlier.find((item) => item.name === join.leftTable) ?? earlier[0];
  const available = tables.filter((item) => item.name === join.table || !taken.has(item.name));
  const setTable = (name: string) => {
    const next = tables.find((item) => item.name === name);
    if (!next) return;
    onChange({ ...join, table: name, ...suggestJoin(next, earlier) });
  };
  return (
    <div className="ss-fb-join">
      <Select
        size="sm"
        label={t('builder.join')}
        value={join.type}
        onChange={(type) => onChange({ ...join, type: type === 'LEFT' ? 'LEFT' : 'INNER' })}
        options={[
          { value: 'INNER', label: t('builder.join.inner') },
          { value: 'LEFT', label: t('builder.join.left') },
        ]}
      />
      <div className="ss-fb-table">
        <TablePicker tables={available} value={joined.name} onChange={setTable} />
      </div>
      <span className="ss-caption">{t('builder.join.on')}</span>
      <Select
        mono
        size="sm"
        label={t('builder.join.leftTable')}
        value={left.name}
        onChange={(name) => {
          const next = earlier.find((item) => item.name === name);
          onChange({ ...join, leftTable: name, leftColumn: next?.columns[0]?.name ?? '' });
        }}
        options={earlier.map((item) => item.name)}
      />
      <Select
        mono
        size="sm"
        label={t('builder.join.leftColumn')}
        value={join.leftColumn}
        onChange={(leftColumn) => onChange({ ...join, leftColumn })}
        options={left.columns.map((column) => column.name)}
      />
      <span className="ss-fb-and">=</span>
      <Select
        mono
        size="sm"
        label={t('builder.join.rightColumn')}
        value={join.rightColumn}
        onChange={(rightColumn) => onChange({ ...join, rightColumn })}
        options={joined.columns.map((column) => column.name)}
      />
      <button type="button" className="ss-fb-x" aria-label={t('builder.join.remove')} onClick={onRemove}>
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}

function nodeAt(group: FilterGroup, path: readonly number[]): QueryCondition | FilterGroup | null {
  const [head, ...rest] = path;
  const item = group.items[head];
  if (!item) return null;
  if (!rest.length) return item;
  return isFilterGroup(item) ? nodeAt(item, rest) : null;
}

/** A new condition inside the group at `path`, and the key of the row that should take focus. */
function insertCondition(group: FilterGroup, path: number[], table: Table): { group: FilterGroup; focus: string } {
  if (!path.length) {
    const focus = String(group.items.length);
    return { group: { ...group, items: [...group.items, newCondition(table)] }, focus };
  }
  const [head, ...rest] = path;
  let focus = '';
  const items = group.items.map((item, index) => {
    if (index !== head || !isFilterGroup(item)) return item;
    const next = insertCondition(item, rest, table);
    focus = `${head}.${next.focus}`;
    return next.group;
  });
  return { group: { ...group, items }, focus };
}
