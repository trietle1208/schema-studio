import { useEffect } from 'react';
import { matchShortcut } from '../core/shortcuts';
import { useSettingsStore } from '../store/settings';
import { useUiStore } from '../store/ui';
import { requestImport, requestNewSchema } from './schemaActions';
import { requestSettings } from './settingsActions';
import { requestShortcuts } from './shortcutsActions';

/**
 * The shortcuts that work on every screen: ⌘N for a new schema, ⌘I to import one, ⌘, for the
 * settings, ⌘/ for all shortcuts and ⌘B to collapse the sidebar (Ctrl outside macOS). In a
 * browser tab the browser keeps ⌘N for a new window; it reaches the app only where the browser
 * lets it, such as an installed or desktop app.
 */
export function useAppShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const shortcut = matchShortcut(e);
      if (
        shortcut !== 'new-schema' &&
        shortcut !== 'import' &&
        shortcut !== 'settings' &&
        shortcut !== 'shortcuts' &&
        shortcut !== 'toggle-sidebar'
      ) {
        return;
      }
      e.preventDefault();
      // An open dialog owns the keyboard, except ⌘/ which opens the shortcuts list over it.
      if (useUiStore.getState().dialog && shortcut !== 'shortcuts') return;
      if (shortcut === 'import') requestImport();
      else if (shortcut === 'settings') requestSettings();
      else if (shortcut === 'shortcuts') requestShortcuts();
      else if (shortcut === 'toggle-sidebar') useSettingsStore.getState().toggleSidebar();
      else requestNewSchema();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
