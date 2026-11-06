import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PassportGuide from './PassportGuide';

describe('PassportGuide Component (#514)', () => {
  it('renders scannable Passport guide, scheme selection, and PSK milestones', () => {
    const html = renderToStaticMarkup(<PassportGuide />);

    expect(html).toContain('Indian Passport Issuance &amp; Re-issue Guide');
    expect(html).toContain('Passports Act, 1967');
    expect(html).toContain('Normal Scheme');
    expect(html).toContain('Tatkaal Scheme');
    expect(html).toContain('Passport Seva');
  });
});
