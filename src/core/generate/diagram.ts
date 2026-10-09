import { groupOf } from '../groups';
import { computeEdges, edgeEndPaths, edgePath, NODE_HEAD_HEIGHT, NODE_ROW_HEIGHT, nodeRects, type Rect } from '../layout';
import type { Column, GroupColor, SchemaSnapshot, Table } from '../model';
import { positionOf } from '../positions';

/** The colours a diagram is painted in: the tokens of the theme it is exported in. */
export interface DiagramColors {
  /** The canvas (`bg-1`). */
  background: string;
  /** A table (`bg-3`) and its border (`line-2`). */
  node: string;
  nodeBorder: string;
  /** The line under the head of a table (`line-1`). */
  rule: string;
  ink1: string;
  ink2: string;
  ink3: string;
  pk: string;
  fk: string;
  relation: string;
  /** The name of a column that has none yet (`removed`). */
  invalid: string;
  groups: Record<GroupColor, string>;
}

export interface DiagramOptions {
  /** Paints the colour of the canvas behind the tables. Without it the picture is see-through there. */
  background: boolean;
  /** `@font-face` rules that bring the mono face with them, for a picture that is drawn where the app's fonts are not. */
  fontCss?: string;
}

export interface Diagram {
  svg: string;
  width: number;
  height: number;
}

/** Room around the tables and their lines. */
const PADDING = 24;
/** What a diagram without a placed table measures. */
const EMPTY: Rect = { x: 0, y: 0, w: 320, h: 160 };
const FONT_FAMILY = "'Geist Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
const FONT_SIZE = 12;
/** A character of the mono face is this wide for each px of its size. */
const ADVANCE = 0.6;
const CH = FONT_SIZE * ADVANCE;
const COUNT_SIZE = 11;
const FLAG_SIZE = 9.5;
/** From the middle of a line of text to its baseline, for each px of its size. */
const BASELINE = 0.34;
const RADIUS = 8;
// A row of a table, as the styles lay it out: 10px at either side, the glyph of a key (14px), the
// name, the type and the flag (18px), 6px between them. The type keeps room for six characters.
const SIDE = 11;
const NAME_X = SIDE + 14 + 6;
/** Where the flag and the type of a row end in a table `w` wide, from its left side. */
const flagRight = (w: number) => w - SIDE;
const typeRight = (w: number) => flagRight(w) - 18 - 6;
/** How many characters the name and the type of a column have between them in a table `w` wide, and how many of them the type keeps. */
const rowChars = (w: number) => (typeRight(w) - NAME_X - 6) / CH;
const TYPE_CHARS = 6;

// The glyphs of the 24px icon set (see components/icons) that a table shows.
const TABLE_GLYPH = '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M9.5 9.5v10"/>';
const KEY_GLYPH = '<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16.5 6.5l2.5 2.5M14.5 8.5l2 2"/>';
const LINK_GLYPH =
  '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>';

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** A number as it is written in the picture: no more than two decimals. */
const n = (value: number) => String(Math.round(value * 100) / 100);

/** `text` cut to `chars` characters, the last of them an ellipsis when it was longer. */
export function fitText(text: string, chars: number): string {
  const room = Math.max(1, Math.floor(chars));
  return text.length <= room ? text : `${text.slice(0, room - 1)}…`;
}

/** The baseline of a line of text of `size` px whose middle is at `y`. */
const baseline = (y: number, size: number) => n(y + size * BASELINE);

function glyph(paths: string, x: number, y: number, size: number, color: string, opacity?: number): string {
  return `<g transform="translate(${n(x)} ${n(y)}) scale(${(size / 24).toFixed(4)})" fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"${opacity === undefined ? '' : ` opacity="${opacity}"`}>${paths}</g>`;
}

