/**
 * Accessible Reading Mode & Cognitive Typography Service.
 *
 * Implements WCAG 2.1 AAA contrast and typography adjustments for civic procedures,
 * supporting citizens with dyslexia, low vision, and visual fatigue.
 */

export const READER_STORAGE_KEY = 'civicbridge_reader_preferences';

export const FONT_SCALE_OPTIONS = [
  { id: '100', label: '100% (Default)', factor: 1.0 },
  { id: '115', label: '115% (Medium)', factor: 1.15 },
  { id: '130', label: '130% (Large)', factor: 1.3 },
  { id: '150', label: '150% (Extra Large)', factor: 1.5 },
];

export const LINE_SPACING_OPTIONS = [
  { id: 'normal', label: '1.5x (Normal)', value: '1.5' },
  { id: 'relaxed', label: '1.8x (Relaxed)', value: '1.8' },
  { id: 'spacious', label: '2.1x (Spacious)', value: '2.1' },
];

export const READER_THEMES = [
  {
    id: 'default',
    label: 'App Default',
    bg: 'transparent',
    text: 'inherit',
    border: 'var(--border-light)',
  },
  {
    id: 'amber-dark',
    label: 'Amber on Dark',
    bg: '#121212',
    text: '#fcd34d',
    border: '#f59e0b',
  },
  {
    id: 'high-contrast-black',
    label: 'Pure Black & White',
    bg: '#000000',
    text: '#ffffff',
    border: '#ffffff',
  },
  {
    id: 'soft-sepia',
    label: 'Soft Warm Sepia',
    bg: '#fbf0d9',
    text: '#2d251e',
    border: '#d5c4a1',
  },
];

export const DEFAULT_READER_PREFERENCES = {
  fontSizeScale: '100',
  lineSpacing: 'normal',
  themeId: 'default',
  dyslexiaFont: false,
  rulerGuide: false,
};

/**
 * Loads persisted reader preferences safely.
 */
export function getReaderPreferences() {
  try {
    const raw = localStorage.getItem(READER_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_READER_PREFERENCES };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_READER_PREFERENCES, ...(parsed || {}) };
  } catch {
    return { ...DEFAULT_READER_PREFERENCES };
  }
}

/**
 * Saves reader preferences.
 */
export function saveReaderPreferences(prefs = {}) {
  try {
    const merged = { ...DEFAULT_READER_PREFERENCES, ...prefs };
    localStorage.setItem(READER_STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return prefs;
  }
}

/**
 * Computes CSS styles to be applied to the civic reading container.
 */
export function computeReaderStyle(prefs = {}) {
  const p = { ...DEFAULT_READER_PREFERENCES, ...prefs };
  const scaleOpt = FONT_SCALE_OPTIONS.find((s) => s.id === p.fontSizeScale) || FONT_SCALE_OPTIONS[0];
  const spacingOpt = LINE_SPACING_OPTIONS.find((s) => s.id === p.lineSpacing) || LINE_SPACING_OPTIONS[0];
  const themeOpt = READER_THEMES.find((t) => t.id === p.themeId) || READER_THEMES[0];

  const styles = {
    fontSize: `${scaleOpt.factor}em`,
    lineHeight: spacingOpt.value,
    transition: 'all 0.2s ease',
  };

  if (p.dyslexiaFont) {
    styles.fontFamily = 'Comic Sans MS, OpenDyslexic, sans-serif';
    styles.letterSpacing = '0.05em';
    styles.wordSpacing = '0.12em';
  }

  if (p.themeId !== 'default') {
    styles.backgroundColor = themeOpt.bg;
    styles.color = themeOpt.text;
    styles.padding = '1.5rem';
    styles.borderRadius = '0.75rem';
    styles.border = `1px solid ${themeOpt.border}`;
  }

  return styles;
}
