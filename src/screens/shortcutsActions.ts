import { useUiStore } from '../store/ui';

/** Keyboard shortcuts in the sidebar, and ⌘/ on every screen: opens the shortcuts dialog. */
export function requestShortcuts() {
  useUiStore.getState().openDialog({ kind: 'shortcuts' });
}
