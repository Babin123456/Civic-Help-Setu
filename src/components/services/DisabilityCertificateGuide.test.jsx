import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DisabilityCertificateGuide from './DisabilityCertificateGuide';

describe('DisabilityCertificateGuide Component (#509)', () => {
  it('renders scannable Disability Certificate & UDID guide and RPwD provisions', () => {
    const html = renderToStaticMarkup(<DisabilityCertificateGuide />);

    expect(html).toContain('Disability Certificate &amp; UDID Application Guide');
    expect(html).toContain('Rights of Persons with Disabilities Act, 2016');
    expect(html).toContain('21 Recognized Disabilities');
    expect(html).toContain('Benchmark Disability Threshold (40%)');
    expect(html).toContain('Swavlamban Portal');
  });
});
