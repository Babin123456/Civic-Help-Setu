import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DrivingLicenceGuide from './DrivingLicenceGuide';

describe('DrivingLicenceGuide Component (#516)', () => {
  it('renders scannable Permanent Driving Licence guide with statutory timelines', () => {
    const html = renderToStaticMarkup(<DrivingLicenceGuide />);

    expect(html).toContain('Permanent Driving Licence (DL) Issuance &amp; Renewal Guide');
    expect(html).toContain('The 30-Day Mandatory Practice Window');
    expect(html).toContain('The 180-Day Expiry Deadline');
    expect(html).toContain('What a Permanent Driving Licence Proves vs. Does Not Prove');
  });

  it('renders official portal and MoRTH Sarathi Parivahan references', () => {
    const html = renderToStaticMarkup(<DrivingLicenceGuide />);

    expect(html).toContain('sarathi.parivahan.gov.in');
    expect(html).toContain('Motor Vehicles Act, 1988 (Amended 2019)');
  });
});
