import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { t } from '../../core/i18n';
import type { Column, Table } from '../../core/model';
import { cellKind } from '../../core/records/cells';
import { isBare, queryOps, valueHint, valueProblem, withColumn, type QueryCondition, type QueryOp } from '../../core/records/query';
import { cx } from '../cx';
import { Icon } from '../Icon';
import { Input } from '../Input';
import { Select } from '../Select';

function kindMark(column: Column): string {
  const kind = cellKind(column.type);
  if (kind === 'number') return '#';
  if (kind === 'time') return 'dt';
  return 'Aa';
}

function typeLabel(column: Column, op: QueryOp): string {
  return op === 'within' ? t('builder.days') : column.type.toUpperCase();
}

export interface ColumnChoice {
  /** What the condition stores: a bare name, or `table.column` when several tables are in the query. */
  value: string;
  column: Column;
}

export interface ConditionRowProps {
  condition: QueryCondition;
  table: Table;
  /** The columns that can be chosen. Left out, the columns of `table` are, by their own names. */
  choices?: readonly ColumnChoice[];
  /** Shown under the value when the row should admit what is wrong. */
  error: string | null;
  pathKey: string;
  focusKey: string | null;
  onFocused: () => void;
  onChange: (next: QueryCondition) => void;
  onRemove: () => void;
}

/** The choice a stored column name shows as, preferring the FROM table when the name is bare. */
function shownChoice(stored: string, choices: readonly ColumnChoice[], primary: string): string {
  if (choices.some((choice) => choice.value === stored)) return stored;
  const qualified = `${primary}.${stored}`;
  if (choices.some((choice) => choice.value === qualified)) return qualified;
  const bare = choices.filter((choice) => choice.value.endsWith(`.${stored}`));
  return bare.length === 1 ? bare[0].value : (choices[0]?.value ?? stored);
}

/** One condition: column, operator, value, and remove. Backspace on an empty focused row removes it. */
export function ConditionRow({ condition, table, choices, error, pathKey, focusKey, onFocused, onChange, onRemove }: ConditionRowProps) {
  const valueBox = useRef<HTMLDivElement>(null);
  const columns = choices ?? table.columns.map((column) => ({ value: column.name, column }));
  const selected = shownChoice(condition.column, columns, table.name);
  const column = columns.find((choice) => choice.value === selected)?.column ?? table.columns[0];
  const kind = cellKind(column.type);
  const ops = queryOps(column);
  const options = ops.some((op) => op.value === condition.op) ? ops : [...ops, { value: condition.op, label: condition.op }];
  const set = (patch: Partial<QueryCondition>) => onChange({ ...condition, ...patch });
  const suffix = <span className="ss-fb-type">{typeLabel(column, condition.op)}</span>;
  const invalid = (field: 'value' | 'value2') => {
    if (!error) return false;
    if (condition.op === 'within' || condition.op === 'in') return field === 'value';
    return !!valueProblem(column, condition[field]);
  };

  useEffect(() => {
    if (focusKey !== pathKey) return;
    valueBox.current?.querySelector<HTMLElement>('input, select')?.focus();
    onFocused();
  }, [focusKey, pathKey, onFocused]);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Backspace' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target instanceof HTMLInputElement && e.target.value !== '') return;
    if (condition.value !== '' || condition.value2 !== '') return;
    e.preventDefault();
    onRemove();
  };

  const input = (field: 'value' | 'value2', label: string, withType: boolean) => (
    <Input
      mono
      placeholder={condition.op === 'within' ? t('query.hint.number') : valueHint(column)}
      aria-label={label}
      spellCheck={false}
      error={invalid(field)}
      value={condition[field]}
      suffix={withType ? suffix : undefined}
      onChange={(e) => set({ [field]: e.target.value })}
    />
  );

  let value = input('value', t('builder.value'), true);
  if (isBare(condition.op)) {
    value = (
      <div className="ss-fb-bare">
        <span>{t('builder.noValue')}</span>
        {suffix}
      </div>
    );
  } else if (kind === 'boolean' && condition.op === 'eq') {
    value = (
      <div className="ss-fb-bool">
        <Select mono label={t('builder.value')} value={condition.value || 'true'} onChange={(v) => set({ value: v })} options={['true', 'false']} />
        {suffix}
      </div>
    );
  } else if (condition.op === 'between') {
    value = (
      <div className="ss-fb-pair">
        {input('value', t('builder.valueFrom'), false)}
        <span className="ss-fb-and">{t('builder.and')}</span>
        {input('value2', t('builder.valueTo'), false)}
        {suffix}
      </div>
    );
  }

  return (
    <div className="ss-fb-cond" onKeyDown={onKeyDown}>
      <div className="ss-fb-col">
        <span className={cx('ss-fb-kind', column.pk && 'is-pk')}>{kindMark(column)}</span>
        <Select
          mono
          label={t('builder.column')}
          value={selected}
          onChange={(name) => {
            const next = columns.find((choice) => choice.value === name);
            if (!next) return;
            onChange({ ...withColumn(condition, column, next.column), column: name });
          }}
          options={columns.map((choice) => choice.value)}
        />
      </div>
      <Select mono label={t('builder.operator')} value={condition.op} onChange={(op) => set({ op: op as QueryOp })} options={options} />
      <div className="ss-fb-val" ref={valueBox}>
        {value}
        {error && (
          <div className="ss-field-error" role="alert">
            <Icon name="alert" size={13} />
            {error}
          </div>
        )}
      </div>
      <button type="button" className="ss-fb-x" aria-label={t('builder.removeCondition')} onClick={onRemove}>
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
