import { create } from 'zustand';
import { DEFAULT_THEME, parseTheme, THEME_STORAGE_KEY, type Theme } from '../core/theme';

// What the user set for the app itself. It is kept in this browser and is not part of any schema.

export interface SettingsState {
  theme: Theme;
  /** Paints the app in `theme` at once and keeps the choice for the next visit. */
  setTheme: (theme: Theme) => void;
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

export const useSettingsStore = create<SettingsState>()((set) => ({
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
}));

// index.html has applied the stored theme before the first paint; this keeps the page and the store in step.
applyTheme(useSettingsStore.getState().theme);
