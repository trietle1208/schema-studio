import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent, PointerEvent, ReactNode, Ref } from 'react';
import {
  centreOn,
  clampZoom,
  computeEdges,
  drawnEnds,
  edgeEndPaths,
  edgeEnds,
  edgePath,
  fitView,
  minimapLayout,
  minimapPoint,
  rectBetween,
  snap,
  tablesInRect,
  viewRect,
  zoomAt,
  type Ends,
  type MinimapScale,
  type Rect,
  type Size,
} from '../core/layout';
import { groupOf } from '../core/groups';
import type { Position, Positions, Table, TableGroup } from '../core/model';
import { positionOf } from '../core/positions';
import { qualifiedName, referenceProblem, type ColumnRef } from '../core/relations';
import { ContextMenu, type MenuItem } from './ContextMenu';
import { cx } from './cx';
import { Icon } from './Icon';
import { TableNode } from './TableNode';

const MINIMAP_SIZE: Size = { w: 168, h: 108 };
const DRAG_THRESHOLD = 3;
const WHEEL_ZOOM_SPEED = 0.0015;
const MODIFIER_KEYS = ['Shift', 'Control', 'Meta', 'Alt'];
const NO_GROUPS: readonly TableGroup[] = [];

export interface CanvasMenu {
  /** The table the menu is for; null for the menu of the empty canvas. */
  table: string | null;
  x: number;
  y: number;
}

export interface ERCanvasActions {
  /** Zooms and pans so that every table is in view. */
  fit: () => void;
  /** The part of the canvas that is on screen, in canvas units. */
  view: () => Rect;
}

export interface ERCanvasProps {
  tables: Table[];
  positions: Positions;
  onMove?: (name: string, position: Position) => void;
  /** Where each table of a drag is now: the dragged one and, when it is one of `selection`, the others. Without it `onMove` is called for each. */
  onMoveTables?: (positions: Positions) => void;
  onMoveEnd?: (name: string) => void;
  selected?: string | null;
  onSelect?: (name: string | null) => void;
  /** The tables that are selected together. With fewer than two of them `selected` is the selected table. */
  selection?: readonly string[];
  /**
   * Shift + click on a table, which adds it to the selected tables or takes it out, and a frame
   * dragged over the empty canvas with Shift held, which adds the tables it touches: called with
   * every table that is then selected. Without it Shift does nothing.
   */
  onSelectTables?: (names: readonly string[]) => void;
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
  onRenameTable?: (name: string) => void;
  onDuplicateTable?: (name: string) => void;
  onDeleteTable?: (name: string) => void;
  onAddColumn?: (name: string) => void;
  onAddForeignKey?: (name: string) => void;
  /**
   * A drag from the row of a column to the row of a column of another table, let go on one the
   * column can reference (see `referenceProblem`). Without it rows are not dragged.
   */
  onDrawForeignKey?: (from: ColumnRef, to: ColumnRef) => void;
  onCopyCreateTable?: (name: string) => void;
  /** "Focus related tables" in the menu of a table: the caller then passes only that table and the tables related to it. */
  onFocusRelated?: (name: string) => void;
  /** The table that is focused on. Its menu and the menu of the empty canvas offer "Show all tables" while there is one. */
  focused?: string | null;
  onShowAll?: () => void;
  /** "New table" in the menu of the empty canvas, with the canvas point that was right-clicked. Without it there is no such menu. */
  onNewTable?: (position: Position) => void;
  /** "Arrange tables" in the menu of the empty canvas, "Arrange selected tables" while several are selected. Without it the menu does not offer it. */
  onArrange?: () => void;
  /** The groups of the tables: a table of one has its colour, and the canvas lists them over the legend. */
  groups?: readonly TableGroup[];
  /** "Table groups…" in the menu of the empty canvas. Without it the menu does not offer it. */
  onGroups?: () => void;
  /** "Infer relationships" in the menu of the empty canvas. Without it the menu does not offer it. */
  onInferRelations?: () => void;
  /** "Review inferred relationships…" in the same menu. Left out when there are none to review. */
  onReviewInferred?: () => void;
  /** "Remove inferred relationships" in the same menu. Left out when there are none to remove. */
  onRemoveInferred?: () => void;
  initialMenu?: CanvasMenu;
  /** Shows the diagram without letting it be changed: tables are not dragged and have no menu. Panning and selecting still work. */
  readOnly?: boolean;
  hint?: ReactNode;
  showLegend?: boolean;
  showMinimap?: boolean;
  style?: CSSProperties;
  actionsRef?: Ref<ERCanvasActions>;
}

