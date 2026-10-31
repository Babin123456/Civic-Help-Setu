import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FONT_SCALE_OPTIONS,
  LINE_SPACING_OPTIONS,
  READER_THEMES,
  DEFAULT_READER_PREFERENCES,
  getReaderPreferences,
  saveReaderPreferences,
  computeReaderStyle,
} from './accessibleReaderService';

function makeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  };
}

describe('accessibleReaderService', () => {
  let storage;

  beforeEach(() => {
    storage = makeStorage();
    vi.stubGlobal('localStorage', storage);
  });

  it('exposes font scale options, line spacing options, and high-contrast themes', () => {
    expect(FONT_SCALE_OPTIONS.length).toBeGreaterThanOrEqual(4);
    expect(LINE_SPACING_OPTIONS.length).toBe(3);
    expect(READER_THEMES.length).toBeGreaterThanOrEqual(4);
  });

  it('returns default preferences when none are stored', () => {
    const prefs = getReaderPreferences();
    expect(prefs.fontSizeScale).toBe('100');
    expect(prefs.lineSpacing).toBe('normal');
    expect(prefs.dyslexiaFont).toBe(false);
    expect(prefs.themeId).toBe('default');
  });

  it('saves and round-trips updated preferences', () => {
    saveReaderPreferences({
      fontSizeScale: '130',
      lineSpacing: 'relaxed',
      dyslexiaFont: true,
      themeId: 'amber-dark',
    });
    const loaded = getReaderPreferences();
    expect(loaded.fontSizeScale).toBe('130');
    expect(loaded.lineSpacing).toBe('relaxed');
    expect(loaded.dyslexiaFont).toBe(true);
    expect(loaded.themeId).toBe('amber-dark');
  });

  it('computes correct CSS styles for dyslexia font and themes', () => {
    const defaultStyles = computeReaderStyle(DEFAULT_READER_PREFERENCES);
    expect(defaultStyles.fontSize).toBe('1em');
    expect(defaultStyles.lineHeight).toBe('1.5');
    expect(defaultStyles.fontFamily).toBeUndefined();

    const dyslexicStyles = computeReaderStyle({
      fontSizeScale: '150',
      lineSpacing: 'spacious',
      dyslexiaFont: true,
      themeId: 'amber-dark',
    });
    expect(dyslexicStyles.fontSize).toBe('1.5em');
    expect(dyslexicStyles.lineHeight).toBe('2.1');
    expect(dyslexicStyles.fontFamily).toContain('sans-serif');
    expect(dyslexicStyles.letterSpacing).toBe('0.05em');
    expect(dyslexicStyles.backgroundColor).toBe('#121212');
    expect(dyslexicStyles.color).toBe('#fcd34d');
  });
});
