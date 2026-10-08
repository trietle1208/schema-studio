import { describe, expect, it } from 'vitest';
import { matchShortcut } from './shortcuts';

describe('matchShortcut', () => {
  it('treats ⌘ and Ctrl as the same modifier', () => {
    expect(matchShortcut({ key: 's', metaKey: true })).toBe('save');
    expect(matchShortcut({ key: 's', ctrlKey: true })).toBe('save');
    expect(matchShortcut({ key: 'k', ctrlKey: true })).toBe('search');
    expect(matchShortcut({ key: 'n', ctrlKey: true })).toBe('new-schema');
    expect(matchShortcut({ key: 'N', metaKey: true })).toBe('new-schema');
    expect(matchShortcut({ key: 'i', ctrlKey: true })).toBe('import');
    expect(matchShortcut({ key: 'I', metaKey: true })).toBe('import');
    expect(matchShortcut({ key: ',', metaKey: true })).toBe('settings');
    expect(matchShortcut({ key: ',', ctrlKey: true })).toBe('settings');
    expect(matchShortcut({ key: 'z', metaKey: true })).toBe('undo');
    expect(matchShortcut({ key: 'z', metaKey: true, shiftKey: true })).toBe('redo');
    expect(matchShortcut({ key: 'Enter', metaKey: true })).toBe('add-column');
    expect(matchShortcut({ key: 'Enter', ctrlKey: true })).toBe('add-column');
    expect(matchShortcut({ key: 'C', metaKey: true, shiftKey: true })).toBe('copy-create-table');
    expect(matchShortcut({ key: 'c', ctrlKey: true, shiftKey: true })).toBe('copy-create-table');
    expect(matchShortcut({ key: 'd', metaKey: true })).toBe('duplicate');
    expect(matchShortcut({ key: 'D', ctrlKey: true })).toBe('duplicate');
    expect(matchShortcut({ key: 'h', metaKey: true })).toBe('history');
    expect(matchShortcut({ key: 'h', ctrlKey: true })).toBe('history');
  });

  it('matches the zoom keys wherever + and − are on the keyboard', () => {
    // ⌘+ is ⌘⇧= on a US keyboard, where ⌘= does the same; the number pad has a + of its own.
    expect(matchShortcut({ key: '+', code: 'Equal', ctrlKey: true, shiftKey: true })).toBe('zoom-in');
    expect(matchShortcut({ key: '=', code: 'Equal', ctrlKey: true })).toBe('zoom-in');
    expect(matchShortcut({ key: '+', code: 'NumpadAdd', metaKey: true })).toBe('zoom-in');
    expect(matchShortcut({ key: '-', code: 'Minus', ctrlKey: true })).toBe('zoom-out');
    expect(matchShortcut({ key: '-', code: 'NumpadSubtract', metaKey: true })).toBe('zoom-out');
    expect(matchShortcut({ key: '0', code: 'Digit0', ctrlKey: true })).toBe('zoom-reset');
    expect(matchShortcut({ key: '0', code: 'Numpad0', metaKey: true })).toBe('zoom-reset');
  });

  it('matches ⇧1 and ⇧A, which need Shift alone', () => {
    expect(matchShortcut({ key: '!', code: 'Digit1', shiftKey: true })).toBe('fit');
    // A keyboard that has the digits under Shift, and an event without the physical key.
    expect(matchShortcut({ key: '1', code: 'Digit1', shiftKey: true })).toBe('fit');
    expect(matchShortcut({ key: '!', shiftKey: true })).toBe('fit');
    expect(matchShortcut({ key: 'A', code: 'KeyA', shiftKey: true })).toBe('arrange');
    // Shift under Caps Lock gives the small letter.
    expect(matchShortcut({ key: 'a', code: 'KeyA', shiftKey: true })).toBe('arrange');
  });

  it('ignores the case Shift and Caps Lock give the key', () => {
    expect(matchShortcut({ key: 'Z', ctrlKey: true, shiftKey: true })).toBe('redo');
    expect(matchShortcut({ key: 'S', ctrlKey: true })).toBe('save');
  });

  it('matches the keys that need no modifier', () => {
    expect(matchShortcut({ key: 'F2' })).toBe('rename');
    expect(matchShortcut({ key: 'Backspace' })).toBe('delete');
    expect(matchShortcut({ key: 'Delete' })).toBe('delete');
    expect(matchShortcut({ key: 'Escape' })).toBe('cancel');
  });

  it('does not match plain typing', () => {
    for (const key of ['s', 'z', 'k', 'i', 'd', 'h', 'a', '1', '0', '-', '+', '=', ',', 'Enter', 'Tab', ' ', 'F3']) {
      expect(matchShortcut({ key })).toBeNull();
    }
    // Caps Lock gives the capital without Shift.
    expect(matchShortcut({ key: 'A', code: 'KeyA' })).toBeNull();
    expect(matchShortcut({ key: 'B', code: 'KeyB', shiftKey: true })).toBeNull();
    expect(matchShortcut({ key: '@', code: 'Digit2', shiftKey: true })).toBeNull();
  });

  it('leaves other modifier combinations to the browser', () => {
    expect(matchShortcut({ key: 's', ctrlKey: true, shiftKey: true })).toBeNull();
    expect(matchShortcut({ key: 'k', ctrlKey: true, shiftKey: true })).toBeNull();
    expect(matchShortcut({ key: 'i', ctrlKey: true, shiftKey: true })).toBeNull();
    expect(matchShortcut({ key: 'a', ctrlKey: true })).toBeNull();
    // ⌘C copies the selected text; only ⇧⌘C copies the CREATE TABLE.
    expect(matchShortcut({ key: 'c', ctrlKey: true })).toBeNull();
    expect(matchShortcut({ key: 'Enter', ctrlKey: true, shiftKey: true })).toBeNull();
    expect(matchShortcut({ key: 'Backspace', ctrlKey: true })).toBeNull();
    expect(matchShortcut({ key: 'Backspace', shiftKey: true })).toBeNull();
    expect(matchShortcut({ key: 'F2', shiftKey: true })).toBeNull();
    // ⇧⌘D bookmarks every tab, ⇧⌘H is the browser's home page, ⇧⌘A its tab search.
    expect(matchShortcut({ key: 'D', ctrlKey: true, shiftKey: true })).toBeNull();
    expect(matchShortcut({ key: 'H', ctrlKey: true, shiftKey: true })).toBeNull();
    expect(matchShortcut({ key: 'A', code: 'KeyA', ctrlKey: true, shiftKey: true })).toBeNull();
    expect(matchShortcut({ key: '!', code: 'Digit1', ctrlKey: true, shiftKey: true })).toBeNull();
    expect(matchShortcut({ key: '1', code: 'Digit1', ctrlKey: true })).toBeNull();
    expect(matchShortcut({ key: '_', code: 'Minus', ctrlKey: true, shiftKey: true })).toBeNull();
    expect(matchShortcut({ key: ')', code: 'Digit0', ctrlKey: true, shiftKey: true })).toBeNull();
  });

  it('never matches with Alt, which AltGr reports together with Ctrl', () => {
    expect(matchShortcut({ key: 's', ctrlKey: true, altKey: true })).toBeNull();
    expect(matchShortcut({ key: 'z', ctrlKey: true, altKey: true })).toBeNull();
    expect(matchShortcut({ key: 'Escape', altKey: true })).toBeNull();
    expect(matchShortcut({ key: 'A', code: 'KeyA', shiftKey: true, altKey: true })).toBeNull();
    expect(matchShortcut({ key: '0', ctrlKey: true, altKey: true })).toBeNull();
  });
});
