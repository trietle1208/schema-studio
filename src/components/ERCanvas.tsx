import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent, PointerEvent, ReactNode } from 'react';
import {
  clampZoom,
  computeEdges,
  edgePath,
  minimapLayout,
  snap,
  viewRect,
  zoomAt,
  type Edge,
  type Size,
} from '../core/layout';
import type { Position, Positions, Table } from '../core/model';
import { positionOf } from '../core/positions';
import { ContextMenu, type MenuItem } from './ContextMenu';
import { cx } from './cx';
import { Icon } from './Icon';
import { TableNode } from './TableNode';

const MINIMAP_SIZE: Size = { w: 168, h: 108 };
const DRAG_THRESHOLD = 3;
const WHEEL_ZOOM_SPEED = 0.0015;

export interface CanvasMenu {
  table: string;
  x: number;
  y: number;
}

export interface ERCanvasProps {
  tables: Table[];
  positions: Positions;
  onMove?: (name: string, position: Position) => void;
  onMoveEnd?: (name: string) => void;
  selected?: string | null;
  onSelect?: (name: string | null) => void;
  selectedColumn?: number | null;
  onSelectColumn?: (index: number | null) => void;
  zoom?: number;
  /** Called when the user zooms with ⌘/Ctrl + wheel. Without it the wheel only pans. */
  onZoom?: (zoom: number) => void;
  offset?: Position;
  fitSignal?: number;
  dimUnrelated?: boolean;
  dirtyTables?: string[];
  invalidColumns?: number[];
  menuItems?: (table: string, close: () => void) => (MenuItem | '-')[];
  onDuplicateTable?: (name: string) => void;
  onDeleteTable?: (name: string) => void;
  initialMenu?: CanvasMenu;
  hint?: ReactNode;
  showLegend?: boolean;
  showMinimap?: boolean;
  style?: CSSProperties;
}

interface DragState {
  /** The table being dragged, or null while panning the canvas. */
  table: string | null;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
  moved: boolean;
}

// One bar at the referenced (one) end, a crow's foot at the foreign-key (many) end.
function EdgeEnds({ a, b }: Edge) {
  const oneX = a.x + a.side * 8;
  const foot = b.x + b.side * 9;
  return (
    <>
      <path className="ss-edge-end" d={`M${oneX} ${a.y - 5} V${a.y + 5}`} />
      <path
        className="ss-edge-end"
        d={`M${foot} ${b.y} L${b.x} ${b.y - 5} M${foot} ${b.y} L${b.x} ${b.y + 5} M${foot} ${b.y} L${b.x} ${b.y}`}
      />
    </>
  );
}

interface MinimapProps {
  tables: Table[];
  positions: Positions;
  selected?: string | null;
  zoom: number;
  offset: Position;
  view: Size;
}

function Minimap({ tables, positions, selected, zoom, offset, view }: MinimapProps) {
  const layout = minimapLayout(tables, positions, viewRect(offset, zoom, view), MINIMAP_SIZE);
  if (!layout) return null;
  const vp = layout.viewport;
  return (
    <div className="ss-minimap" aria-label="Minimap">
      <svg width={MINIMAP_SIZE.w} height={MINIMAP_SIZE.h}>
        {layout.nodes.map((n) => (
          <rect key={n.name} className={cx('n', selected === n.name && 'is-sel')} x={n.x} y={n.y} width={n.w} height={n.h} rx={1.5} />
        ))}
        <rect className="vp" x={vp.x} y={vp.y} width={vp.w} height={vp.h} rx={2} />
      </svg>
    </div>
  );
}

