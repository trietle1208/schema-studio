export type Shortcut = 'save' | 'undo' | 'redo' | 'search' | 'new-schema' | 'import' | 'settings' | 'rename' | 'delete' | 'cancel';

/** The parts of a keyboard event a shortcut depends on. */
export interface KeyStroke {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

/** The shortcut a key press stands for, if any. ⌘ on macOS and Ctrl elsewhere are the same modifier. */
export function matchShortcut(e: KeyStroke): Shortcut | null {
  // AltGr reports as Ctrl + Alt on Windows and types a character; it is never a shortcut.
  if (e.altKey) return null;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (e.ctrlKey || e.metaKey) {
    if (key === 'z') return e.shiftKey ? 'redo' : 'undo';
    if (e.shiftKey) return null;
    if (key === 's') return 'save';
    if (key === 'k') return 'search';
    if (key === 'n') return 'new-schema';
    if (key === 'i') return 'import';
    if (key === ',') return 'settings';
    return null;
  }
  if (e.shiftKey) return null;
  if (key === 'F2') return 'rename';
  if (key === 'Backspace' || key === 'Delete') return 'delete';
  if (key === 'Escape') return 'cancel';
  return null;
}
