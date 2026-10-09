import { create } from 'zustand';
import {
  clampPanelWidth,
  formatPanelWidths,
  PANEL_STORAGE_KEY,
  panelRoom,
  PANELS,
  parsePanelWidths,
  type Panel,
  type PanelWidths,
} from '../core/panels';
import { DEFAULT_THEME, parseTheme, THEME_STORAGE_KEY, type Theme } from '../core/theme';

// What the user set for the app itself. It is kept in this browser and is not part of any schema.

export interface SettingsState {
  theme: Theme;
  /** Paints the app in `theme` at once and keeps the choice for the next visit. */
  setTheme: (theme: Theme) => void;
  /** How wide the sidebar and the inspector are. */
  panels: PanelWidths;
  /**
   * Makes a panel `width` wide at once, as far as it can be and the window has room for it next
   * to the other panel, and keeps the width for the next visit.
   */
  setPanelWidth: (panel: Panel, width: number) => void;
}

/** The theme chosen on an earlier visit. A browser that keeps nothing, as in private mode, gives the default. */
function storedTheme(): Theme {
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

/** Dark is what the tokens are by themselves; light is an attribute on <html>. */
function applyTheme(theme: Theme) {
  if (theme === DEFAULT_THEME) delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

/** The widths the panels were given on an earlier visit. */
function storedPanels(): PanelWidths {
  try {
    return parsePanelWidths(localStorage.getItem(PANEL_STORAGE_KEY));
  } catch {
    return parsePanelWidths(null);
  }
}

/** The width of a panel is its token (`--w-sidebar`, `--w-inspector`), which the page has another value for once the panel was dragged. */
function applyPanels(panels: PanelWidths) {
  for (const panel of ['sidebar', 'inspector'] as const) {
    const style = document.documentElement.style;
    if (panels[panel] === PANELS[panel].initial) style.removeProperty(`--w-${panel}`);
    else style.setProperty(`--w-${panel}`, `${panels[panel]}px`);
  }
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  theme: storedTheme(),
  setTheme: (theme) => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The theme still holds until the page is closed.
    }
    set({ theme });
  },
  panels: storedPanels(),
  setPanelWidth: (panel, width) => {
    const { panels } = get();
    const other = panels[panel === 'sidebar' ? 'inspector' : 'sidebar'];
    const next = clampPanelWidth(panel, width, panelRoom(window.innerWidth, other));
    if (next === panels[panel]) return;
    const widths = { ...panels, [panel]: next };
    applyPanels(widths);
    try {
      localStorage.setItem(PANEL_STORAGE_KEY, formatPanelWidths(widths));
    } catch {
      // The width still holds until the page is closed.
    }
    set({ panels: widths });
  },
}));

// index.html has applied the stored theme before the first paint; this keeps the page and the store in step.
applyTheme(useSettingsStore.getState().theme);
applyPanels(useSettingsStore.getState().panels);