interface DragState {
  /** The table being dragged, or null while panning the canvas. */
  table: string | null;
  /** The row of `table` a foreign key is being drawn from, when the drag began on a row and not on the head. */
  column?: number;
  /** Where the tables that move with `table` were when the drag began, `table` among them. */
  origins?: Positions;
  /** The canvas point a frame is dragged from and the tables that were selected then, when the drag began on the empty canvas with Shift held. */
  frame?: { from: Position; base: readonly string[] };
  sx: number;
  sy: number;
  ox: number;
  oy: number;
  moved: boolean;
}

/** A row of a table on the canvas. */
interface Row {
  table: string;
  column: number;
}

/** A foreign key that is being drawn. */
interface Link {
  /** The row of the foreign-key column, where the drag began. */
  from: Row;
  /** The pointer, in canvas units. */
  at: Position;
  /** The row of another table the pointer is on, when it is on one. */
  over: Row | null;
}

// One bar at the referenced (one) end, a crow's foot at the foreign-key (many) end.
function EdgeEnds(ends: Ends) {
  const { one, many } = edgeEndPaths(ends);
  return (
    <>
      <path className="ss-edge-end" d={one} />
      <path className="ss-edge-end" d={many} />
    </>
  );
}

interface MinimapProps {
  tables: Table[];
  positions: Positions;
  groups: readonly TableGroup[];
  selected: ReadonlySet<string>;
  zoom: number;
  offset: Position;
  view: Size;
  /** A press or a drag on the minimap, with the pan offset that shows what it points at. */
  onPan: (offset: Position) => void;
}

/** The visible area while it is dragged over the minimap. */
interface MinimapHold {
  /** The minimap as it was when the drag began: it is not scaled again until the drag ends. */
  map: MinimapScale;
  /** From the middle of the visible area to where it was taken hold of, in px of the minimap. */
  grab: Position;
}

function Minimap({ tables, positions, groups, selected, zoom, offset, view, onPan }: MinimapProps) {
  const [hold, setHold] = useState<MinimapHold | null>(null);
  const layout = minimapLayout(tables, positions, viewRect(offset, zoom, view), MINIMAP_SIZE, hold?.map);
  if (!layout) return null;
  const { origin, scale, viewport: vp } = layout;

  /** The point of the minimap under the pointer, or the nearest one when the pointer has left it. */
  function pointAt(e: PointerEvent<HTMLDivElement>): Position {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    return {
      x: Math.min(MINIMAP_SIZE.w, Math.max(0, e.clientX - r.left - el.clientLeft)),
      y: Math.min(MINIMAP_SIZE.h, Math.max(0, e.clientY - r.top - el.clientTop)),
    };
  }

  function panTo({ map, grab }: MinimapHold, at: Position) {
    onPan(centreOn(minimapPoint(map, { x: at.x - grab.x, y: at.y - grab.y }), zoom, view));
  }

  function onDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const at = pointAt(e);
    const inside = at.x >= vp.x && at.x <= vp.x + vp.w && at.y >= vp.y && at.y <= vp.y + vp.h;
    // The visible area is dragged by where it is taken hold of. A press beside it puts its middle there first.
    const next: MinimapHold = {
      map: { origin, scale },
      grab: inside ? { x: at.x - (vp.x + vp.w / 2), y: at.y - (vp.y + vp.h / 2) } : { x: 0, y: 0 },
    };
    setHold(next);
    if (!inside) panTo(next, at);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  return (
    <div
      className={cx('ss-minimap', hold && 'is-dragging')}
      aria-label="Minimap"
      onPointerDown={onDown}
      onPointerMove={(e) => {
        if (hold) panTo(hold, pointAt(e));
      }}
      onPointerUp={() => setHold(null)}
      onLostPointerCapture={() => setHold(null)}
    >
      <svg width={MINIMAP_SIZE.w} height={MINIMAP_SIZE.h}>
        {layout.nodes.map((n) => {
          const group = groupOf(groups, n.name);
          return (
            <rect
              key={n.name}
              className={cx('n', selected.has(n.name) && 'is-sel', group && `has-group ss-group--${group.color}`)}
              x={n.x}
              y={n.y}
              width={n.w}
              height={n.h}
              rx={1.5}
            />
          );
        })}
        <rect className="vp" x={vp.x} y={vp.y} width={vp.w} height={vp.h} rx={2} />
      </svg>
    </div>
  );
}