function row(column: Column, x: number, y: number, w: number, colors: DiagramColors): string {
  const chars = rowChars(w);
  const parts: string[] = [];
  if (column.pk) parts.push(glyph(KEY_GLYPH, x + SIDE, y - 6.5, 13, colors.pk));
  else if (column.fk) parts.push(glyph(LINK_GLYPH, x + SIDE, y - 6.5, 13, colors.fk, column.fk.inferred ? 0.55 : undefined));

  // The name is shown whole as long as the type keeps its six characters, and the type takes what is left.
  const named = column.name || 'unnamed';
  const name = fitText(named, chars - TYPE_CHARS);
  parts.push(
    `<text x="${n(x + NAME_X)}" y="${baseline(y, FONT_SIZE)}" fill="${column.name ? colors.ink1 : colors.invalid}"${column.name ? '' : ' font-style="italic"'}>${escape(name)}</text>`,
  );
  const typeEnd = x + typeRight(w) - (column.nullable ? CH : 0);
  const type = fitText(column.type || '—', Math.floor(chars - name.length) - (column.nullable ? 1 : 0));
  parts.push(`<text x="${n(typeEnd)}" y="${baseline(y, FONT_SIZE)}" text-anchor="end" fill="${colors.ink2}">${escape(type)}</text>`);
  if (column.nullable) {
    parts.push(`<text x="${n(x + typeRight(w))}" y="${baseline(y, FONT_SIZE)}" text-anchor="end" fill="${colors.ink3}">?</text>`);
  }
  if (column.unique) {
    parts.push(
      `<text x="${n(x + flagRight(w))}" y="${baseline(y, FLAG_SIZE)}" text-anchor="end" font-size="${FLAG_SIZE}" font-weight="600" fill="${colors.ink3}">UQ</text>`,
    );
  }
  return parts.join('');
}

function node(table: Table, rect: Rect, index: number, group: GroupColor | undefined, colors: DiagramColors): string {
  const { x, y, w, h } = rect;
  const parts: string[] = [
    `<rect x="${n(x + 0.5)}" y="${n(y + 0.5)}" width="${n(w - 1)}" height="${n(h - 1)}" rx="${RADIUS - 0.5}" fill="${colors.node}" stroke="${colors.nodeBorder}"/>`,
  ];
  if (group) {
    // The head of a table of a group is tinted with its colour, under a bar of it.
    const color = colors.groups[group];
    parts.push(
      `<clipPath id="t${index}"><rect x="${n(x + 1)}" y="${n(y + 1)}" width="${n(w - 2)}" height="${n(h - 2)}" rx="${RADIUS - 1}"/></clipPath>`,
      `<g clip-path="url(#t${index})"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${NODE_HEAD_HEIGHT}" fill="${color}" opacity="0.1"/><rect x="${n(x)}" y="${n(y + 1)}" width="${n(w)}" height="3" fill="${color}"/></g>`,
    );
  }
  const middle = y + 1 + (NODE_HEAD_HEIGHT - 1) / 2;
  const count = String(table.columns.length);
  const schema = table.schema && table.schema !== 'public' ? `${table.schema}.` : '';
  const nameX = x + SIDE + 14 + 7;
  const nameRoom = (x + flagRight(w) - count.length * COUNT_SIZE * ADVANCE - 7 - nameX) / CH;
  const name = fitText(schema + (table.name || 'unnamed'), nameRoom);
  const prefix = name.slice(0, Math.min(schema.length, name.length));
  parts.push(
    `<path d="M${n(x + 1)} ${n(y + NODE_HEAD_HEIGHT + 0.5)} H${n(x + w - 1)}" stroke="${colors.rule}"/>`,
    glyph(TABLE_GLYPH, x + SIDE, middle - 7, 14, colors.ink3),
    `<text x="${n(nameX)}" y="${baseline(middle, FONT_SIZE)}" font-weight="600" fill="${colors.ink1}">${prefix ? `<tspan fill="${colors.ink3}">${escape(prefix)}</tspan>` : ''}${escape(name.slice(prefix.length))}</text>`,
    `<text x="${n(x + flagRight(w))}" y="${baseline(middle, COUNT_SIZE)}" text-anchor="end" font-size="${COUNT_SIZE}" fill="${colors.ink3}">${count}</text>`,
  );
  table.columns.forEach((column, i) => {
    parts.push(row(column, x, y + NODE_HEAD_HEIGHT + i * NODE_ROW_HEIGHT + NODE_ROW_HEIGHT / 2 + 1, w, colors));
  });
  return `<g>${parts.join('')}</g>`;
}

