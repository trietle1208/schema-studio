import { useUiStore } from '../store/ui';

/** Settings in the sidebar, and ⌘, on every screen: opens the Settings dialog. */
export function requestSettings() {
  useUiStore.getState().openDialog({ kind: 'settings' });
}
