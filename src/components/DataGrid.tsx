import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { t } from '../core/i18n';
import type { Column } from '../core/model';
import type { RecordSort, RecordValue, Row } from '../core/records';
import { cellKind, cellText, type CellKind } from '../core/records/cells';
import { ContextMenu, type MenuItem } from './ContextMenu';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

export interface CellRef {
  /** The index of the row among the rows the grid was given. */
  row: number;
  column: string;
}

/** What the menu of a row, and its keys, ask for: ⏎ is `onOpenRow`, F2 `edit`, ⌘D `duplicate`, ⇧⌘C `copy`, ⌫ `delete`. */
export type RowAction = 'view' | 'edit' | 'duplicate' | 'copy' | 'delete';

export type RecordDensity = 'regular' | 'compact';

export interface DataGridColumn extends Column {
  width?: number;
}

export interface DataGridProps {
  columns: DataGridColumn[];
  /** The rows to show: the current page, never the whole table. */
  rows: Row[];
  /** Row indexes. */
  selected?: number[];
  onSelect?: (rows: number[]) => void;
  activeCell?: CellRef | null;
  onActiveCell?: (cell: CellRef) => void;
  modified?: CellRef[];
  /** Cells that will not be accepted (the preview of Import Records): `removed` outline and an alert glyph; `message` is the cell's title. */
  invalid?: (CellRef & { message?: string })[];
  onOpenRow?: (row: number) => void;
  /** A click on a cell opens its row (`onOpenRow`), as a double click and ⏎ do; for a grid that sits next to a panel showing the row. */
  openOnClick?: boolean;
  /** `false` leaves out the checkboxes of the gutter, which then only numbers the rows. */
  selectable?: boolean;
  onRowAction?: (action: RowAction, row: number) => void;
  /** Marks the header of the column. The grid never sorts by itself. */
  sort?: RecordSort | null;
  loading?: boolean;
  /** `true` is the default message; a node replaces it. */
  empty?: boolean | ReactNode;
  density?: RecordDensity;
  label?: string;
}

const ROW_ACTIONS: ({ action: RowAction; icon: IconName; shortcut: string; danger?: boolean } | '-')[] = [
  { action: 'view', icon: 'eye', shortcut: '⏎' },
  { action: 'edit', icon: 'pencil', shortcut: 'F2' },
  { action: 'duplicate', icon: 'copy', shortcut: '⌘D' },
  { action: 'copy', icon: 'code', shortcut: '⇧⌘C' },
  '-',
  { action: 'delete', icon: 'trash', shortcut: '⌫', danger: true },
];

/** How wide a column is by what it holds. */
const GRID_WIDTH: Record<CellKind, number> = { number: 112, boolean: 96, time: 176, text: 220 };
const SKELETON_WIDTH = [58, 82, 46, 70, 54, 76];
const SKELETON_ROWS = 12;
const GUTTER = 56;

const NO_ROWS: Row[] = [];
const NO_INDEXES: number[] = [];
const NO_CELLS: CellRef[] = [];

function sameCell(a: CellRef, row: number, column: string): boolean {
  return a.row === row && a.column === column;
}

function Cell({ value, type, kind }: { value: RecordValue; type: string; kind: CellKind }) {
  const text = cellText(value, type, kind);
  return text === null ? <span className="ss-null">NULL</span> : <>{text}</>;
}

