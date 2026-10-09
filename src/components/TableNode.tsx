import type { CSSProperties, MouseEvent, MouseEventHandler, PointerEvent, PointerEventHandler } from 'react';
import { t } from '../core/i18n';
import type { Column, Table, TableGroup } from '../core/model';
import { cx } from './cx';
import { Icon } from './Icon';

export interface TableNodeProps {
  table: Table;
  x?: number;
  y?: number;
  /** How wide the table is, when it was made wider or narrower than tables are by themselves. */
  width?: number;
  static?: boolean;
  selected?: boolean;
  selectedColumn?: number | null;
  /** A click on the table or on one of its rows. The event tells a click with Shift held from a plain one. */
  onSelect?: (name: string, e: MouseEvent) => void;
  onSelectColumn?: (index: number, e: MouseEvent) => void;
  dimmed?: boolean;
  dragging?: boolean;
  /** A side of the table is being dragged. */
  resizing?: boolean;
  dirty?: boolean;
  invalidColumns?: number[] | null;
  /** The row a foreign key that is being drawn starts from or would end on (see ERCanvas). */
  linkColumn?: number | null;
  /** The foreign key cannot end on `linkColumn`. */
  linkRefused?: boolean;
  state?: 'added' | 'removed';
  /** The group the table is in: its head has the colour, and says the label when it is pointed at. */
  group?: Pick<TableGroup, 'name' | 'color'>;
  style?: CSSProperties;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
  /** A press on the row of a column, which does not reach `onPointerDown`: a table is dragged by its head. */
  onColumnPointerDown?: (index: number, e: PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: PointerEventHandler<HTMLDivElement>;
  onPointerUp?: PointerEventHandler<HTMLDivElement>;
  onContextMenu?: MouseEventHandler<HTMLDivElement>;
  /**
   * A press on the handle at a side of the table (1 right, -1 left), which does not reach
   * `onPointerDown`: the side is dragged to make the table wider or narrower. Without it the
   * table has no handles.
   */
  onResizeDown?: (side: 1 | -1, e: PointerEvent<HTMLDivElement>) => void;
  /** A double click on a handle: the table is to be as wide as its text. */
  onResizeFit?: () => void;
}

const SIDES = [-1, 1] as const;

interface NodeRowProps {
  column: Column;
  index: number;
  selected?: boolean;
  invalid?: boolean;
  linked?: boolean;
  refused?: boolean;
  onClick: (e: MouseEvent) => void;
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
}

function NodeRow({ column: c, index, selected, invalid, linked, refused, onClick, onPointerDown }: NodeRowProps) {
  const empty = !c.name;
  return (
    <div
      className={cx(
        'ss-node-row',
        selected && 'is-selected',
        c.draft && 'is-draft',
        invalid && 'is-invalid',
        linked && (refused ? 'is-link-refused' : 'is-link-end'),
      )}
      onClick={onClick}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown?.(e);
      }}
      title={c.comment || undefined}
      data-column={index}
    >
      {c.pk ? (
        <Icon name="key" size={13} className="ss-node-key" label={t('flag.primaryKey')} />
      ) : c.fk ? (
        <Icon
          name="link"
          size={13}
          className={cx('ss-node-fk', c.fk.inferred && 'is-inferred')}
          label={t(c.fk.inferred ? 'node.inferredForeignKey' : 'node.foreignKey', { target: `${c.fk.table}.${c.fk.column}` })}
        />
      ) : (
        <span />
      )}
      <span className={cx('ss-node-col', empty && 'is-empty')}>{empty ? t('common.unnamed') : c.name}</span>
      <span className="ss-node-type">
        {c.type || '—'}
        {c.nullable && (
          <span className="ss-node-null" title={t('flag.nullable')}>
            ?
          </span>
        )}
      </span>
      <span className="ss-node-flag" title={c.unique ? t('flag.unique') : undefined}>
        {c.unique ? 'UQ' : ''}
      </span>
    </div>
  );
}

export function TableNode({
  table,
  x,
  y,
  width,
  static: isStatic,
  selected,
  selectedColumn,
  onSelect,
  onSelectColumn,
  dimmed,
  dragging,
  resizing,
  dirty,
  invalidColumns,
  linkColumn,
  linkRefused,
  state,
  group,
  style,
  onPointerDown,
  onColumnPointerDown,
  onPointerMove,
  onPointerUp,
  onContextMenu,
  onResizeDown,
  onResizeFit,
}: TableNodeProps) {
  return (
    <div
      className={cx(
        'ss-node',
        isStatic && 'ss-node--static',
        selected && 'is-selected',
        dimmed && 'is-dimmed',
        dragging && 'is-dragging',
        resizing && 'is-resizing',
        state === 'added' && 'is-added',
        state === 'removed' && 'is-removed',
        group && `has-group ss-group--${group.color}`,
      )}
      style={{ ...(isStatic ? {} : { left: x || 0, top: y || 0 }), ...(width === undefined ? {} : { width }), ...style }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={onContextMenu}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(table.name, e);
      }}
      data-table={table.name}
      role="group"
      aria-label={t('node.label', { name: table.name })}
    >
      <div className="ss-node-head" data-drag="1" title={group ? t('group.title', { name: group.name }) : undefined}>
        <Icon name="table" size={14} />
        <span className="ss-node-name">
          {table.schema && table.schema !== 'public' ? <span className="ss-node-schema">{`${table.schema}.`}</span> : null}
          {table.name || t('common.unnamed')}
        </span>
        {dirty && <span className="ss-dirty-dot" title={t('save.dirty')} />}
        <span className="ss-node-count">{table.columns.length}</span>
      </div>
      <div className="ss-node-body">
        {table.columns.map((c, i) => (
          <NodeRow
            key={i}
            column={c}
            index={i}
            selected={selected && selectedColumn === i}
            invalid={!!invalidColumns && invalidColumns.includes(i)}
            linked={linkColumn === i}
            refused={linkRefused}
            onPointerDown={onColumnPointerDown && ((e) => onColumnPointerDown(i, e))}
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(table.name, e);
              onSelectColumn?.(i, e);
            }}
          />
        ))}
      </div>
      {onResizeDown &&
        SIDES.map((side) => (
          <div
            key={side}
            className={cx('ss-node-resize', side === 1 ? 'ss-node-resize--right' : 'ss-node-resize--left')}
            title={t('node.resize')}
            onPointerDown={(e) => {
              e.stopPropagation();
              onResizeDown(side, e);
            }}
            // A click on a handle is none on the table.
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onResizeFit?.();
            }}
          />
        ))}
    </div>
  );
}
