import { describe, expect, it } from 'vitest';
import { clampPanelWidth, formatPanelWidths, INITIAL_PANEL_WIDTHS, MIN_MAIN_WIDTH, panelRoom, PANELS, parsePanelWidths } from './panels';

describe('clampPanelWidth', () => {
  it('keeps a panel between its narrowest and its widest, in whole px', () => {
    expect(clampPanelWidth('sidebar', 300)).toBe(300);
    expect(clampPanelWidth('sidebar', 300.6)).toBe(301);
    expect(clampPanelWidth('sidebar', 10)).toBe(PANELS.sidebar.min);
    expect(clampPanelWidth('sidebar', 5000)).toBe(PANELS.sidebar.max);
    expect(clampPanelWidth('inspector', -40)).toBe(PANELS.inspector.min);
    expect(clampPanelWidth('inspector', 5000)).toBe(PANELS.inspector.max);
    expect(clampPanelWidth('inspector', NaN)).toBe(PANELS.inspector.initial);
  });

  it('is within the limits for the width a panel has by itself', () => {
    for (const panel of ['sidebar', 'inspector'] as const) {
      expect(clampPanelWidth(panel, PANELS[panel].initial)).toBe(PANELS[panel].initial);
    }
  });

  it('leaves the canvas its room in a narrow window, down to the narrowest the panel can be', () => {
    // A 1440px window with the sidebar as it is: the inspector can be all it can.
    expect(clampPanelWidth('inspector', 700, panelRoom(1440, 248))).toBe(700);
    // In a 1100px window it gets what the sidebar and the canvas leave.
    expect(panelRoom(1100, 248)).toBe(1100 - 248 - MIN_MAIN_WIDTH);
    expect(clampPanelWidth('inspector', 700, panelRoom(1100, 248))).toBe(452);
    expect(clampPanelWidth('inspector', 700, panelRoom(800, 248))).toBe(PANELS.inspector.min);
    expect(clampPanelWidth('sidebar', 400, panelRoom(900, 352))).toBe(PANELS.sidebar.min);
  });
});

describe('parsePanelWidths', () => {
  it('reads what was stored', () => {
    const widths = { sidebar: 300, inspector: 480 };
    expect(parsePanelWidths(formatPanelWidths(widths))).toEqual(widths);
    expect(parsePanelWidths('{"inspector":500}')).toEqual({ sidebar: PANELS.sidebar.initial, inspector: 500 });
  });

  it('gives the widths the panels have by themselves for anything else', () => {
    for (const value of [null, undefined, '', 'wide', '[]', '12', '{"sidebar":"300"}', '{"sidebar":null,"inspector":true}']) {
      expect(parsePanelWidths(value)).toEqual(INITIAL_PANEL_WIDTHS);
    }
  });

  it('brings a stored width that a panel cannot have within its limits', () => {
    expect(parsePanelWidths('{"sidebar":20,"inspector":9000}')).toEqual({ sidebar: PANELS.sidebar.min, inspector: PANELS.inspector.max });
    // A panel may be called anything an object has by itself.
    expect(parsePanelWidths('{"__proto__":{"sidebar":300}}')).toEqual(INITIAL_PANEL_WIDTHS);
  });
});
