// How the workspace toolbar gives way when it is too narrow for what it holds. The breadcrumb
// "Schemas › <schema>" is the part that is squeezed, by ellipsis on the schema name, down to
// `TOOLBAR_NAME_MIN`. Before it goes below that, the other end of the bar gives up room, one step
// at a time. Nothing in the bar ever paints over another part.

/** The narrowest the schema name gets, in px, before the bar takes something else out of its way. */
export const TOOLBAR_NAME_MIN = 80;

/**
 * 0 shows everything. 1 puts the zoom tools in a ⋯ menu. 2 also makes Export an icon and the
 * search box narrower. 3 also puts undo, redo, history and share in the ⋯ menu and takes the keys
 * off Save. 4 also leaves out the engine badge, which the status bar names too.
 */
export type ToolbarLevel = 0 | 1 | 2 | 3 | 4;

export const TOOLBAR_MAX_LEVEL: ToolbarLevel = 4;

export interface ToolbarFit {
  level: ToolbarLevel;
  /**
   * For each level above 0, the width of the bar at which the level before it fits again. Set
   * when the bar moves to the level.
   */
  relaxAt: readonly number[];
}

export const TOOLBAR_FIT_START: ToolbarFit = { level: 0, relaxAt: [0, 0, 0, 0, 0] };

export interface ToolbarMeasure {
  /** The width of the bar. */
  bar: number;
  /** What the breadcrumb, badges and save status need with the schema name at its least. */
  need: number;
  /** What they have. */
  have: number;
}

/** Room that is not worth a change of level. */
const SLACK = 0.5;

/** Extra width the bar must have before a level that was given up is taken back, so it does not flicker. */
const MARGIN = 4;

/**
 * The step after a measurement: one level more when the start of the bar is short of room, one
 * level less when the bar has grown to what the level before needed, and otherwise the same.
 */
export function nextFit(fit: ToolbarFit, measure: ToolbarMeasure): ToolbarFit {
  const short = measure.need - measure.have;
  if (short > SLACK && fit.level < TOOLBAR_MAX_LEVEL) {
    const level = (fit.level + 1) as ToolbarLevel;
    const relaxAt = fit.relaxAt.slice();
    relaxAt[level] = measure.bar + short + MARGIN;
    return { level, relaxAt };
  }
  if (fit.level > 0 && measure.bar >= fit.relaxAt[fit.level]) {
    return { level: (fit.level - 1) as ToolbarLevel, relaxAt: fit.relaxAt };
  }
  return fit;
}

/** `Zoom out (⌘−)` as the text and the keys, so a menu item can set them apart. */
export function splitShortcut(label: string): { label: string; shortcut?: string } {
  const match = /^(.*\S) \(([^()]+)\)$/.exec(label);
  return match ? { label: match[1], shortcut: match[2] } : { label };
}
