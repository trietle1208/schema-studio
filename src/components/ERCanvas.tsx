import { memo, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent, PointerEvent, ReactNode, Ref } from 'react';
import {
  centreOn,
  clampZoom,
  draggedWidth,
  drawnEnds,
  edgeEnds,
  edgeMarks,
  edgePath,
  fitView,
  fittingWidth,
  minimapLayout,
  minimapPoint,
  rectBetween,
  RING_RADIUS,
  routeEdges,
  rowOf,
  nodeRects,
  type Edge,
  type EdgeSet,
  snap,
  tablesInRect,
  viewRect,
  widened,
  zoomAt,
  type EdgeKind,
  type Ends,
  type MinimapScale,
  type Rect,
  type Size,
} from '../core/layout';
import type { ColumnsChoice } from '../core/edit';
import { locatePoint, stubAnchor, type PlacedStub, type StubLink } from '../core/explorer';
import { groupOf } from '../core/groups';
import { t } from '../core/i18n';
import { hideHubEdges } from '../core/views';
import type { GroupColor, Position, Positions, Table, TableGroup } from '../core/model';
import { DEFAULT_NOTATION, type Notation } from '../core/notation';
import { positionOf } from '../core/positions';
import { qualifiedName, referenceProblem, type ColumnRef } from '../core/relations';
import { ContextMenu, type MenuItem } from './ContextMenu';
import { cx } from './cx';
import { Icon } from './Icon';
import { Switch } from './Switch';
import { rich } from './rich';
import { TableNode, type TableNodeProps } from './TableNode';
import { SMOOTH_EASE, useLiveView, viewTransform } from './useLiveView';
import { useStableHandlers } from './useStableHandlers';

const MINIMAP_SIZE: Size = { w: 168, h: 108 };
const DRAG_THRESHOLD = 3;
const WHEEL_ZOOM_SPEED = 0.0015;
const MODIFIER_KEYS = ['Shift', 'Control', 'Meta', 'Alt'];
const NO_GROUPS: readonly TableGroup[] = [];
const NO_NAMES: ReadonlySet<string> = new Set();
/** A diagram of more tables than this draws only the ones near the visible area, and the tables without their rows when zoomed far out. */
const LARGE_DIAGRAM = 60;
/** How far past the visible area, in canvas units, tables are still drawn, and the steps their bounds move in so that panning does not redraw them all the time. */
const CULL_MARGIN = 480;
const CULL_STEP = 256;
/** Below this zoom the rows of a table of a large diagram are too small to read: the table is drawn as its head over a blank body. */
const LITE_ZOOM = 0.45;
/** How long one pass looks for ways around tables, so that a diagram of hundreds of tables stays responsive while its lines are found. */
const ROUTE_PASS_MS = 12;
/** How long the canvas glides to where a step of the wheel puts it. A drag of the canvas does not glide: it stays on the pointer. */
const WHEEL_GLIDE_MS = 140;
/** How long the canvas glides to the zoom of a step of the wheel: long enough for a wheel turned notch by notch to zoom without a stop between notches. */
const WHEEL_ZOOM_GLIDE_MS = 120;
/** How often a large diagram is drawn again while it is panned or zoomed. */
const MOVING_COMMIT_MS = 250;

export interface CanvasMenu {
  /** The table the menu is for; null for the menu of the empty canvas. */
  table: string | null;
  x: number;
  y: number;
}

export interface ERCanvasActions {
  /** Zooms and pans so that every table is in view. */
  fit: () => void;
  /** Pans so that `name` — a table, or its stub — sits in the middle. The zoom stays. */
  locate: (name: string) => void;
  /** The part of the canvas that is on screen, in canvas units. */
  view: () => Rect;
}