export function DataGrid({
  columns,
  rows = NO_ROWS,
  selected = NO_INDEXES,
  onSelect,
  activeCell = null,
  onActiveCell,
  modified = NO_CELLS,
  invalid,
  onOpenRow,
  openOnClick,
  selectable: selectableProp,
  onRowAction,
  sort,
  loading,
  empty,
  density,
  label,
}: DataGridProps) {
  const kinds = columns.map((c) => cellKind(c.type));
  // A column is as wide as its kind asks, and never narrower than its header: glyphs, name, type and the sort arrow.
  const widths = columns.map((c, i) => {
    const glyphs = (c.pk ? 1 : 0) + (c.fk ? 1 : 0) + (sort?.column === c.name ? 1 : 0);
    const head = Math.ceil(c.name.length * 7.3 + c.type.length * 6.7 + 6 + glyphs * 18 + 26);
    return c.width ?? Math.max(GRID_WIDTH[kinds[i]], head);
  });
  const width = GUTTER + widths.reduce((a, b) => a + b, 0);
  const ref = useRef<HTMLDivElement>(null);
  const allOn = rows.length > 0 && selected.length === rows.length;
  const selectable = selectableProp !== false;
  const [menu, setMenu] = useState<{ row: number; x: number; y: number } | null>(null);

  // The row menu closes on a press outside it, on Esc, on scroll and when the window changes size.
  useEffect(() => {
    if (!menu) return;
    const el = ref.current;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', close);
    el?.addEventListener('scroll', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', close);
      el?.removeEventListener('scroll', close);
    };
  }, [menu]);

  // The active cell stays in view while the arrow keys move it.
  const activeRow = activeCell?.row;
  const activeColumn = activeCell?.column;
  useEffect(() => {
    const el = ref.current?.querySelector('td.is-active');
    if (el && ref.current?.contains(document.activeElement)) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeRow, activeColumn]);

  const toggle = (r: number) => {
    const next = selected.includes(r) ? selected.filter((x) => x !== r) : [...selected, r].sort((a, b) => a - b);
    onSelect?.(next);
  };
  const activate = (r: number, name: string) => onActiveCell?.({ row: r, column: name });
  const openMenu = (e: ReactMouseEvent, r: number, name?: string) => {
    if (!onRowAction) return;
    e.preventDefault();
    if (name) activate(r, name);
    setMenu({ row: r, x: Math.max(8, Math.min(e.clientX, window.innerWidth - 236)), y: Math.max(8, Math.min(e.clientY, window.innerHeight - 208)) });
  };

  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!rows.length || !columns.length || target.tagName === 'INPUT' || target.closest('.ss-grid-menu')) return;
    let r = activeCell ? activeCell.row : 0;
    let c = activeCell ? columns.findIndex((x) => x.name === activeCell.column) : 0;
    if (c < 0) c = 0;
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    const arrow = { ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1] }[e.key];
    if (arrow) {
      e.preventDefault();
      if (activeCell) {
        r = Math.max(0, Math.min(rows.length - 1, r + arrow[0]));
        c = Math.max(0, Math.min(columns.length - 1, c + arrow[1]));
      }
      activate(r, columns[c].name);
    } else if (activeCell && e.key === 'Enter') {
      e.preventDefault();
      onOpenRow?.(r);
    } else if (activeCell && e.key === ' ') {
      e.preventDefault();
      toggle(r);
    } else if (e.key === 'Escape' && selected.length) {
      e.preventDefault();
      onSelect?.([]);
    } else if (activeCell && onRowAction) {
      const action: RowAction | null =
        e.key === 'F2'
          ? 'edit'
          : mod && !e.shiftKey && k === 'd'
            ? 'duplicate'
            : mod && e.shiftKey && k === 'c'
              ? 'copy'
              : e.key === 'Backspace' || e.key === 'Delete'
                ? 'delete'
                : null;
      if (action) {
        e.preventDefault();
        onRowAction(action, r);
      }
    }
  };

  const head = (c: DataGridColumn, i: number) => {
    const sorted = !!sort && sort.column === c.name;
    return (
      <th
        key={c.name}
        scope="col"
        className={cx(kinds[i] === 'number' && 'is-num', i === 0 && 'is-first')}
        title={`${c.name} ${c.type}`}
        aria-sort={sorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      >
        <span className="ss-grid-hc">
          {c.pk && <Icon name="key" size={12} className="ss-grid-key is-pk" label={t('grid.primaryKey')} />}
          {c.fk && <Icon name="link" size={12} className="ss-grid-key is-fk" label={t('grid.foreignKey')} />}
          <span className="ss-grid-name">{c.name}</span>
          <span className="ss-grid-type">{c.type}</span>
          {sorted && (
            <Icon
              name={sort.dir === 'asc' ? 'arrow-up' : 'arrow-down'}
              size={12}
              className="ss-grid-sort"
              label={sort.dir === 'asc' ? t('grid.sortedAscending') : t('grid.sortedDescending')}
            />
          )}
        </span>
      </th>
    );
  };

  const body = () => {
    if (loading) {
      return Array.from({ length: SKELETON_ROWS }, (_, r) => (
        <tr key={r} aria-hidden>
          <td className="ss-grid-gutter" />
          {columns.map((c, i) => (
            <td key={c.name} className={cx(kinds[i] === 'number' && 'is-num', i === 0 && 'is-first')}>
              <span className="ss-grid-skel" style={{ width: `${SKELETON_WIDTH[(r + i * 2) % SKELETON_WIDTH.length]}%` }} />
            </td>
          ))}
        </tr>
      ));
    }
    return rows.map((row, r) => {
      const on = selected.includes(r);
      return (
        <tr key={r} className={cx(on && 'is-selected')} aria-selected={on} aria-rowindex={r + 2} onDoubleClick={() => onOpenRow?.(r)}>
          <td className="ss-grid-gutter" onContextMenu={(e) => openMenu(e, r)}>
            <span className="ss-grid-n">{r + 1}</span>
            {selectable && (
              <label className="ss-check">
                <input type="checkbox" checked={on} aria-label={t('grid.selectRow', { n: r + 1 })} onChange={() => toggle(r)} />
                <span className="ss-check-box">{on && <Icon name="check" size={11} strokeWidth={3} />}</span>
              </label>
            )}
          </td>
          {columns.map((c, i) => {
            const v = row[c.name] ?? null;
            const text = cellText(v, c.type, kinds[i]);
            const isActive = !!activeCell && sameCell(activeCell, r, c.name);
            const bad = invalid?.find((m) => sameCell(m, r, c.name));
            const shown = <Cell value={v} type={c.type} kind={kinds[i]} />;
            return (
              <td
                key={c.name}
                role="gridcell"
                title={bad ? `${bad.message || t('grid.invalid')}${text !== null ? ` ${text}` : ''}` : text !== null && kinds[i] === 'text' ? text : undefined}
                aria-invalid={bad ? true : undefined}
                className={cx(
                  kinds[i] === 'number' && 'is-num',
                  kinds[i] === 'time' && 'is-time',
                  kinds[i] === 'boolean' && 'is-bool',
                  i === 0 && 'is-first',
                  isActive && 'is-active',
                  modified.some((m) => sameCell(m, r, c.name)) && 'is-modified',
                  bad && 'is-invalid',
                )}
                onClick={() => {
                  activate(r, c.name);
                  if (openOnClick && onOpenRow) onOpenRow(r);
                }}
                onContextMenu={(e) => openMenu(e, r, c.name)}
              >
                {bad ? (
                  <span className="ss-grid-bad">
                    <span className="ss-grid-bad-v">{shown}</span>
                    <Icon name="alert" size={12} label={bad.message || t('grid.invalid')} />
                  </span>
                ) : (
                  shown
                )}
              </td>
            );
          })}
        </tr>
      );
    });
  };

  const grid = (
    <div
      ref={ref}
      className={cx('ss-grid', density === 'compact' && 'ss-grid--compact', !selectable && 'ss-grid--plain')}
      role="grid"
      tabIndex={0}
      aria-label={label || t('grid.label')}
      aria-busy={loading || undefined}
      aria-rowcount={rows.length + 1}
      aria-colcount={columns.length + 1}
      onKeyDown={onKey}
    >
      <table className="ss-grid-table" style={{ width }}>
        <colgroup>
          <col style={{ width: GUTTER }} />
          {columns.map((c, i) => (
            <col key={c.name} style={{ width: widths[i] }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="ss-grid-gutter" scope="col">
              {selectable && (
                <label className="ss-check">
                  <input
                    type="checkbox"
                    checked={allOn}
                    disabled={!rows.length || !!loading}
                    aria-label={t('grid.selectAll')}
                    onChange={() => onSelect?.(allOn ? [] : rows.map((_, r) => r))}
                  />
                  <span className="ss-check-box">{allOn && <Icon name="check" size={11} strokeWidth={3} />}</span>
                </label>
              )}
            </th>
            {columns.map(head)}
          </tr>
        </thead>
        <tbody>{body()}</tbody>
      </table>
      {empty && !loading && (
        <div className="ss-grid-empty">
          {empty === true ? (
            <>
              <div className="ss-grid-empty-title">{t('grid.emptyTitle')}</div>
              <div>{t('grid.emptyBody')}</div>
            </>
          ) : (
            empty
          )}
        </div>
      )}
    </div>
  );
  if (!menu || !onRowAction) return grid;

  const items: (MenuItem | '-')[] = ROW_ACTIONS.map((a) =>
    a === '-'
      ? a
      : {
          icon: a.icon,
          label: t(`grid.action.${a.action}`),
          shortcut: a.shortcut,
          danger: a.danger,
          onSelect: () => onRowAction(a.action, menu.row),
        },
  );
  return (
    <>
      {grid}
      <div className="ss-grid-menu" style={{ left: menu.x, top: menu.y }}>
        <ContextMenu label={t('grid.rowMenu', { table: label || t('grid.label'), n: menu.row + 1 })} items={items} onClose={() => setMenu(null)} />
      </div>
    </>
  );
}
