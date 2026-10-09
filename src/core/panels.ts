// The panels at the two sides of the app, which are dragged wider or narrower. How wide they are
// is of this browser and not of a schema (see store/settings).

export type Panel = 'sidebar' | 'inspector';

export interface PanelBounds {
  /** The width the panel has by itself: its design token (`--w-sidebar`, `--w-inspector`). */
  initial: number;
  min: number;
  max: number;
}

export const PANELS: Readonly<Record<Panel, PanelBounds>> = {
  sidebar: { initial: 248, min: 200, max: 440 },
  inspector: { initial: 352, min: 320, max: 720 },
};

export type PanelWidths = Record<Panel, number>;

export const INITIAL_PANEL_WIDTHS: Readonly<PanelWidths> = { sidebar: PANELS.sidebar.initial, inspector: PANELS.inspector.initial };

/** What the panels leave of the window at least, for the canvas between them. */
export const MIN_MAIN_WIDTH = 400;

/** Where the widths of the panels are kept in the browser. */
export const PANEL_STORAGE_KEY = 'schema-studio.panels';

/**
 * The width a panel gets when `width` is wanted: whole px, no narrower and no wider than it can
 * be. `room` is what the window has for it, which it does not exceed either, as long as it stays
 * as wide as it must be.
 */
export function clampPanelWidth(panel: Panel, width: number, room: number = Infinity): number {
  const { initial, min, max } = PANELS[panel];
  if (!Number.isFinite(width)) return initial;
  return Math.round(Math.max(min, Math.min(width, max, room)));
}

/** What a window `viewport` wide has for a panel next to the other panel, which is `other` wide. */
export function panelRoom(viewport: number, other: number): number {
  return viewport - other - MIN_MAIN_WIDTH;
}

/** The widths that were stored. Anything that is no width, such as nothing stored yet, is the width the panel has by itself. */
export function parsePanelWidths(value: string | null | undefined): PanelWidths {
  let stored: unknown = null;
  try {
    stored = JSON.parse(value ?? 'null');
  } catch {
    // Not what `formatPanelWidths` writes.
  }
  const of = (panel: Panel) => {
    const width = stored !== null && typeof stored === 'object' && Object.hasOwn(stored, panel) ? (stored as Record<string, unknown>)[panel] : undefined;
    return typeof width === 'number' ? clampPanelWidth(panel, width) : PANELS[panel].initial;
  };
  return { sidebar: of('sidebar'), inspector: of('inspector') };
}

export function formatPanelWidths(widths: PanelWidths): string {
  return JSON.stringify({ sidebar: widths.sidebar, inspector: widths.inspector });
}