/**
 * The diagram of a schema as an SVG picture: every placed table where it is on the canvas, with
 * its columns as the canvas shows them, the relationship lines (dashed for an inferred one) and
 * the colours of the groups. It is as large as the tables and lines take, with some room around
 * them, at one px for a unit of the canvas.
 */
export function generateDiagram(snapshot: SchemaSnapshot, colors: DiagramColors, options: DiagramOptions): Diagram {
  const { tables, positions } = snapshot;
  const groups = snapshot.groups ?? [];
  const rects = nodeRects(tables, positions);
  const edges = computeEdges(tables, positions);

  // What the picture has to hold: the tables, and the lines with the points that pull their curves.
  const xs = rects.flatMap((r) => [r.x, r.x + r.w]);
  const ys = rects.flatMap((r) => [r.y, r.y + r.h]);
  for (const e of edges) {
    const reach = Math.max(36, Math.abs(e.b.x - e.a.x) / 2);
    const points = e.via ?? [e.a, e.b, { x: e.a.x + e.a.side * reach, y: e.a.y }, { x: e.b.x + e.b.side * reach, y: e.b.y }];
    for (const p of points) {
      xs.push(p.x);
      ys.push(p.y);
    }
  }
  const box: Rect = rects.length
    ? {
        x: Math.floor(Math.min(...xs)) - PADDING,
        y: Math.floor(Math.min(...ys)) - PADDING,
        w: Math.ceil(Math.max(...xs)) - Math.floor(Math.min(...xs)) + 2 * PADDING,
        h: Math.ceil(Math.max(...ys)) - Math.floor(Math.min(...ys)) + 2 * PADDING,
      }
    : EMPTY;

  const lines = edges.map((e) => {
    const ends = edgeEndPaths(e);
    return `<path d="${edgePath(e.a, e.b, e.via)}"${e.inferred ? ' stroke-dasharray="5 4"' : ''}/><path d="${ends.one}"/><path d="${ends.many}"/>`;
  });
  const nodes = tables.flatMap((table, index) => {
    const p = positionOf(positions, table.name);
    const rect = rects.find((r) => r.name === table.name);
    return p && rect ? [node(table, rect, index, groupOf(groups, table.name)?.color, colors)] : [];
  });

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${box.w}" height="${box.h}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}" font-family="${FONT_FAMILY}" font-size="${FONT_SIZE}">`,
    ...(options.fontCss ? [`<style>${options.fontCss}</style>`] : []),
    ...(options.background ? [`<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="${colors.background}"/>`] : []),
    `<g fill="none" stroke="${colors.relation}" stroke-width="1.25">${lines.join('')}</g>`,
    ...nodes,
    '</svg>',
    '',
  ].join('\n');
  return { svg, width: box.w, height: box.h };
}

/** The longest side of a picture a browser draws, and how many px it may have in all. */
const MAX_SIDE = 16384;
const MAX_PIXELS = 64_000_000;

/**
 * The scale a diagram of `width` by `height` is drawn at as a PNG when `wanted` is asked for: that,
 * or as much of it as keeps the picture within what a browser can draw. Two decimals.
 */
export function imageScale(width: number, height: number, wanted: number): number {
  if (width <= 0 || height <= 0) return wanted;
  const scale = Math.min(wanted, MAX_SIDE / width, MAX_SIDE / height, Math.sqrt(MAX_PIXELS / (width * height)));
  return Math.floor(scale * 100) / 100;
}
