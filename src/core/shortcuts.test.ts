import { describe, expect, it } from 'vitest';
import { matchShortcut } from './shortcuts';

describe('matchShortcut', () => {
  it('treats ⌘ and Ctrl as the same modifier', () => {
    expect(matchShortcut({ key: 's', metaKey: true })).toBe('save');
    expect(matchShortcut({ key: 's', ctrlKey: true })).toBe('save');
    expect(matchShortcut({ key: 'k', ctrlKey: true })).toBe('search');
    expect(matchShortcut({ key: 'n', ctrlKey: true })).toBe('new-schema');
    expect(matchShortcut({ key: 'N', metaKey: true })).toBe('new-schema');
    expect(matchShortcut({ key: 'z', metaKey: true })).toBe('undo');
    expect(matchShortcut({ key: 'z', metaKey: true, shiftKey: true })).toBe('redo');
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
    for (const key of ['s', 'z', 'k', 'Enter', 'Tab', ' ', 'F3']) {
      expect(matchShortcut({ key })).toBeNull();
    }
  });

  it('leaves other modifier combinations to the browser', () => {
    expect(matchShortcut({ key: 's', ctrlKey: true, shiftKey: true })).toBeNull();
    expect(matchShortcut({ key: 'k', ctrlKey: true, shiftKey: true })).toBeNull();
    expect(matchShortcut({ key: 'a', ctrlKey: true })).toBeNull();
    expect(matchShortcut({ key: 'Backspace', ctrlKey: true })).toBeNull();
    expect(matchShortcut({ key: 'Backspace', shiftKey: true })).toBeNull();
    expect(matchShortcut({ key: 'F2', shiftKey: true })).toBeNull();
  });

  it('never matches with Alt, which AltGr reports together with Ctrl', () => {
    expect(matchShortcut({ key: 's', ctrlKey: true, altKey: true })).toBeNull();
    expect(matchShortcut({ key: 'z', ctrlKey: true, altKey: true })).toBeNull();
    expect(matchShortcut({ key: 'Escape', altKey: true })).toBeNull();
  });
});
