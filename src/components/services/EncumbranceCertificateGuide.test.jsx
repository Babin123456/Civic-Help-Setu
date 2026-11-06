import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EncumbranceCertificateGuide from './EncumbranceCertificateGuide';

describe('EncumbranceCertificateGuide Component (#522)', () => {
  it('renders scannable Encumbrance Certificate guide with Form 15 vs 16 explanation', () => {
    const html = renderToStaticMarkup(<EncumbranceCertificateGuide />);

    expect(html).toContain('Encumbrance Certificate (EC) Application Guide');
    expect(html).toContain('Form 15: Transactions Found');
    expect(html).toContain('Form 16: Zero Transactions Found');
    expect(html).toContain('What an Encumbrance Certificate (EC) Proves vs. Does Not Prove');
  });

  it('renders statutory authority and navigation tabs', () => {
    const html = renderToStaticMarkup(<EncumbranceCertificateGuide />);

    expect(html).toContain('Registration Act, 1908 (Sec 57)');
    expect(html).toContain('Sub-Registrar Office (Book 1 Search)');
    expect(html).toContain('Search Period Selection');
    expect(html).toContain('Title Limitations &amp; Caveats');
    expect(html).toContain('State Registration Portals');
  });
});