export interface ERCanvasProps {
  tables: Table[];
  positions: Positions;
  onMove?: (name: string, position: Position) => void;
  /** Where each table of a drag is now: the dragged one and, when it is one of `selection`, the others. Without it `onMove` is called for each. */
  onMoveTables?: (positions: Positions) => void;
  /**
   * How wide each table of a drag of a side is now, and where: the table whose side is dragged
   * and, when it is one of `selection`, the others, which get its width. A double click on a side
   * makes each as wide as its text. `onMoveEnd` ends it like a move. Without it tables have no
   * handles at their sides.
   */
  onResizeTables?: (sizes: Positions) => void;
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
  /** How the ends of the relationship lines are drawn. Crow's foot when it is left out. */
  notation?: Notation;
  /**
   * "Show key columns only", "Hide columns", "Show all columns" and "Collapse large tables" in the
   * menus: what `choice` says for the tables called `names`, or for every table without them.
   */
  onShowColumns?: (choice: ColumnsChoice, names?: readonly string[]) => void;
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
  /** The table pointed at in the Explorer. Its node takes an accent border and its lines the accent. */
  pointed?: string | null;
  /** Column names the Explorer filter matched, by table. */
  markedColumns?: ReadonlyMap<string, ReadonlySet<string>>;
  /** Hubs drawn as tags: a column that references one shows the tag, and the line to it is left out. */
  hubTags?: ReadonlySet<string>;
  /** The bar over the canvas. On, the tags stand in for the lines; off, the lines are drawn. */
  hubsAsTags?: boolean;
  onHubsAsTags?: (on: boolean) => void;
  /** The hubs the bar names, such as `da_don_vi · 65`. */
  hubNote?: string;
  /** Tables of other modules the drawn tables reference, as dashed pills. */
  stubs?: readonly PlacedStub[];
  /** Foreign keys from a drawn table to a stub. */
  stubLinks?: readonly StubLink[];
  /** The colour of a stub's module. */
  stubColor?: (module: string) => GroupColor;
  /** "Show" on a stub: draw that table. */
  onShowStub?: (name: string) => void;
  /** The hint under the stubs. Off once it has been shown; a click dismisses it. */
  stubNote?: boolean;
  onDismissStubNote?: () => void;
  /** The filter pill: how many drawn tables hold the query. Null when the filter is empty. */
  highlight?: { query: string; count: string } | null;
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
  /** The side of `table` that is dragged (1 right, -1 left), when the drag began on a handle: the tables of `origins` get its width. */
  side?: 1 | -1;
  /** The canvas point a frame is dragged from and the tables that were selected then, when the drag began on the empty canvas with Shift held. */
  frame?: { from: Position; base: readonly string[] };
  sx: number;
  sy: number;
  ox: number;
  oy: number;
  moved: boolean;
  /** How far the tables of `origins` have been painted from where they began, in canvas units, while a drag of them is live on the nodes. */
  liveMx?: number;
  liveMy?: number;
}

/** The element of a table on the canvas layer. */
function nodeEl(root: HTMLElement, name: string): HTMLElement | null {
  return root.querySelector(`[data-table="${CSS.escape(name)}"]`);
}

/**
 * Paints a live drag of tables by translating their nodes, without updating `positions`. Updating
 * React on every pointer move was what made a drag of a table stutter on a diagram of dozens of rows.
 */
function paintNodeDrag(root: HTMLElement | null, origins: Positions, mx: number, my: number) {
  if (!root) return;
  const translate = mx || my ? `translate(${mx}px, ${my}px)` : '';
  for (const name of Object.keys(origins)) {
    const el = nodeEl(root, name);
    if (!el) continue;
    if (translate) el.style.transform = translate;
    else el.style.removeProperty('transform');
  }
}

