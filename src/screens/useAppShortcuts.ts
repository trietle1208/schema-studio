import { useEffect } from 'react';
import { matchShortcut } from '../core/shortcuts';
import { useUiStore } from '../store/ui';
import { requestImport, requestNewSchema } from './schemaActions';

/**
 * The shortcuts that work on every screen: ⌘N for a new schema and ⌘I to import one (Ctrl outside
 * macOS). In a browser tab the browser keeps ⌘N for a new window; it reaches the app only where
 * the browser lets it, such as an installed or desktop app.
 */
export function useAppShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const shortcut = matchShortcut(e);
      if (shortcut !== 'new-schema' && shortcut !== 'import') return;
      e.preventDefault();
      // An open dialog owns the keyboard.
      if (useUiStore.getState().dialog) return;
      if (shortcut === 'import') requestImport();
      else requestNewSchema();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
