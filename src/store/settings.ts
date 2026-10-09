import { create } from 'zustand';
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, parseLocale, setLocale, type Locale } from '../core/i18n';
import { DEFAULT_NOTATION, NOTATION_STORAGE_KEY, parseNotation, type Notation } from '../core/notation';
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
  locale: Locale;
  /** Makes the app speak `locale` at once and keeps the choice for the next visit. */
  setLocale: (locale: Locale) => void;
  /** How the ends of the relationship lines are drawn on the canvas and in a picture of the diagram. */
  notation: Notation;
  /** Draws the relationship lines in `notation` at once and keeps the choice for the next visit. */
  setNotation: (notation: Notation) => void;
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

/** The language chosen on an earlier visit. */
function storedLocale(): Locale {
  try {
    return parseLocale(localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** Messages are written in the language from here on (see core/i18n), and the page says which it is in. */
function applyLocale(locale: Locale) {
  setLocale(locale);
  document.documentElement.lang = locale;
}

/** The notation chosen on an earlier visit. */
function storedNotation(): Notation {
  try {
    return parseNotation(localStorage.getItem(NOTATION_STORAGE_KEY));
  } catch {
    return DEFAULT_NOTATION;
  }
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
  locale: storedLocale(),
  setLocale: (locale) => {
    applyLocale(locale);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // The language still holds until the page is closed.
    }
    set({ locale });
  },
  notation: storedNotation(),
  setNotation: (notation) => {
    try {
      localStorage.setItem(NOTATION_STORAGE_KEY, notation);
    } catch {
      // The notation still holds until the page is closed.
    }
    set({ notation });
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
// Before anything is rendered, so that the first screen is in the chosen language.
applyLocale(useSettingsStore.getState().locale);
applyPanels(useSettingsStore.getState().panels);