export function ERCanvas({
  tables,
  positions,
  onMove,
  onMoveTables,
  onMoveEnd,
  selected: sel,
  onSelect,
  selection,
  onSelectTables,
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
  onRenameTable,
  onDuplicateTable,
  onDeleteTable,
  onAddColumn,
  onAddForeignKey,
  onDrawForeignKey,
  onCopyCreateTable,
  onFocusRelated,
  focused,
  onShowAll,
  onNewTable,
  onArrange,
  groups = NO_GROUPS,
  onGroups,
  onInferRelations,
  onReviewInferred,
  onRemoveInferred,
  initialMenu,
  readOnly,
  hint,
  showLegend,
  showMinimap,
  style,
  actionsRef,
}: ERCanvasProps) {
  const [offset, setOffset] = useState<Position>(initialOffset ?? { x: 0, y: 0 });
  /** The tables that are being dragged. */
  const [dragged, setDragged] = useState<ReadonlySet<string> | null>(null);
  const [panning, setPanning] = useState(false);
  const [link, setLink] = useState<Link | null>(null);
  /** The two corners of the frame that is being dragged over the canvas, in canvas units. */
  const [frame, setFrame] = useState<{ from: Position; to: Position } | null>(null);
  const [menu, setMenu] = useState<CanvasMenu | null>(initialMenu ?? null);
  const [size, setSize] = useState<Size>({ w: 840, h: 800 });
  const [seenFit, setSeenFit] = useState(fitSignal);
  const drag = useRef<DragState | null>(null);
  /** Set once a table is dragged or a foreign key drawn: the click that ends the drag is not a click on what it began on. */
  const swallowClick = useRef(false);
  /** Set when a press with Shift held has added its table to the selected ones: the click that follows does not take it out again. */
  const added = useRef(false);
  const ref = useRef<HTMLDivElement>(null);
  const chosen: readonly string[] = selection && selection.length > 1 ? selection : sel ? [sel] : [];
  const isChosen = new Set(chosen);

  if (fitSignal !== seenFit) {
    setSeenFit(fitSignal);
    setOffset({ x: 0, y: 0 });
  }

  useImperativeHandle(actionsRef, () => ({
    fit() {
      const el = ref.current;
      if (!el) return;
      const view = fitView(tables, positions, { w: el.clientWidth, h: el.clientHeight });
      setOffset(view.offset);
      onZoom?.(view.zoom);
    },
    view() {
      const el = ref.current;
      return viewRect(offset, zoom, el ? { w: el.clientWidth, h: el.clientHeight } : size);
    },
  }));

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

  // An open menu is what Esc closes, before anything under it: the key goes no further. Any other
  // key closes the menu too and goes on, so that a shortcut the menu names still does what it says.
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (MODIFIER_KEYS.includes(e.key)) return;
      if (e.key === 'Escape') e.stopPropagation();
      setMenu(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [menu]);

  // Esc gives up the foreign key or the frame that is being drawn, and does nothing else.
  const drawing = link !== null || frame !== null;
  useEffect(() => {
    if (!drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      // The tables the frame has selected so far are not: the selection is what it was.
      const base = drag.current?.frame?.base;
      if (base) onSelectTables?.(base);
      drag.current = null;
      setLink(null);
      setFrame(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [drawing, onSelectTables]);

  /** The canvas point under the pointer. */
  function pointAt(el: HTMLElement, e: PointerEvent): Position {
    const r = el.getBoundingClientRect();
    return { x: (e.clientX - r.left - offset.x) / zoom, y: (e.clientY - r.top - offset.y) / zoom };
  }

  const columnRef = (row: Row | null): ColumnRef | null => {
    const column = row && tables.find((t) => t.name === row.table)?.columns[row.column];
    return row && column ? { table: row.table, column: column.name } : null;
  };

  /** The row at a point of the screen. The pointer itself is no help: the row the drag began on has captured it. */
  function rowAt(x: number, y: number): Row | null {
    const row = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-column]');
    const node = row?.closest<HTMLElement>('[data-table]');
    if (!row || !node || !ref.current?.contains(node)) return null;
    return { table: node.dataset.table ?? '', column: Number(row.dataset.column) };
  }

  function onColumnDown(name: string, index: number, e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || readOnly || !onDrawForeignKey) return;
    // A column without a name is yet to become one that can reference another.
    if (!columnRef({ table: name, column: index })?.column.trim()) return;
    drag.current = { table: name, column: index, sx: e.clientX, sy: e.clientY, ox: 0, oy: 0, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onLinkMove(from: Row, d: DragState, e: PointerEvent) {
    const el = ref.current;
    if (!el) return;
    if (!d.moved && Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) < DRAG_THRESHOLD) return;
    d.moved = true;
    swallowClick.current = true;
    const over = rowAt(e.clientX, e.clientY);
    setLink({
      from,
      at: pointAt(el, e),
      // The rows of its own table are what the drag leaves, not where it can end.
      over: over && over.table !== from.table ? over : null,
    });
  }

  function onLinkUp(from: Row, d: DragState, e: PointerEvent) {
    drag.current = null;
    setLink(null);
    if (!d.moved) return;
    const source = columnRef(from);
    const target = columnRef(rowAt(e.clientX, e.clientY));
    if (source && target && !referenceProblem(tables, source, target)) onDrawForeignKey?.(source, target);
  }

  function onNodeDown(name: string, e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    setMenu(null);
    if (!(e.target as Element).closest('[data-drag]')) return;
    const q = positionOf(positions, name);
    if (!q) return;
    e.preventDefault();
    e.stopPropagation();
    // preventDefault also stops the browser from taking focus away from a field or button elsewhere,
    // which would keep the keyboard (and block ⌫ on the table just clicked).
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    // A table that is selected with others stays so, for the drag to move them all: it is the
    // click, if the press comes to one, that selects it alone or takes it out.
    let moving = isChosen.has(name) ? chosen : [name];
    if (e.shiftKey && onSelectTables) {
      if (!isChosen.has(name)) {
        moving = [...chosen, name];
        onSelectTables(moving);
        added.current = true;
      }
    } else if (moving.length === 1) {
      onSelect?.(name);
    }
    if (readOnly) return;
    const origins = Object.fromEntries(
      moving.flatMap((n) => {
        const p = positionOf(positions, n);
        return p ? [[n, p] as const] : [];
      }),
    );
    drag.current = { table: name, origins, sx: e.clientX, sy: e.clientY, ox: q.x, oy: q.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onNodeClick(name: string, e: MouseEvent) {
    if (!e.shiftKey || !onSelectTables) return onSelect?.(name);
    if (!added.current) onSelectTables(isChosen.has(name) ? chosen.filter((n) => n !== name) : [...chosen, name]);
  }

  function onNodeMove(e: PointerEvent) {
    const d = drag.current;
    if (!d || d.table === null) return;
    if (d.column !== undefined) return onLinkMove({ table: d.table, column: d.column }, d, e);
    const dx = (e.clientX - d.sx) / zoom;
    const dy = (e.clientY - d.sy) / zoom;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
    const origins = d.origins ?? {};
    if (!d.moved) {
      d.moved = true;
      swallowClick.current = true;
      setDragged(new Set(Object.keys(origins)));
    }
    // Every table moves by what the one under the pointer does, which keeps them as they stand to each other.
    const mx = snap(d.ox + dx) - d.ox;
    const my = snap(d.oy + dy) - d.oy;
    const moves = Object.fromEntries(Object.entries(origins).map(([name, o]) => [name, { x: o.x + mx, y: o.y + my }]));
    if (onMoveTables) onMoveTables(moves);
    else for (const [name, to] of Object.entries(moves)) onMove?.(name, to);
  }

  function onNodeUp(e: PointerEvent) {
    const d = drag.current;
    if (d && d.table !== null && d.column !== undefined) return onLinkUp({ table: d.table, column: d.column }, d, e);
    if (d && d.table !== null && d.moved) onMoveEnd?.(d.table);
    drag.current = null;
    setDragged(null);
  }

  function onBgDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    setMenu(null);
    // A press on the minimap moves the view (see Minimap): it is not one on the empty canvas.
    if ((e.target as Element).closest('.ss-minimap')) return;
    drag.current = { table: null, sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y, moved: false };
    if (e.shiftKey && onSelectTables) {
      drag.current.frame = { from: pointAt(e.currentTarget, e), base: chosen };
      // As for a press on a table: Shift + press would select the text between it and the last click.
      e.preventDefault();
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onBgMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.table !== null) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    if (d.frame) {
      const { from, base } = d.frame;
      const to = pointAt(e.currentTarget, e);
      setFrame({ from, to });
      const touched = tablesInRect(tables, positions, rectBetween(from, to));
      onSelectTables?.([...base, ...touched.filter((name) => !base.includes(name))]);
      return;
    }
    setPanning(true);
    setOffset({ x: d.ox + dx, y: d.oy + dy });
  }

  function onBgUp() {
    const d = drag.current;
    // A press with Shift held that came to no frame leaves the selected tables as they are.
    if (d && d.table === null && !d.moved && !d.frame) onSelect?.(null);
    drag.current = null;
    setPanning(false);
    setDragged(null);
    setFrame(null);
  }

  function onNodeMenu(name: string, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const el = ref.current;
    if (!el || readOnly) return;
    const r = el.getBoundingClientRect();
    onSelect?.(name);
    setMenu({ table: name, x: e.clientX - r.left, y: e.clientY - r.top });
  }

  function onBgMenu(e: MouseEvent) {
    e.preventDefault();
    const el = ref.current;
    // The legends and the minimap lie over the canvas; a table cannot be placed under them.
    if (!el || !onNewTable || (e.target as Element).closest('.ss-legend, .ss-legend-groups, .ss-minimap, .ss-canvas-hint, .ss-canvas-menu')) return;
    const r = el.getBoundingClientRect();
    setMenu({ table: null, x: e.clientX - r.left, y: e.clientY - r.top });
  }

  // A drag that the browser takes away (a touch that becomes a scroll) ends without a pointer-up.
  function onCaptureLost() {
    if (drag.current?.column !== undefined || drag.current?.frame) drag.current = null;
    setLink(null);
    setFrame(null);
  }

  const closeMenu = () => setMenu(null);
  const menuSchema = (menu && tables.find((t) => t.name === menu.table)?.schema) || 'public';
  // Not on every pan and zoom: a line that goes around tables is looked for among all of them.
  const edges = useMemo(() => computeEdges(tables, positions), [tables, positions]);

  // The foreign key that is being drawn: its two columns, why it cannot end where the pointer is,
  // and its line, which ends on the column as the relationship will once the column is one it can end on.
  const linkFrom = link && columnRef(link.from);
  const linkTo = link && columnRef(link.over);
  const linkProblem = linkFrom && linkTo ? referenceProblem(tables, linkFrom, linkTo) : null;
  const linkAt = link && positionOf(positions, link.from.table);
  const linkEnd = link?.over && linkTo && !linkProblem ? positionOf(positions, link.over.table) : undefined;
  let drawn: Ends | null = null;
  if (link && linkAt) {
    drawn = link.over && linkEnd ? edgeEnds(linkAt, link.from.column, linkEnd, link.over.column) : drawnEnds(linkAt, link.from.column, link.at);
  }
  let linkHint: ReactNode = null;
  if (linkFrom) {
    const mono = (text: string) => (
      <span className="ss-mono" style={{ color: 'var(--ink-1)' }}>
        {text}
      </span>
    );
    if (linkProblem) linkHint = linkProblem;
    else if (linkTo) linkHint = <span>Add foreign key {mono(`${qualifiedName(linkFrom)} → ${qualifiedName(linkTo)}`)}</span>;
    else linkHint = <span>Drop {mono(qualifiedName(linkFrom))} on the column it references</span>;
  }

  const framed = frame && rectBetween(frame.from, frame.to);

  // The groups that have a table on the canvas, each with the tables of it that are shown.
  const shownGroups = groups
    .map((group) => ({ group, shown: tables.filter((t) => group.tables.includes(t.name)).map((t) => t.name) }))
    .filter((g) => g.shown.length > 0);

  const menuTable = menu ? menu.table : null;
  let items: (MenuItem | '-')[] | null = null;
  if (menu && menuTable === null) {
    const at = { x: snap((menu.x - offset.x) / zoom), y: snap((menu.y - offset.y) / zoom) };
    items = [{ icon: 'table', label: 'New table', onSelect: () => onNewTable?.(at) }];
    if (onArrange) {
      items.push({ icon: 'sparkle', label: chosen.length > 1 ? 'Arrange selected tables' : 'Arrange tables', shortcut: '⇧A', onSelect: onArrange });
    }
    if (focused != null && onShowAll) items.push({ icon: 'eye', label: 'Show all tables', onSelect: onShowAll });
    if (onGroups) items.push({ icon: 'folder', label: 'Table groups…', onSelect: onGroups });
    if (onInferRelations || onReviewInferred || onRemoveInferred) items.push('-');
    if (onInferRelations) items.push({ icon: 'link', label: 'Infer relationships', onSelect: onInferRelations });
    if (onReviewInferred) items.push({ icon: 'check', label: 'Review inferred relationships…', onSelect: onReviewInferred });
    if (onRemoveInferred) items.push({ icon: 'x', label: 'Remove inferred relationships', onSelect: onRemoveInferred });
  } else if (menuTable !== null) {
    const table = menuTable;
    items = menuItems
      ? menuItems(table, closeMenu)
      : [
          { icon: 'pencil', label: 'Rename table', shortcut: 'F2', onSelect: () => onRenameTable?.(table) },
          { icon: 'plus', label: 'Add column', shortcut: '⌘⏎', onSelect: () => onAddColumn?.(table) },
          { icon: 'link', label: 'Add foreign key…', onSelect: () => onAddForeignKey?.(table) },
          { icon: 'copy', label: 'Duplicate', shortcut: '⌘D', onSelect: () => onDuplicateTable?.(table) },
          '-',
          { icon: 'code', label: 'Copy CREATE TABLE', shortcut: '⇧⌘C', onSelect: () => onCopyCreateTable?.(table) },
          focused === table && onShowAll
            ? { icon: 'eye', label: 'Show all tables', onSelect: onShowAll }
            : { icon: 'eye', label: 'Focus related tables', onSelect: () => onFocusRelated?.(table) },
          '-',
          { icon: 'trash', label: 'Delete table', shortcut: '⌫', danger: true, onSelect: () => onDeleteTable?.(table) },
        ];
  }

  return (
    <div
      ref={ref}
      className={cx('ss-canvas', panning && 'is-panning', link && 'is-linking', frame && 'is-framing', linkProblem && 'is-refused')}
      style={style}
      onPointerDownCapture={() => {
        swallowClick.current = false;
        added.current = false;
      }}
      onPointerDown={onBgDown}
      onPointerMove={onBgMove}
      onPointerUp={onBgUp}
      onLostPointerCapture={onCaptureLost}
      onClickCapture={(e) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        e.stopPropagation();
      }}
      onContextMenu={onBgMenu}
      role="application"
      aria-label="ER diagram canvas"
    >
      <div className="ss-canvas-layer" style={{ transform: `translate(${offset.x}px,${offset.y}px) scale(${zoom})` }}>
        <svg className="ss-edges" width={1} height={1}>
          {edges.map((e) => {
            const active = isChosen.has(e.from) || isChosen.has(e.to);
            return (
              <g key={e.id} className={cx('ss-edge-g', e.inferred && 'is-inferred', active && 'is-active', chosen.length > 0 && !active && 'is-dim')}>
                <path className="ss-edge" d={edgePath(e.a, e.b, e.via)} />
                <EdgeEnds {...e} />
              </g>
            );
          })}
        </svg>
        {tables.map((t) => {
          const q = positionOf(positions, t.name);
          if (!q) return null;
          const related =
            !chosen.length ||
            isChosen.has(t.name) ||
            edges.some((e) => (isChosen.has(e.from) && e.to === t.name) || (isChosen.has(e.to) && e.from === t.name));
          return (
            <TableNode
              key={t.name}
              table={t}
              x={q.x}
              y={q.y}
              selected={isChosen.has(t.name)}
              group={groupOf(groups, t.name)}
              // While a foreign key is drawn every table is one it may end on, and none is faded.
              dimmed={dimUnrelated && !related && !link}
              dragging={!!dragged && dragged.has(t.name)}
              dirty={!!dirtyTables && dirtyTables.includes(t.name)}
              selectedColumn={selectedColumn}
              invalidColumns={sel === t.name ? invalidColumns : null}
              linkColumn={link?.from.table === t.name ? link.from.column : link?.over?.table === t.name ? link.over.column : null}
              linkRefused={!!linkProblem && link?.over?.table === t.name}
              onSelect={onNodeClick}
              // Shift + click on a row is for its table, as on the head: it opens no column.
              onSelectColumn={(i, e) => {
                if (!e.shiftKey || !onSelectTables) onSelectColumn?.(i);
              }}
              onPointerDown={(e) => onNodeDown(t.name, e)}
              onColumnPointerDown={(i, e) => onColumnDown(t.name, i, e)}
              onPointerMove={onNodeMove}
              onPointerUp={onNodeUp}
              onContextMenu={(e) => onNodeMenu(t.name, e)}
            />
          );
        })}
        {/* Over the tables, unlike the lines of the relationships: the pointer is on a table when the line ends. */}
        {drawn && (
          <svg className="ss-edges" width={1} height={1}>
            <g className={cx('ss-edge-g', 'is-active', !linkEnd && 'is-open')}>
              <path className="ss-edge" d={edgePath(drawn.a, drawn.b)} />
              {linkEnd && <EdgeEnds {...drawn} />}
            </g>
          </svg>
        )}
      </div>
      {framed && (
        <div
          className="ss-canvas-frame"
          style={{ left: framed.x * zoom + offset.x, top: framed.y * zoom + offset.y, width: framed.w * zoom, height: framed.h * zoom }}
        />
      )}
      {(linkHint ?? hint) && <div className="ss-canvas-hint">{linkHint ?? hint}</div>}
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
          {edges.some((e) => e.inferred) && (
            <span>
              <svg className="ss-legend-edge" width={16} height={8} aria-hidden="true">
                <path className="ss-edge" d="M0 4 H16" />
              </svg>
              inferred
            </span>
          )}
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
      {showLegend !== false && shownGroups.length > 0 && (
        // The canvas takes a press on it as the start of a pan, and a click as one on the empty canvas.
        <div className="ss-legend-groups" aria-label="Table groups" onPointerDown={(e) => e.stopPropagation()}>
          {shownGroups.map(({ group, shown }) => (
            <button
              key={group.name}
              type="button"
              className={cx('ss-legend-group', `ss-group--${group.color}`, shown.length === chosen.length && shown.every((n) => isChosen.has(n)) && 'is-selected')}
              title={`Select the ${shown.length === 1 ? 'table' : `${shown.length} tables`} of ${group.name}`}
              onClick={() => (onSelectTables ? onSelectTables(shown) : onSelect?.(shown[0]))}
            >
              <span className="ss-group-swatch" />
              <span className="ss-legend-group-name">{group.name}</span>
              <span className="ss-legend-group-count">{shown.length}</span>
            </button>
          ))}
        </div>
      )}
      {showMinimap !== false && (
        <Minimap tables={tables} positions={positions} groups={groups} selected={isChosen} zoom={zoom} offset={offset} view={size} onPan={setOffset} />
      )}
      {menu && items && (
        <div className="ss-canvas-menu" style={{ left: menu.x, top: menu.y }}>
          <ContextMenu
            label={menu.table === null ? undefined : `${menuSchema}.${menu.table}`}
            items={items}
            onClose={closeMenu}
          />
        </div>
      )}
    </div>
  );
}
