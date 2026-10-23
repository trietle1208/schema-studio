import { describe, expect, it } from 'vitest';
import { nextFit, splitShortcut, TOOLBAR_FIT_START, TOOLBAR_MAX_LEVEL, type ToolbarFit } from './toolbarFit';

/** A toolbar whose start needs 350px and has what the bar leaves it: `bar - taken`. */
const measure = (bar: number, taken: number, need = 350) => ({ bar, need, have: bar - taken });

describe('toolbar fit', () => {
  it('keeps everything while the start has the room it needs', () => {
    expect(nextFit(TOOLBAR_FIT_START, measure(1440, 1000))).toBe(TOOLBAR_FIT_START);
  });

  it('gives up one level for each measurement while the start is short', () => {
    let fit: ToolbarFit = TOOLBAR_FIT_START;
    // 1232px bar with 1110px taken by the rest: 122 left, 350 needed.
    for (const level of [1, 2, 3, 4]) {
      fit = nextFit(fit, measure(1232, 1110));
      expect(fit.level).toBe(level);
    }
    // There is no level past the last: the name is squeezed by ellipsis instead.
    expect(nextFit(fit, measure(1232, 1110))).toBe(fit);
    expect(fit.level).toBe(TOOLBAR_MAX_LEVEL);
  });

  it('takes a level back once the bar is as wide as the level before needed', () => {
    const narrow = nextFit(TOOLBAR_FIT_START, measure(1300, 1050)); // 250 left, 100 short
    expect(narrow.level).toBe(1);
    expect(narrow.relaxAt[1]).toBe(1300 + 100 + 4);
    // A little wider is not enough, the width where level 0 fits is.
    expect(nextFit(narrow, measure(1350, 1000))).toBe(narrow);
    expect(nextFit(narrow, measure(1404, 1000)).level).toBe(0);
  });

  it('does not flicker at the width where it gave a level up', () => {
    let fit = nextFit(TOOLBAR_FIT_START, measure(1300, 1050));
    expect(fit.level).toBe(1);
    // Back at the same width, with the room the lower level gave: it stays.
    fit = nextFit(fit, measure(1300, 900));
    expect(fit.level).toBe(1);
  });

  it('splits the keys off a label', () => {
    expect(splitShortcut('Zoom out (⌘−)')).toEqual({ label: 'Zoom out', shortcut: '⌘−' });
    expect(splitShortcut('Fit to screen (⇧1)')).toEqual({ label: 'Fit to screen', shortcut: '⇧1' });
    expect(splitShortcut('Share')).toEqual({ label: 'Share' });
    expect(splitShortcut('Columns (a) (b)')).toEqual({ label: 'Columns (a)', shortcut: 'b' });
  });
});
