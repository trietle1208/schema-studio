import { useEffect } from 'react';
import { matchShortcut } from '../core/shortcuts';
import { useUiStore } from '../store/ui';
import { requestImport, requestNewSchema } from './schemaActions';
import { requestSettings } from './settingsActions';

/**
 * The shortcuts that work on every screen: ⌘N for a new schema, ⌘I to import one and ⌘, for the
 * settings (Ctrl outside macOS). In a browser tab the browser keeps ⌘N for a new window; it
 * reaches the app only where the browser lets it, such as an installed or desktop app.
 */
export function useAppShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const shortcut = matchShortcut(e);
      if (shortcut !== 'new-schema' && shortcut !== 'import' && shortcut !== 'settings') return;
      e.preventDefault();
      // An open dialog owns the keyboard.
      if (useUiStore.getState().dialog) return;
      if (shortcut === 'import') requestImport();
      else if (shortcut === 'settings') requestSettings();
      else requestNewSchema();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
