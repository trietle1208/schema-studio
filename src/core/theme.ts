import { t } from './i18n';

// The colours the app is painted in. Dark is the primary theme and what the tokens are without
// any attribute; light is `data-theme="light"` on <html> (see design-system/tokens.css).

export type Theme = 'dark' | 'light';

export const DEFAULT_THEME: Theme = 'dark';

/** The themes in the order the settings offer them. */
export const THEMES: readonly Theme[] = ['dark', 'light'];

/** The themes to pick from, each called what the language of the app calls it. */
export function themeOptions(): { value: Theme; label: string }[] {
  return [
    { value: 'dark', label: t('theme.dark') },
    { value: 'light', label: t('theme.light') },
  ];
}

/** Where the chosen theme is kept in the browser. index.html reads it too, before the first paint. */
export const THEME_STORAGE_KEY = 'schema-studio.theme';

/** The theme a stored or picked value stands for. Anything that is no theme, such as nothing stored yet, is the default. */
export function parseTheme(value: string | null | undefined): Theme {
  return THEMES.find((theme) => theme === value) ?? DEFAULT_THEME;
}
