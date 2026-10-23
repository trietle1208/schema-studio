export type Shortcut =
  | 'save'
  | 'undo'
  | 'redo'
  | 'search'
  | 'new-schema'
  | 'import'
  | 'settings'
  | 'shortcuts'
  | 'toggle-sidebar'
  | 'add-column'
  | 'copy-create-table'
  | 'duplicate'
  | 'history'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset'
  | 'fit'
  | 'arrange'
  | 'rename'
  | 'delete'
  | 'cancel';

/** The parts of a keyboard event a shortcut depends on. */
export interface KeyStroke {
  key: string;
  /** The physical key: ⇧1 types `!` on one keyboard and `1` on another. */
  code?: string;
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
    // + is ⇧= on most keyboards and a key of its own on the number pad: ⌘+ comes with Shift or without.
    if (key === '+' || key === '=') return 'zoom-in';
    if (e.shiftKey) return key === 'c' ? 'copy-create-table' : null;
    if (key === 'Enter') return 'add-column';
    if (key === 's') return 'save';
    if (key === 'k') return 'search';
    if (key === 'n') return 'new-schema';
    if (key === 'i') return 'import';
    if (key === ',') return 'settings';
    if (key === '/') return 'shortcuts';
    if (key === 'b') return 'toggle-sidebar';
    if (key === 'd') return 'duplicate';
    if (key === 'h') return 'history';
    if (key === '-') return 'zoom-out';
    if (key === '0') return 'zoom-reset';
    return null;
  }
  if (e.shiftKey) {
    // These two type a character: they are shortcuts only where no text is being typed.
    if (e.code === 'Digit1' || key === '!') return 'fit';
    if (key === 'a') return 'arrange';
    return null;
  }
  if (key === 'F2') return 'rename';
  if (key === 'Backspace' || key === 'Delete') return 'delete';
  if (key === 'Escape') return 'cancel';
  return null;
}

/**
 * ⌘1 to ⌘9: the first nine saved views, 1-based. ⌘0 stays the zoom reset. Shift and Alt are not
 * this, so ⇧1 still fits the diagram.
 */
export function matchViewIndex(e: KeyStroke): number | null {
  if (e.altKey || e.shiftKey || !(e.ctrlKey || e.metaKey)) return null;
  if (e.key.length === 1 && e.key >= '1' && e.key <= '9') return Number(e.key);
  const pad = e.code?.startsWith('Numpad') ? e.code.slice('Numpad'.length) : '';
  if (pad >= '1' && pad <= '9') return Number(pad);
  return null;
}