/** Puts the final places of a live drag onto the nodes, then clears their translate, before React takes over. */
function commitNodeDrag(root: HTMLElement | null, moves: Positions) {
  if (!root) return;
  for (const [name, to] of Object.entries(moves)) {
    const el = nodeEl(root, name);
    if (!el) continue;
    el.style.left = `${to.x}px`;
    el.style.top = `${to.y}px`;
    el.style.removeProperty('transform');
  }
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

// The marks at the two ends of a line: which table is referenced, and how many rows may be on each side.
function EdgeEnds({ notation, ...kind }: EdgeKind & { notation: Notation }) {
  const { paths, rings } = edgeMarks(kind, notation);
  return (
    <>
      {paths.map((d) => (
        <path key={d} className="ss-edge-end" d={d} />
      ))}
      {rings.map((c) => (
        <circle key={`${c.x},${c.y}`} className="ss-edge-ring" cx={c.x} cy={c.y} r={RING_RADIUS} />
      ))}
    </>
  );
}

/** What a table on the canvas does with the pointer: the same functions for a table from one render to the next. */
type NodeHandlers = Pick<
  TableNodeProps,
  'onSelect' | 'onSelectColumn' | 'onPointerDown' | 'onColumnPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onContextMenu' | 'onResizeDown' | 'onResizeFit'
>;

/** What the canvas does when a table is pressed, clicked or dragged, as of the latest render. */
interface NodeActions {
  onNodeClick: (name: string, e: MouseEvent) => void;
  onNodeDown: (name: string, e: PointerEvent<HTMLDivElement>) => void;
  onColumnDown: (name: string, index: number, e: PointerEvent<HTMLDivElement>) => void;
  onNodeMove: (e: PointerEvent) => void;
  onNodeUp: (e: PointerEvent) => void;
  onNodeMenu: (name: string, e: MouseEvent) => void;
  onResizeDown: (name: string, side: 1 | -1, e: PointerEvent<HTMLDivElement>) => void;
  onResizeFit: (name: string) => void;
  onSelectColumn?: (index: number | null) => void;
  onSelectTables?: (names: readonly string[]) => void;
}

/** The handlers of one table; `resizable` gives it handles at its sides. */
function makeHandlers(name: string, current: () => NodeActions, resizable: boolean): NodeHandlers {
  return {
    onSelect: (n, e) => current().onNodeClick(n, e),
    // Shift + click on a row is for its table, as on the head: it opens no column.
    onSelectColumn: (i, e) => {
      if (!e.shiftKey || !current().onSelectTables) current().onSelectColumn?.(i);
    },
    onPointerDown: (e) => current().onNodeDown(name, e),
    onColumnPointerDown: (i, e) => current().onColumnDown(name, i, e),
    onPointerMove: (e) => current().onNodeMove(e),
    onPointerUp: (e) => current().onNodeUp(e),
    onContextMenu: (e) => current().onNodeMenu(name, e),
    onResizeDown: resizable ? (side, e) => current().onResizeDown(name, side, e) : undefined,
    onResizeFit: () => current().onResizeFit(name),
  };
}

interface EdgeLineProps {
  edge: Edge;
  /** How the line stands to the selected tables: on one of them, or not (when something is selected), or neither. */
  mode: 'active' | 'dim' | 'plain';
  /** The Explorer is pointing at one end of the line. */
  hot?: boolean;
  notation: Notation;
}

/** One relationship line. It is redrawn only when its line, or how it stands to the selection, changes. */
const EdgeLine = memo(function EdgeLine({ edge: e, mode, hot, notation }: EdgeLineProps) {
  return (
    <g className={cx('ss-edge-g', e.inferred && 'is-inferred', mode === 'active' && 'is-active', mode === 'dim' && 'is-dim', hot && 'is-hot')}>
      <path className="ss-edge" d={edgePath(e.a, e.b, e.via)} />
      <EdgeEnds {...e} notation={notation} />
    </g>
  );
});

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
      aria-label={t('canvas.minimap')}
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
  onResizeTables,
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
  notation = DEFAULT_NOTATION,
  onShowColumns,
  groups = NO_GROUPS,
  onGroups,
  onInferRelations,
  onReviewInferred,
  onRemoveInferred,
  pointed,
  markedColumns,
  hubTags,
  hubsAsTags,
  onHubsAsTags,
  hubNote,
  stubs = [],
  stubLinks: links = [],
  stubColor,
  onShowStub,
  stubNote,
  onDismissStubNote,
  highlight,
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
  /** The tables whose width is being dragged. */
  const [resized, setResized] = useState<ReadonlySet<string> | null>(null);
  const [panning, setPanning] = useState(false);
  const [link, setLink] = useState<Link | null>(null);
  /** The two corners of the frame that is being dragged over the canvas, in canvas units. */
  const [frame, setFrame] = useState<{ from: Position; to: Position } | null>(null);
  const [menu, setMenu] = useState<CanvasMenu | null>(initialMenu ?? null);
  const [size, setSize] = useState<Size>({ w: 840, h: 800 });
  const [seenFit, setSeenFit] = useState(fitSignal);
  /** Counts the passes that look for the ways around tables; each one is a render of its own. */
  const [pass, setPass] = useState(0);
  const drag = useRef<DragState | null>(null);
  /** Set once a table is dragged or a foreign key drawn: the click that ends the drag is not a click on what it began on. */
  const swallowClick = useRef(false);
  /** Set when a press with Shift held has added its table to the selected ones: the click that follows does not take it out again. */
  const added = useRef(false);
  const ref = useRef<HTMLDivElement>(null);
  // The wheel and a drag of the canvas move the layer without a render of the canvas for each step. A
  // large diagram is drawn again now and then while it moves, so that the tables coming into view are there.
  const { layer: layerRef, live, move: moveView, settle: settleView } = useLiveView(
    { offset, zoom },
    (v) => {
      setOffset(v.offset);
      if (v.zoom !== zoom) onZoom?.(v.zoom);
    },
    tables.length > LARGE_DIAGRAM ? MOVING_COMMIT_MS : null,
  );
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
      const extra = stubs.map((s) => ({ x: s.x, y: s.y, w: 220, h: 32 }));
      const view = fitView(tables, positions, { w: el.clientWidth, h: el.clientHeight }, 48, extra);
      // A glide that is still on its way would otherwise end where the wheel sent it.
      settleView();
      setOffset(view.offset);
      onZoom?.(view.zoom);
    },
    locate(name) {
      const el = ref.current;
      const point = locatePoint(tables, positions, name, stubs);
      if (!el || !point) return;
      settleView();
      setOffset(centreOn(point, live.current.zoom, { w: el.clientWidth, h: el.clientHeight }));
    },
    view() {
      const el = ref.current;
      return viewRect(live.current.offset, live.current.zoom, el ? { w: el.clientWidth, h: el.clientHeight } : size);
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
      const { offset: o, zoom: z } = live.current;
      if (e.ctrlKey || e.metaKey) {
        if (!onZoom) return;
        const next = clampZoom(z * Math.exp(-e.deltaY * WHEEL_ZOOM_SPEED));
        if (next === z) return;
        const r = el.getBoundingClientRect();
        moveView({ offset: zoomAt(o, z, next, { x: e.clientX - r.left, y: e.clientY - r.top }), zoom: next }, WHEEL_ZOOM_GLIDE_MS, SMOOTH_EASE);
      } else {
        moveView({ offset: { x: o.x - e.deltaX, y: o.y - e.deltaY }, zoom: z }, WHEEL_GLIDE_MS);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [live, moveView, onZoom]);

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
    const { offset: o, zoom: z } = live.current;
    return { x: (e.clientX - r.left - o.x) / z, y: (e.clientY - r.top - o.y) / z };
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

  /** Where the tables are that a drag of `name` takes along: the selected ones when it is one of them. */
  function originsOf(name: string): Positions {
    return Object.fromEntries(
      (isChosen.has(name) ? chosen : [name]).flatMap((n) => {
        const p = positionOf(positions, n);
        return p ? [[n, p] as const] : [];
      }),
    );
  }

  function onResizeDown(name: string, side: 1 | -1, e: PointerEvent<HTMLDivElement>) {
    const q = positionOf(positions, name);
    if (e.button !== 0 || !q) return;
    setMenu(null);
    // As for a press on the head of a table: the keyboard stays with the canvas.
    e.preventDefault();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (!isChosen.has(name)) onSelect?.(name);
    drag.current = { table: name, origins: originsOf(name), side, sx: e.clientX, sy: e.clientY, ox: q.x, oy: q.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onResizeMove(table: string, side: 1 | -1, d: DragState, e: PointerEvent) {
    const origins = d.origins ?? {};
    const own = positionOf(origins, table);
    const dx = (e.clientX - d.sx) / zoom;
    if (!own || (!d.moved && Math.abs(dx) < DRAG_THRESHOLD)) return;
    if (!d.moved) {
      d.moved = true;
      swallowClick.current = true;
      setResized(new Set(Object.keys(origins)));
    }
    // Every table gets the width of the one whose side is dragged, and keeps its other side where it is.
    const w = draggedWidth(own, side, dx);
    onResizeTables?.(Object.fromEntries(Object.entries(origins).map(([name, o]) => [name, widened(o, w, side)])));
  }

  /** A double click on a side of a table: it, or each of the selected tables it is one of, is as wide as its text. */
  function onResizeFit(name: string) {
    const sizes = Object.entries(originsOf(name)).flatMap(([n, p]) => {
      const table = tables.find((t) => t.name === n);
      return table ? [[n, widened(p, fittingWidth(table, p))] as const] : [];
    });
    onResizeTables?.(Object.fromEntries(sizes));
    onMoveEnd?.(name);
  }

  function onNodeClick(name: string, e: MouseEvent) {
    if (!e.shiftKey || !onSelectTables) return onSelect?.(name);
    if (!added.current) onSelectTables(isChosen.has(name) ? chosen.filter((n) => n !== name) : [...chosen, name]);
  }

  function onNodeMove(e: PointerEvent) {
    const d = drag.current;
    if (!d || d.table === null) return;
    if (d.column !== undefined) return onLinkMove({ table: d.table, column: d.column }, d, e);
    if (d.side !== undefined) return onResizeMove(d.table, d.side, d, e);
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
    // The nodes take the translate; `positions` waits until the pointer is up so the edges are not redrawn each step.
    const mx = snap(d.ox + dx) - d.ox;
    const my = snap(d.oy + dy) - d.oy;
    d.liveMx = mx;
    d.liveMy = my;
    paintNodeDrag(layerRef.current, origins, mx, my);
  }

  function onNodeUp(e: PointerEvent) {
    const d = drag.current;
    if (d && d.table !== null && d.column !== undefined) return onLinkUp({ table: d.table, column: d.column }, d, e);
    if (d && d.table !== null && d.moved && d.side === undefined) {
      const origins = d.origins ?? {};
      const mx = d.liveMx ?? 0;
      const my = d.liveMy ?? 0;
      const moves = Object.fromEntries(Object.entries(origins).map(([name, o]) => [name, { x: o.x + mx, y: o.y + my }]));
      commitNodeDrag(layerRef.current, moves);
      if (onMoveTables) onMoveTables(moves);
      else for (const [name, to] of Object.entries(moves)) onMove?.(name, to);
      onMoveEnd?.(d.table);
    } else if (d && d.table !== null && d.moved) {
      onMoveEnd?.(d.table);
    }
    drag.current = null;
    setDragged(null);
    setResized(null);
  }

  function onBgDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    setMenu(null);
    // A press on the minimap moves the view (see Minimap): it is not one on the empty canvas.
    if ((e.target as Element).closest('.ss-minimap')) return;
    settleView();
    drag.current = { table: null, sx: e.clientX, sy: e.clientY, ox: live.current.offset.x, oy: live.current.offset.y, moved: false };
    // As for a press on a table: the drag that follows would select the text it passes over (the
    // legend, the panels beside the canvas), and Shift + press the text since the last click.
    e.preventDefault();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (e.shiftKey && onSelectTables) drag.current.frame = { from: pointAt(e.currentTarget, e), base: chosen };
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
    moveView({ offset: { x: d.ox + dx, y: d.oy + dy }, zoom: live.current.zoom }, 0);
  }

  function onBgUp() {
    const d = drag.current;
    // A press with Shift held that came to no frame leaves the selected tables as they are.
    if (d && d.table === null && !d.moved && !d.frame) onSelect?.(null);
    if (d && d.table === null && d.moved && !d.frame) settleView();
    drag.current = null;
    setPanning(false);
    setDragged(null);
    setResized(null);
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
    const d = drag.current;
    if (d?.origins && d.liveMx !== undefined) paintNodeDrag(layerRef.current, d.origins, 0, 0);
    if (d?.column !== undefined || d?.frame) drag.current = null;
    setLink(null);
    setFrame(null);
  }

  // The first move of a table sets `dragged` and re-renders: put the translate back on the nodes before paint.
  useLayoutEffect(() => {
    if (!dragged) return;
    const d = drag.current;
    if (!d?.origins || !d.moved) return;
    paintNodeDrag(layerRef.current, d.origins, d.liveMx ?? 0, d.liveMy ?? 0);
  }, [dragged, layerRef]);

  const closeMenu = () => setMenu(null);
  const menuSchema = (menu && tables.find((t) => t.name === menu.table)?.schema) || 'public';
  // A line that goes around tables is looked for among all of them, which takes long in a large
  // diagram. So the lines are found a pass at a time: each pass keeps the lines that are still
  // right, looks for the ones that are not until its time is up, and leaves the rest as curves for
  // the next pass. Not on every pan and zoom, but on every change of the tables and their places.
  // While tables are dragged or resized the lines that need a way around are left as curves, which is
  // quick; they are found once the pointer is let go.
  const busy = !!dragged || !!resized;
  const limit = busy ? { searches: 0 } : { ms: ROUTE_PASS_MS };
  const [found, setFound] = useState<EdgeSet>(() => routeEdges(tables, positions, [], limit));
  const [routedFor, setRoutedFor] = useState({ tables, positions, pass: 0 });
  if (routedFor.tables !== tables || routedFor.positions !== positions || routedFor.pass !== pass) {
    setRoutedFor({ tables, positions, pass });
    setFound(routeEdges(tables, positions, found.edges, limit));
  }
  useEffect(() => {
    if (!found.pending || busy) return;
    const timer = setTimeout(() => setPass((n) => n + 1), 0);
    return () => clearTimeout(timer);
  }, [found, busy]);
  const edges = useMemo(() => hideHubEdges(found.edges, hubTags ?? NO_NAMES), [found.edges, hubTags]);

  // The foreign key that is being drawn: its two columns, why it cannot end where the pointer is,
  // and its line, which ends on the column as the relationship will once the column is one it can end on.
  const linkFrom = link && columnRef(link.from);
  const linkTo = link && columnRef(link.over);
  const linkProblem = linkFrom && linkTo ? referenceProblem(tables, linkFrom, linkTo) : null;
  const linkAt = link && positionOf(positions, link.from.table);
  const linkEnd = link?.over && linkTo && !linkProblem ? positionOf(positions, link.over.table) : undefined;
  let drawn: Ends | null = null;
  if (link && linkAt) {
    // The rows are those the tables show: a table that shows fewer columns has the line end at its head for the others.
    const rowIn = (name: string, column: number) => {
      const table = tables.find((t) => t.name === name);
      return table ? rowOf(table, positionOf(positions, name), column) : column;
    };
    drawn = link.over && linkEnd
      ? edgeEnds(linkAt, rowIn(link.from.table, link.from.column), linkEnd, rowIn(link.over.table, link.over.column))
      : drawnEnds(linkAt, rowIn(link.from.table, link.from.column), link.at);
  }
  let linkHint: ReactNode = null;
  if (linkFrom) {
    const mono = (text: string) => (
      <span className="ss-mono" style={{ color: 'var(--ink-1)' }}>
        {text}
      </span>
    );
    if (linkProblem) linkHint = linkProblem;
    else if (linkTo) {
      linkHint = <span>{rich('canvas.linkAdd', { reference: mono(`${qualifiedName(linkFrom)} → ${qualifiedName(linkTo)}`) })}</span>;
    } else linkHint = <span>{rich('canvas.linkDrop', { column: mono(qualifiedName(linkFrom)) })}</span>;
  }

  const framed = frame && rectBetween(frame.from, frame.to);

  // The groups that have a table on the canvas, each with the tables of it that are shown.
  const shownGroups = groups
    .map((group) => ({ group, shown: tables.filter((t) => group.tables.includes(t.name)).map((t) => t.name) }))
    .filter((g) => g.shown.length > 0);

  /** The menu entries for what the tables show of their columns; for `names`, or for every table without them. */
  const columnItems = (names?: readonly string[]): MenuItem[] =>
    onShowColumns
      ? [
          { icon: 'key', label: t('columns.keys'), onSelect: () => onShowColumns('keys', names) },
          { icon: 'minus', label: t('columns.none'), onSelect: () => onShowColumns('none', names) },
          { icon: 'columns', label: t('columns.all'), onSelect: () => onShowColumns('all', names) },
          ...(names ? [] : [{ icon: 'filter' as const, label: t('columns.large'), onSelect: () => onShowColumns('large') }]),
        ]
      : [];

  const menuTable = menu ? menu.table : null;
  let items: (MenuItem | '-')[] | null = null;
  if (menu && menuTable === null) {
    const at = { x: snap((menu.x - offset.x) / zoom), y: snap((menu.y - offset.y) / zoom) };
    items = [{ icon: 'table', label: t('action.newTable'), onSelect: () => onNewTable?.(at) }];
    if (onArrange) {
      items.push({ icon: 'sparkle', label: chosen.length > 1 ? t('action.arrangeSelected') : t('action.arrange'), shortcut: '⇧A', onSelect: onArrange });
    }
    if (focused != null && onShowAll) items.push({ icon: 'eye', label: t('action.showAllTables'), onSelect: onShowAll });
    if (onGroups) items.push({ icon: 'folder', label: t('canvas.menu.groups'), onSelect: onGroups });
    if (onShowColumns) items.push('-', ...columnItems(chosen.length > 1 ? chosen : undefined));
    if (onInferRelations || onReviewInferred || onRemoveInferred) items.push('-');
    if (onInferRelations) items.push({ icon: 'link', label: t('action.inferRelationships'), onSelect: onInferRelations });
    if (onReviewInferred) items.push({ icon: 'check', label: t('canvas.menu.reviewInferred'), onSelect: onReviewInferred });
    if (onRemoveInferred) items.push({ icon: 'x', label: t('canvas.menu.removeInferred'), onSelect: onRemoveInferred });
  } else if (menuTable !== null) {
    const table = menuTable;
    items = menuItems
      ? menuItems(table, closeMenu)
      : [
          { icon: 'pencil', label: t('canvas.menu.rename'), shortcut: 'F2', onSelect: () => onRenameTable?.(table) },
          { icon: 'plus', label: t('action.addColumn'), shortcut: '⌘⏎', onSelect: () => onAddColumn?.(table) },
          { icon: 'link', label: t('canvas.menu.addForeignKey'), onSelect: () => onAddForeignKey?.(table) },
          { icon: 'copy', label: t('canvas.menu.duplicate'), shortcut: '⌘D', onSelect: () => onDuplicateTable?.(table) },
          '-',
          { icon: 'code', label: t('canvas.menu.copyCreate'), shortcut: '⇧⌘C', onSelect: () => onCopyCreateTable?.(table) },
          focused === table && onShowAll
            ? { icon: 'eye', label: t('action.showAllTables'), onSelect: onShowAll }
            : { icon: 'eye', label: t('canvas.menu.focus'), onSelect: () => onFocusRelated?.(table) },
          ...(onShowColumns ? ['-' as const, ...columnItems(isChosen.has(table) ? chosen : [table])] : []),
          '-',
          { icon: 'trash', label: t('action.deleteTable'), shortcut: '⌫', danger: true, onSelect: () => onDeleteTable?.(table) },
        ];
  }

  // A diagram of hundreds of tables is not drawn whole: only the tables near the visible area are, and
  // zoomed far out only their heads. The area moves in steps, so that panning does not redraw all the time.
  const culling = tables.length > LARGE_DIAGRAM;
  const lite = culling && zoom < LITE_ZOOM;
  const seen = viewRect(offset, zoom, size);
  const left = Math.floor((seen.x - CULL_MARGIN) / CULL_STEP) * CULL_STEP;
  const top = Math.floor((seen.y - CULL_MARGIN) / CULL_STEP) * CULL_STEP;
  const right = Math.ceil((seen.x + seen.w + CULL_MARGIN) / CULL_STEP) * CULL_STEP;
  const bottom = Math.ceil((seen.y + seen.h + CULL_MARGIN) / CULL_STEP) * CULL_STEP;
  const inView = useMemo(() => {
    if (!culling) return null;
    const window = { x: left, y: top, w: right - left, h: bottom - top };
    return new Set(nodeRects(tables, positions).filter((r) => r.x < left + window.w && r.x + r.w > left && r.y < top + window.h && r.y + r.h > top).map((r) => r.name));
  }, [culling, tables, positions, left, top, right, bottom]);
  const isShown = (name: string) =>
    !inView || inView.has(name) || isChosen.has(name) || !!dragged?.has(name) || !!resized?.has(name) || link?.from.table === name || link?.over?.table === name;
  const shownEdges = useMemo(() => {
    let list = edges;
    if (culling) {
      list = list.filter((e) => {
        const points = e.via ?? [e.a, e.b];
        const x1 = Math.min(...points.map((p) => p.x));
        const x2 = Math.max(...points.map((p) => p.x));
        const y1 = Math.min(...points.map((p) => p.y));
        const y2 = Math.max(...points.map((p) => p.y));
        return x1 < right && x2 > left && y1 < bottom && y2 > top;
      });
    }
    // While tables are translated live their lines would still end where they began: hide those until the drag commits.
    if (dragged) list = list.filter((e) => !dragged.has(e.from) && !dragged.has(e.to));
    return list;
  }, [culling, edges, left, top, right, bottom, dragged]);

  // The tables that stay clear when some are selected: those and the tables one foreign key from them.
  const chosenKey = chosen.join('\u0000');
  const related = useMemo(() => {
    if (!chosenKey) return null;
    const own = new Set(chosenKey.split('\u0000'));
    const names = new Set(own);
    for (const e of edges) {
      if (own.has(e.from)) names.add(e.to);
      if (own.has(e.to)) names.add(e.from);
    }
    return names;
  }, [chosenKey, edges]);
  const groupByTable = useMemo(() => new Map(groups.flatMap((g) => g.tables.map((name) => [name, g] as const)).reverse()), [groups]);
  const dirtySet = useMemo(() => (dirtyTables?.length ? new Set(dirtyTables) : NO_NAMES), [dirtyTables]);

  // Every table gets the same handlers from one render to the next, so that a table whose own props
  // did not change is not drawn again when the canvas is panned or another table is dragged.
  const handlersFor = useStableHandlers(
    { onNodeClick, onNodeDown, onColumnDown, onNodeMove, onNodeUp, onNodeMenu, onResizeDown, onResizeFit, onSelectColumn, onSelectTables },
    makeHandlers,
    !readOnly && !!onResizeTables,
  );

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
      aria-label={t('canvas.label')}
    >
      {onHubsAsTags && (
        <div className="ss-modbar" onPointerDown={(e) => e.stopPropagation()}>
          <span className="ss-modbar-pill">
            <Switch checked={!!hubsAsTags} onChange={onHubsAsTags} label={t('focus.hubsAsTags')} />
            {hubNote ? <span className="ss-modbar-k">{hubNote}</span> : null}
          </span>
        </div>
      )}
      <div ref={layerRef} className="ss-canvas-layer" style={{ transform: viewTransform({ offset, zoom }) }}>
        <svg className="ss-edges" width={1} height={1}>
          {shownEdges.map((e) => {
            const active = isChosen.has(e.from) || isChosen.has(e.to);
            const hot = pointed != null && (e.from === pointed || e.to === pointed);
            return <EdgeLine key={e.id} edge={e} mode={active ? 'active' : chosen.length > 0 ? 'dim' : 'plain'} hot={hot} notation={notation} />;
          })}
          {links.map((link) => {
            const from = tables.find((t) => t.name === link.from);
            const at = from ? positionOf(positions, from.name) : undefined;
            const stub = stubs.find((s) => s.table === link.to);
            if (!from || !at || !stub) return null;
            const start = stubAnchor(at, from, link.column);
            const hot = pointed === link.from || pointed === link.to;
            return (
              <path
                key={`${link.from}:${link.column}:${link.to}`}
                className={cx('ss-edge', 'is-stub', hot && 'is-hot')}
                d={edgePath({ ...start, side: 1 }, { x: stub.x, y: stub.y + 16, side: -1 })}
              />
            );
          })}
        </svg>
        {tables.map((t) => {
          const q = positionOf(positions, t.name);
          if (!q || !isShown(t.name)) return null;
          const chosenHere = isChosen.has(t.name);
          return (
            <TableNode
              key={t.name}
              table={t}
              x={q.x}
              y={q.y}
              width={q.w}
              cols={q.cols}
              lite={lite}
              selected={chosenHere}
              pointed={pointed === t.name}
              markedColumns={markedColumns?.get(t.name)}
              hubTags={hubTags}
              group={groupByTable.get(t.name)}
              // While a foreign key is drawn every table is one it may end on, and none is faded.
              dimmed={!!dimUnrelated && !!related && !related.has(t.name) && !link}
              dragging={!!dragged && dragged.has(t.name)}
              resizing={!!resized && resized.has(t.name)}
              dirty={dirtySet.has(t.name)}
              selectedColumn={chosenHere ? selectedColumn : null}
              invalidColumns={sel === t.name ? invalidColumns : null}
              linkColumn={link?.from.table === t.name ? link.from.column : link?.over?.table === t.name ? link.over.column : null}
              linkRefused={!!linkProblem && link?.over?.table === t.name}
              {...handlersFor(t.name)}
            />
          );
        })}
        {stubs.map((stub) => (
          <div key={stub.table} className="ss-stub" style={{ left: stub.x, top: stub.y }} data-table={stub.table}>
            <span className={cx('ss-stub-dot', stubColor && `ss-group--${stubColor(stub.module)}`)} />
            <span className="ss-stub-name">{stub.table}</span>
            <span className="ss-stub-module">{stub.module || t('explorer.other')}</span>
            <button
              type="button"
              className="ss-stub-show"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onShowStub?.(stub.table);
              }}
            >
              {t('explorer.stubShow')}
            </button>
          </div>
        ))}
        {/* Over the tables, unlike the lines of the relationships: the pointer is on a table when the line ends. */}
        {drawn && (
          <svg className="ss-edges" width={1} height={1}>
            <g className={cx('ss-edge-g', 'is-active', !linkEnd && 'is-open')}>
              <path className="ss-edge" d={edgePath(drawn.a, drawn.b)} />
              {linkEnd && <EdgeEnds {...drawn} notation={notation} />}
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
      {highlight && (
        <div className="ss-ex-pill" onPointerDown={(e) => e.stopPropagation()}>
          <span className="ss-ex-pill-dot" />
          {rich('explorer.highlight', {
            query: <b className="ss-mono">{highlight.query}</b>,
            count: highlight.count,
          })}
        </div>
      )}
      {showLegend !== false && (
        <div className="ss-canvas-notes">
          <div className="ss-legend">
            <span>
              <Icon name="key" size={12} style={{ color: 'var(--pk)' }} />
              {t('legend.primaryKey')}
            </span>
            <span>
              <Icon name="link" size={12} style={{ color: 'var(--fk)' }} />
              {t('legend.foreignKey')}
            </span>
            {edges.some((e) => e.inferred) && (
              <span>
                <svg className="ss-legend-edge" width={16} height={8} aria-hidden="true">
                  <path className="ss-edge" d="M0 4 H16" />
                </svg>
                {t('relation.inferred')}
              </span>
            )}
            <span>
              <b style={{ color: 'var(--ink-2)', fontWeight: 500 }}>?</b>
              {t('legend.nullable')}
            </span>
            <span>
              <b style={{ color: 'var(--ink-2)', fontWeight: 600, fontSize: 9.5 }}>UQ</b>
              {t('legend.unique')}
            </span>
          </div>
          {stubNote !== false && stubs.length > 0 && (
            <button type="button" className="ss-ex-stubnote" onPointerDown={(e) => e.stopPropagation()} onClick={onDismissStubNote}>
              <Icon name="folder" size={14} />
              <span>{t('explorer.stubNote')}</span>
            </button>
          )}
        </div>
      )}
      {showLegend !== false && shownGroups.length > 0 && (
        // The canvas takes a press on it as the start of a pan, and a click as one on the empty canvas.
        <div className="ss-legend-groups" aria-label={t('action.tableGroups')} onPointerDown={(e) => e.stopPropagation()}>
          {shownGroups.map(({ group, shown }) => (
            <button
              key={group.name}
              type="button"
              className={cx('ss-legend-group', `ss-group--${group.color}`, shown.length === chosen.length && shown.every((n) => isChosen.has(n)) && 'is-selected')}
              title={t('canvas.selectGroup', { count: shown.length, name: group.name })}
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
