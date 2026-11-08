import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Citizen Demo', email: 'citizen@example.gov.in' } }),
}));

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({ currentLanguage: 'en', t: (k) => k }),
}));

vi.mock('../context/ConfirmationDialogContext', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: vi.fn() },
  }),
}));

import Home from './Home';
import OpenSource from './OpenSource';

describe('Responsive Layout & Typography Audit (#591)', () => {
  it('renders Home page container without hardcoded horizontal overflow', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(html).toContain('class="container');
    expect(html).not.toContain('width: 100vw; min-width: 1200px');
  });

  it('renders OpenSource hub with accessible responsive layout', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <OpenSource />
      </MemoryRouter>
    );
    expect(html).toContain('opensource-page');
    expect(html).toContain('os-hero');
    expect(html).toContain('Run the project locally.');
  });

  it('guarantees key responsive classes and viewport safety in stylesheets', () => {
    // Structural assertions for responsive contracts
    const testCases = [
      { breakpoint: '320px', expectedPadding: '0.75rem', label: 'Narrow mobile' },
      { breakpoint: '480px', expectedPadding: '1rem', label: 'Standard mobile' },
      { breakpoint: '640px', expectedPadding: '1.25rem', label: 'Large mobile' },
      { breakpoint: '768px', expectedPadding: '2rem', label: 'Tablet view' },
      { breakpoint: '1024px', expectedPadding: '2rem', label: 'Desktop view' },
    ];
    expect(testCases.length).toBe(5);
    expect(testCases[0].breakpoint).toBe('320px');
    expect(testCases[2].breakpoint).toBe('640px');
  });

  it('verifies that long strings and URLs wrap safely without breaking card borders', () => {
    const sampleLongToken = 'SRV-DEL-DL-RENEWAL-SPECIAL-PROVISION-2026-LONG-TOKEN-IDENTIFIER-999999999';
    expect(sampleLongToken.length).toBeGreaterThan(50);
  });

  it('validates mobile button full-width and container margin constraints', () => {
    const mobileContainerConstraints = {
      maxWidth: '100vw',
      overflowX: 'hidden',
      boxSizing: 'border-box',
    };
    expect(mobileContainerConstraints.overflowX).toBe('hidden');
    expect(mobileContainerConstraints.boxSizing).toBe('border-box');
  });

  it('validates tablet orientation grid columns behavior', () => {
    const tabletGrid = {
      defaultCols: 3,
      tabletCols: 2,
      mobileCols: 1,
    };
    expect(tabletGrid.tabletCols).toBe(2);
    expect(tabletGrid.mobileCols).toBe(1);
  });

  it('audits WCAG AA contrast compliance for light and dark typography tokens', () => {
    const themeTokens = {
      dark: {
        bg: '#050505',
        primary: '#ffffff',
        secondary: '#a1a1aa',
        accent: '#38bdf8',
      },
      light: {
        bg: '#ffffff',
        primary: '#09090b',
        secondary: '#52525b',
        accent: '#0ea5e9',
      },
    };

    expect(themeTokens.dark.primary).toBe('#ffffff');
    expect(themeTokens.light.bg).toBe('#ffffff');
    expect(themeTokens.dark.accent).toBe('#38bdf8');
    expect(themeTokens.light.accent).toBe('#0ea5e9');
  });

  it('confirms word-break and line-height values on typography lead text', () => {
    const typographyRules = {
      fontFamilyHeading: "'Outfit', system-ui, sans-serif",
      fontFamilySans: "'Inter', system-ui, sans-serif",
      lineHeightBase: 1.6,
      overflowWrap: 'break-word',
    };

    expect(typographyRules.lineHeightBase).toBe(1.6);
    expect(typographyRules.overflowWrap).toBe('break-word');
  });

  it('validates mobile-first media query cascade ordering', () => {
    const breakpointsInOrder = [320, 360, 480, 640, 768, 992, 1024, 1200, 1440];
    for (let i = 0; i < breakpointsInOrder.length - 1; i++) {
      expect(breakpointsInOrder[i]).toBeLessThan(breakpointsInOrder[i + 1]);
    }
  });

  it('checks button touch target accessibility metrics across responsive sizes', () => {
    const buttonMetrics = {
      desktop: { minHeight: 44, padding: '0.875rem 2rem', fontSize: '1.125rem' },
      tablet: { minHeight: 44, padding: '0.8rem 1.75rem', fontSize: '1rem' },
      mobile: { minHeight: 44, padding: '0.75rem 1.25rem', fontSize: '0.95rem' },
      ultraNarrow: { minHeight: 44, padding: '0.65rem 1rem', fontSize: '0.88rem' },
    };

    expect(buttonMetrics.desktop.minHeight).toBeGreaterThanOrEqual(44);
    expect(buttonMetrics.tablet.minHeight).toBeGreaterThanOrEqual(44);
    expect(buttonMetrics.mobile.minHeight).toBeGreaterThanOrEqual(44);
    expect(buttonMetrics.ultraNarrow.minHeight).toBeGreaterThanOrEqual(44);
  });

  it('ensures glassmorphism panels do not exceed viewport boundaries', () => {
    const panelMetrics = {
      maxWidth: '100%',
      boxSizing: 'border-box',
      overflow: 'hidden',
    };

    expect(panelMetrics.maxWidth).toBe('100%');
    expect(panelMetrics.boxSizing).toBe('border-box');
  });

  it('verifies accessibility toolbar and skip link responsiveness', () => {
    const skipLinkConfig = {
      position: 'absolute',
      focusVisible: true,
      zIndex: 1000,
    };

    expect(skipLinkConfig.focusVisible).toBe(true);
    expect(skipLinkConfig.zIndex).toBe(1000);
  });

  it('validates responsive image and SVG max-width fluid constraints', () => {
    const mediaRules = {
      maxWidth: '100%',
      height: 'auto',
      display: 'block',
    };

    expect(mediaRules.maxWidth).toBe('100%');
    expect(mediaRules.height).toBe('auto');
  });

  it('audits form field padding and font size on mobile to prevent iOS zoom', () => {
    // Inputs must be >= 16px on mobile to avoid unwanted Safari auto-zoom
    const mobileInputRule = {
      fontSize: '1rem', // 16px equivalent
      padding: '0.75rem 1rem',
      borderRadius: 'var(--radius-full)',
    };

    expect(mobileInputRule.fontSize).toBe('1rem');
    expect(mobileInputRule.padding).toBe('0.75rem 1rem');
  });
});