export function ERCanvas({
  tables,
  positions,
  onMove,
  onMoveEnd,
  selected: sel,
  onSelect,
  selectedColumn,
  onSelectColumn,
  zoom = 1,
  onZoom,
  offset: initialOffset,
  fitSignal,
  dimUnrelated,
  dirtyTables,
  invalidColumns,
  menuItems,
  onDuplicateTable,
  onDeleteTable,
  initialMenu,
  hint,
  showLegend,
  showMinimap,
  style,
}: ERCanvasProps) {
  const [offset, setOffset] = useState<Position>(initialOffset ?? { x: 0, y: 0 });
  const [draggingTable, setDraggingTable] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const [menu, setMenu] = useState<CanvasMenu | null>(initialMenu ?? null);
  const [size, setSize] = useState<Size>({ w: 840, h: 800 });
  const [seenFit, setSeenFit] = useState(fitSignal);
  const drag = useRef<DragState | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  if (fitSignal !== seenFit) {
    setSeenFit(fitSignal);
    setOffset({ x: 0, y: 0 });
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // React registers wheel listeners as passive, so the browser's own ⌘/Ctrl + wheel zoom can only be cancelled here.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        if (!onZoom) return;
        const next = clampZoom(zoom * Math.exp(-e.deltaY * WHEEL_ZOOM_SPEED));
        if (next === zoom) return;
        const r = el.getBoundingClientRect();
        setOffset(zoomAt(offset, zoom, next, { x: e.clientX - r.left, y: e.clientY - r.top }));
        onZoom(next);
      } else {
        setOffset((o) => ({ x: o.x - e.deltaX, y: o.y - e.deltaY }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoom, offset, onZoom]);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  function onNodeDown(name: string, e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    setMenu(null);
    if (!(e.target as Element).closest('[data-drag]')) return;
    const q = positionOf(positions, name);
    if (!q) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(name);
    drag.current = { table: name, sx: e.clientX, sy: e.clientY, ox: q.x, oy: q.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onNodeMove(e: PointerEvent) {
    const d = drag.current;
    if (!d || d.table === null) return;
    const dx = (e.clientX - d.sx) / zoom;
    const dy = (e.clientY - d.sy) / zoom;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
    if (!d.moved) {
      d.moved = true;
      setDraggingTable(d.table);
    }
    onMove?.(d.table, { x: snap(d.ox + dx), y: snap(d.oy + dy) });
  }

  function onNodeUp() {
    const d = drag.current;
    if (d && d.table !== null && d.moved) onMoveEnd?.(d.table);
    drag.current = null;
    setDraggingTable(null);
  }

  function onBgDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    setMenu(null);
    drag.current = { table: null, sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onBgMove(e: PointerEvent) {
    const d = drag.current;
    if (!d || d.table !== null) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    setPanning(true);
    setOffset({ x: d.ox + dx, y: d.oy + dy });
  }

  function onBgUp() {
    const d = drag.current;
    if (d && d.table === null && !d.moved) onSelect?.(null);
    drag.current = null;
    setPanning(false);
    setDraggingTable(null);
  }

  function onNodeMenu(name: string, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    onSelect?.(name);
    setMenu({ table: name, x: e.clientX - r.left, y: e.clientY - r.top });
  }

  const closeMenu = () => setMenu(null);
  const menuSchema = (menu && tables.find((t) => t.name === menu.table)?.schema) || 'public';
  const edges = computeEdges(tables, positions);

  let items: (MenuItem | '-')[] | null = null;
  if (menu) {
    const table = menu.table;
    items = menuItems
      ? menuItems(table, closeMenu)
      : [
          { icon: 'pencil', label: 'Rename table', shortcut: 'F2' },
          { icon: 'plus', label: 'Add column', shortcut: '⌘⏎' },
          { icon: 'link', label: 'Add foreign key…' },
          { icon: 'copy', label: 'Duplicate', shortcut: '⌘D', onSelect: () => onDuplicateTable?.(table) },
          '-',
          { icon: 'code', label: 'Copy CREATE TABLE', shortcut: '⇧⌘C' },
          { icon: 'eye', label: 'Focus related tables' },
          '-',
          { icon: 'trash', label: 'Delete table', shortcut: '⌫', danger: true, onSelect: () => onDeleteTable?.(table) },
        ];
  }

  return (
    <div
      ref={ref}
      className={cx('ss-canvas', panning && 'is-panning')}
      style={style}
      onPointerDown={onBgDown}
      onPointerMove={onBgMove}
      onPointerUp={onBgUp}
      onContextMenu={(e) => e.preventDefault()}
      role="application"
      aria-label="ER diagram canvas"
    >
      <div className="ss-canvas-layer" style={{ transform: `translate(${offset.x}px,${offset.y}px) scale(${zoom})` }}>
        <svg className="ss-edges" width={1} height={1}>
          {edges.map((e) => {
            const active = !!sel && (e.from === sel || e.to === sel);
            return (
              <g key={e.id} className={cx('ss-edge-g', active && 'is-active', !!sel && !active && 'is-dim')}>
                <path className="ss-edge" d={edgePath(e.a, e.b)} />
                <EdgeEnds {...e} />
              </g>
            );
          })}
        </svg>
        {tables.map((t) => {
          const q = positionOf(positions, t.name);
          if (!q) return null;
          const related =
            !sel ||
            sel === t.name ||
            edges.some((e) => (e.from === sel && e.to === t.name) || (e.to === sel && e.from === t.name));
          return (
            <TableNode
              key={t.name}
              table={t}
              x={q.x}
              y={q.y}
              selected={sel === t.name}
              dimmed={dimUnrelated && !related}
              dragging={draggingTable === t.name}
              dirty={!!dirtyTables && dirtyTables.includes(t.name)}
              selectedColumn={selectedColumn}
              invalidColumns={sel === t.name ? invalidColumns : null}
              onSelect={onSelect}
              onSelectColumn={onSelectColumn}
              onPointerDown={(e) => onNodeDown(t.name, e)}
              onPointerMove={onNodeMove}
              onPointerUp={onNodeUp}
              onContextMenu={(e) => onNodeMenu(t.name, e)}
            />
          );
        })}
      </div>
      {hint && <div className="ss-canvas-hint">{hint}</div>}
      {showLegend !== false && (
        <div className="ss-legend">
          <span>
            <Icon name="key" size={12} style={{ color: 'var(--pk)' }} />
            primary key
          </span>
          <span>
            <Icon name="link" size={12} style={{ color: 'var(--fk)' }} />
            foreign key
          </span>
          <span>
            <b style={{ color: 'var(--ink-2)', fontWeight: 500 }}>?</b>
            nullable
          </span>
          <span>
            <b style={{ color: 'var(--ink-2)', fontWeight: 600, fontSize: 9.5 }}>UQ</b>
            unique
          </span>
        </div>
      )}
      {showMinimap !== false && (
        <Minimap tables={tables} positions={positions} selected={sel} zoom={zoom} offset={offset} view={size} />
      )}
      {menu && items && (
        <div className="ss-canvas-menu" style={{ left: menu.x, top: menu.y }}>
          <ContextMenu label={`${menuSchema}.${menu.table}`} items={items} onClose={closeMenu} />
        </div>
      )}
    </div>
  );
}
