import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import VehicleRcGuide from './VehicleRcGuide';

describe('VehicleRcGuide Component (#517)', () => {
  it('renders scannable Vehicle RC guide with statutory mandates and liabilities', () => {
    const html = renderToStaticMarkup(<VehicleRcGuide />);

    expect(html).toContain('Vehicle Registration Certificate (RC) &amp; Transfer Guide');
    expect(html).toContain('Statutory Ownership &amp; Third-Party Liability');
    expect(html).toContain('Unified Vahan 4.0 Architecture');
    expect(html).toContain('What a Registration Certificate (RC) Proves vs. Does Not Prove');
  });

  it('renders official portal and Vahan references', () => {
    const html = renderToStaticMarkup(<VehicleRcGuide />);

    expect(html).toContain('vahan.parivahan.gov.in');
    expect(html).toContain('Motor Vehicles Act, 1988 (Sec 39 - 65)');
    expect(html).toContain('Regional Transport Office (RTO) / Registering Authority');
  });
});
