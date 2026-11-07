import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';

describe('Home Page Hero Hierarchy & Accessibility (#564, #565)', () => {
  beforeEach(() => {
    if (typeof globalThis.window === 'undefined') {
      globalThis.window = globalThis;
    }
  });

  it('renders hero title and supports reduced-motion static rendering', () => {
    globalThis.window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    expect(html).toContain('Simplify Complex');
    expect(html).toContain('The New Standard for Civic Assistance');
    expect(html).toContain('Civic Help Setu translates bureaucratic processes');
    expect(html).toContain('How Civic Help Setu Works');

    // Confirm no legacy CivicBridge in visible markup
    expect(html).not.toContain('CivicBridge');
  });

  it('renders primary search and essential action buttons with balanced spacing', () => {
    globalThis.window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    expect(html).toContain('Explore All Guides');
    expect(html).toContain('Life-Event Navigator');
    expect(html).toContain('Try AI Assistant');
    expect(html).toContain('Offline Relief Camps &amp; SOS');
  });

  it('provides accessible pause/resume control for active animation', () => {
    globalThis.window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    expect(html).toContain('Pause Animation');
    expect(html).toContain('aria-label="Pause hero text animation"');
    expect(html).toContain('aria-live="polite"');
  });
});
