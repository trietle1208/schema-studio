import { isGroup, type QueryCondition, type QueryGroup } from '../../core/records/query';

/** A group of conditions. `logic` is whether all of them match, or any of them. */
export interface FilterGroup {
  logic: 'AND' | 'OR';
  items: (QueryCondition | FilterGroup)[];
}

export function isFilterGroup(item: QueryCondition | FilterGroup): item is FilterGroup {
  return 'logic' in item;
}

export function toFilterGroup(group: QueryGroup): FilterGroup {
  return { logic: group.op, items: group.items.map((item) => (isGroup(item) ? toFilterGroup(item) : item)) };
}

export function toQueryGroup(group: FilterGroup): QueryGroup {
  return { op: group.logic, items: group.items.map((item) => (isFilterGroup(item) ? toQueryGroup(item) : item)) };
}

/** How many conditions a group holds, including the ones inside a nested group. */
export function countFilter(group: FilterGroup): number {
  return group.items.reduce((n, item) => n + (isFilterGroup(item) ? countFilter(item) : 1), 0);
}
