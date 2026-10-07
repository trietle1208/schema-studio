import { useEffect } from 'react';
import { matchShortcut } from '../core/shortcuts';
import { useUiStore } from '../store/ui';
import { requestNewSchema } from './schemaActions';

/**
 * The shortcuts that work on every screen: ⌘N (Ctrl + N outside macOS) for a new schema. In a
 * browser tab the browser keeps that key for a new window; it reaches the app only where the
 * browser lets it, such as an installed or desktop app.
 */
export function useAppShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (matchShortcut(e) !== 'new-schema') return;
      e.preventDefault();
      // An open dialog owns the keyboard.
      if (!useUiStore.getState().dialog) requestNewSchema();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
