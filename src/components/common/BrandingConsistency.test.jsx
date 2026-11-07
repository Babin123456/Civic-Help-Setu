import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../context/LanguageContext';
import { AuthProvider } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { NetworkProvider } from '../../context/NetworkContext';
import Footer from '../Footer';
import Navbar from '../Navbar';
import enLocale from '../../locales/en.json';

describe('Branding Consistency Regression Check (#563)', () => {
  it('en.json has updated brand names to Civic Help Setu', () => {
    expect(enLocale.nav.brand).toBe('Civic Help Setu');
    expect(enLocale.hero.subtitle).toContain('Civic Help Setu');
    expect(enLocale.footer.disclaimer).toContain('Civic Help Setu');

    // Confirm no legacy CivicBridge in visible en strings
    expect(enLocale.nav.brand).not.toContain('CivicBridge');
    expect(enLocale.hero.subtitle).not.toContain('CivicBridge');
    expect(enLocale.footer.disclaimer).not.toContain('CivicBridge');
  });

  it('Footer renders Civic Help Setu brand and disclaimer', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AuthProvider>
          <LanguageProvider>
            <Footer />
          </LanguageProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(html).toContain('Civic Help Setu');
    expect(html).toContain('Civic Help Setu is an independent, non-governmental civic tech platform.');
    expect(html).not.toContain('CivicBridge');
  });

  it('Navbar renders Civic Help Setu brand text in navigation', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ThemeProvider>
          <NetworkProvider>
            <AuthProvider>
              <LanguageProvider>
                <Navbar />
              </LanguageProvider>
            </AuthProvider>
          </NetworkProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(html).toContain('Civic Help Setu');
    expect(html).not.toContain('CivicBridge');
  });

  it('Verifies brand typography and accessibility markers in Footer', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AuthProvider>
          <LanguageProvider>
            <Footer />
          </LanguageProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(html).toContain('id="site-footer"');
    expect(html).toContain('aria-label="Site Footer"');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/open-source"');
    expect(html).toContain('href="/services"');
  });
});
