import type { CSSProperties, MouseEvent, MouseEventHandler, PointerEventHandler } from 'react';
import type { Column, Table } from '../core/model';
import { cx } from './cx';
import { Icon } from './Icon';

export interface TableNodeProps {
  table: Table;
  x?: number;
  y?: number;
  static?: boolean;
  selected?: boolean;
  selectedColumn?: number | null;
  onSelect?: (name: string) => void;
  onSelectColumn?: (index: number) => void;
  dimmed?: boolean;
  dragging?: boolean;
  dirty?: boolean;
  invalidColumns?: number[] | null;
  state?: 'added' | 'removed';
  style?: CSSProperties;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
  onPointerMove?: PointerEventHandler<HTMLDivElement>;
  onPointerUp?: PointerEventHandler<HTMLDivElement>;
  onContextMenu?: MouseEventHandler<HTMLDivElement>;
}

interface NodeRowProps {
  column: Column;
  selected?: boolean;
  invalid?: boolean;
  onClick: (e: MouseEvent) => void;
}

function NodeRow({ column: c, selected, invalid, onClick }: NodeRowProps) {
  const empty = !c.name;
  return (
    <div
      className={cx('ss-node-row', selected && 'is-selected', c.draft && 'is-draft', invalid && 'is-invalid')}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      title={c.comment || undefined}
    >
      {c.pk ? (
        <Icon name="key" size={13} className="ss-node-key" label="Primary key" />
      ) : c.fk ? (
        <Icon name="link" size={13} className="ss-node-fk" label={`Foreign key → ${c.fk.table}.${c.fk.column}`} />
      ) : (
        <span />
      )}
      <span className={cx('ss-node-col', empty && 'is-empty')}>{empty ? 'unnamed' : c.name}</span>
      <span className="ss-node-type">
        {c.type || '—'}
        {c.nullable && (
          <span className="ss-node-null" title="Nullable">
            ?
          </span>
        )}
      </span>
      <span className="ss-node-flag" title={c.unique ? 'Unique' : undefined}>
        {c.unique ? 'UQ' : ''}
      </span>
    </div>
  );
}

export function TableNode({
  table: t,
  x,
  y,
  static: isStatic,
  selected,
  selectedColumn,
  onSelect,
  onSelectColumn,
  dimmed,
  dragging,
  dirty,
  invalidColumns,
  state,
  style,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onContextMenu,
}: TableNodeProps) {
  return (
    <div
      className={cx(
        'ss-node',
        isStatic && 'ss-node--static',
        selected && 'is-selected',
        dimmed && 'is-dimmed',
        dragging && 'is-dragging',
        state === 'added' && 'is-added',
        state === 'removed' && 'is-removed',
      )}
      style={{ ...(isStatic ? {} : { left: x || 0, top: y || 0 }), ...style }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={onContextMenu}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(t.name);
      }}
      data-table={t.name}
      role="group"
      aria-label={`Table ${t.name}`}
    >
      <div className="ss-node-head" data-drag="1">
        <Icon name="table" size={14} />
        <span className="ss-node-name">
          {t.schema && t.schema !== 'public' ? <span className="ss-node-schema">{`${t.schema}.`}</span> : null}
          {t.name || 'unnamed'}
        </span>
        {dirty && <span className="ss-dirty-dot" title="Unsaved changes" />}
        <span className="ss-node-count">{t.columns.length}</span>
      </div>
      <div className="ss-node-body">
        {t.columns.map((c, i) => (
          <NodeRow
            key={i}
            column={c}
            selected={selected && selectedColumn === i}
            invalid={!!invalidColumns && invalidColumns.includes(i)}
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(t.name);
              onSelectColumn?.(i);
            }}
          />
        ))}
      </div>
    </div>
  );
}
