import { describe, expect, it } from 'vitest';
import { versionLabel } from './versions';

describe('versionLabel', () => {
  it('prefixes the number with "v"', () => {
    expect(versionLabel(1)).toBe('v1');
    expect(versionLabel(12)).toBe('v12');
  });
});
