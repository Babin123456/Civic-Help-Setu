import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LandRecordGuide from './LandRecordGuide';

describe('LandRecordGuide Component (#518)', () => {
  it('renders scannable Land Record RoR guide with legal framework and presumptive title', () => {
    const html = renderToStaticMarkup(<LandRecordGuide />);

    expect(html).toContain('Land Record Record-of-Rights (RoR) &amp; Certified Extract Guide');
    expect(html).toContain('The Record-of-Rights (RoR) Concept');
    expect(html).toContain('Presumptive Title in India');
    expect(html).toContain('What an RoR Record Proves vs. Does Not Prove');
  });

  it('renders state specific land record systems and DILRMP references', () => {
    const html = renderToStaticMarkup(<LandRecordGuide />);

    expect(html).toContain('DILRMP (Digital India Land Records)');
    expect(html).toContain('State Land Revenue Codes');
    expect(html).toContain('Village Level: Talathi / Patwari / Village Administrative Officer (VAO)');
  });
});
