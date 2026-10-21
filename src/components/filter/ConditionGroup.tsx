import { t } from '../../core/i18n';
import type { Table } from '../../core/model';
import { newCondition, type QueryCondition } from '../../core/records/query';
import type { ColumnChoice } from './ConditionRow';
import { Icon } from '../Icon';
import { Kbd } from '../Kbd';
import { ConnectorRail } from './ConnectorRail';
import { ConditionRow } from './ConditionRow';
import { LogicToggle } from './LogicToggle';
import { countFilter, isFilterGroup, type FilterGroup } from './types';

export interface ConditionGroupProps {
  group: FilterGroup;
  table: Table;
  /** Columns from every table in the query. Left out, a condition chooses from `table`. */
  choices?: readonly ColumnChoice[];
  path: number[];
  nested?: boolean;
  /** Path of the row whose value should take focus, joined by `.`. */
  focusKey: string | null;
  onFocused: () => void;
  /** Problems that should show, keyed by the condition path. */
  errors: ReadonlyMap<string, string>;
  onChange: (group: FilterGroup) => void;
  onFocus: (pathKey: string) => void;
  onRemove?: () => void;
}

/** A group of conditions, and the groups nested inside it. */
export function ConditionGroup({ group, table, choices, path, nested, focusKey, onFocused, errors, onChange, onFocus, onRemove }: ConditionGroupProps) {
  const edit = (index: number, next: QueryCondition | FilterGroup) =>
    onChange({ ...group, items: group.items.map((item, i) => (i === index ? next : item)) });
  const addCondition = () => {
    const index = group.items.length;
    onChange({ ...group, items: [...group.items, newCondition(table)] });
    onFocus([...path, index].join('.'));
  };
  const addGroup = () => {
    const index = group.items.length;
    const child: FilterGroup = { logic: group.logic === 'AND' ? 'OR' : 'AND', items: [newCondition(table)] };
    onChange({ ...group, items: [...group.items, child] });
    onFocus([...path, index, 0].join('.'));
  };
  const pathKey = path.join('.');

  return (
    <div className={nested ? 'ss-fb-group is-nested' : 'ss-fb-group'} role="group" aria-label={nested ? t('builder.group') : t('builder.conditions')} data-filter-group data-filter-path={pathKey}>
      <div className="ss-fb-ghead">
        <LogicToggle value={group.logic} label={t('builder.group')} onChange={(logic) => onChange({ ...group, logic })} />
        <span className="ss-fb-gtext">{group.logic === 'AND' ? t('builder.allMatch') : t('builder.anyMatch')}</span>
        <span className="ss-spacer" />
        {nested ? (
          <>
            <button type="button" className="ss-fb-ghost" onClick={addCondition}>
              <Icon name="plus" size={14} />
              {t('builder.addOne')}
            </button>
            <button type="button" className="ss-fb-trash" aria-label={t('builder.removeGroup')} onClick={onRemove}>
              <Icon name="trash" size={15} />
            </button>
          </>
        ) : (
          <span className="ss-fb-count">{t('count.conditions', { count: countFilter(group) })}</span>
        )}
      </div>
      <div className="ss-fb-body">
        {group.items.length ? (
          <div className="ss-fb-lines">
            {group.items.map((item, index) => {
              const at = [...path, index];
              const key = at.join('.');
              return (
                <div className="ss-fb-line" key={key}>
                  <ConnectorRail
                    label={index === 0 ? 'WHERE' : group.logic}
                    logic={group.logic}
                    first={index === 0}
                    last={index === group.items.length - 1}
                    center={isFilterGroup(item)}
                  />
                  <div className="ss-fb-line-main">
                    {isFilterGroup(item) ? (
                      <ConditionGroup
                        group={item}
                        table={table}
                        choices={choices}
                        path={at}
                        nested
                        focusKey={focusKey}
                        onFocused={onFocused}
                        errors={errors}
                        onChange={(next) => edit(index, next)}
                        onFocus={onFocus}
                        onRemove={() => onChange({ ...group, items: group.items.filter((_, i) => i !== index) })}
                      />
                    ) : (
                      <ConditionRow
                        condition={item}
                        table={table}
                        choices={choices}
                        error={errors.get(key) ?? null}
                        pathKey={key}
                        focusKey={focusKey}
                        onFocused={onFocused}
                        onChange={(next) => edit(index, next)}
                        onRemove={() => onChange({ ...group, items: group.items.filter((_, i) => i !== index) })}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="ss-pane-none">{nested ? t('builder.emptyGroup') : t('builder.noConditions', { table: table.name })}</div>
        )}
        {!nested && (
          <div className="ss-fb-add">
            <button type="button" className="ss-fb-addbtn is-cond" onClick={addCondition}>
              <Icon name="plus" size={14} />
              {t('builder.addCondition')}
              <Kbd keys={['⌘', '⏎']} />
            </button>
            <button type="button" className="ss-fb-addbtn is-group" onClick={addGroup}>
              <Icon name="layers" size={14} />
              {t('builder.addGroup')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
