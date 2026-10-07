import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

export interface DataTableColumn<T, K extends string = string> {
  /** Names the column in `sort`. Without `render`, it is also the field of the row the cell shows. */
  key: K;
  label: ReactNode;
  width?: number;
  align?: 'left' | 'right' | 'center';
  /** Right-aligned mono digits. */
  numeric?: boolean;
  /** False keeps the header from sorting. */
  sortable?: boolean;
  render?: (row: T) => ReactNode;
}

export interface DataTableSort<K extends string = string> {
  key: K;
  dir: 'asc' | 'desc';
}

export interface DataTableProps<T, K extends string = string> {
  columns: DataTableColumn<T, K>[];
  rows: T[];
  /** The field that identifies a row. Without it rows are identified by their index. */
  rowKey?: keyof T;
  sort?: DataTableSort<K>;
  /** A click on a sortable header: the column ascending, or descending when it already is ascending. */
  onSort?: (sort: DataTableSort<K>) => void;
  selectedKey?: unknown;
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
}

export function DataTable<T, K extends string = string>({
  columns,
  rows,
  rowKey,
  sort,
  onSort,
  selectedKey,
  onRowClick,
  onRowDoubleClick,
}: DataTableProps<T, K>) {
  return (
    <table className="ss-table">
      <thead>
        <tr>
          {columns.map((c) => {
            const sorted = sort?.key === c.key;
            const sortable = c.sortable !== false;
            return (
              <th
                key={c.key}
                style={{ width: c.width, textAlign: c.align }}
                className={cx(sortable && 'is-sortable', sorted && 'is-sorted')}
                aria-sort={sorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                onClick={
                  sortable && onSort
                    ? () => onSort({ key: c.key, dir: sorted && sort.dir === 'asc' ? 'desc' : 'asc' })
                    : undefined
                }
              >
                <span className="ss-th">
                  {c.label}
                  {sorted && <Icon name={sort.dir === 'asc' ? 'arrow-up' : 'arrow-down'} size={12} />}
                </span>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const k = rowKey ? r[rowKey] : i;
          return (
            <tr
              key={String(k)}
              className={cx(selectedKey === k && 'is-selected')}
              onClick={() => onRowClick?.(r)}
              onDoubleClick={() => onRowDoubleClick?.(r)}
            >
              {columns.map((c) => (
                <td key={c.key} className={c.numeric ? 'is-num' : undefined} style={{ textAlign: c.align }}>
                  {c.render ? c.render(r) : (r[c.key as string as keyof T] as ReactNode)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
