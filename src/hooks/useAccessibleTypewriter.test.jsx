import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAccessibleTypewriter } from './useAccessibleTypewriter';

// Test component exposing hook outputs
function TestTypewriterComponent({ words, options = {} }) {
  const { text, currentWord, isPaused, prefersReduced } = useAccessibleTypewriter(words, options);
  return (
    <div data-testid="typewriter-box">
      <span data-testid="text">{text}</span>
      <span data-testid="current">{currentWord}</span>
      <span data-testid="paused">{isPaused ? 'paused' : 'running'}</span>
      <span data-testid="reduced">{prefersReduced ? 'reduced' : 'normal'}</span>
    </div>
  );
}

describe('useAccessibleTypewriter Hook (#564, #565)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof globalThis.window === 'undefined') {
      globalThis.window = globalThis;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders stable static text when prefers-reduced-motion is true', () => {
    globalThis.window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));

    const words = ['Government Services.', 'Public Systems.'];
    const html = renderToStaticMarkup(<TestTypewriterComponent words={words} />);

    expect(html).toContain('Government Services.');
    expect(html).toContain('reduced');
    expect(html).toContain('running');
  });

  it('provides default fallback for empty word lists', () => {
    globalThis.window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));

    const html = renderToStaticMarkup(
      <TestTypewriterComponent words={[]} options={{ staticFallback: 'Public Systems.' }} />
    );

    expect(html).toContain('Public Systems.');
  });
});
