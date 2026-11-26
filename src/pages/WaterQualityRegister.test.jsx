/**
 * src/pages/WaterQualityRegister.test.jsx
 * Component tests for Community Water-Quality Sampling & Laboratory Result Register (#754).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import WaterQualityRegister from './WaterQualityRegister.jsx';
import { resetWaterQualityStore } from '../services/waterQualityStorage.js';

describe('WaterQualityRegister (#754)', () => {
  beforeEach(() => {
    resetWaterQualityStore();
  });

  const renderComponent = () => {
    return renderToString(<WaterQualityRegister />);
  };

  it('renders the header and statutory IS 10500 specification notices', () => {
    const html = renderComponent();
    expect(html).toContain('Community Water-Quality Sampling &amp; Laboratory Result Register');
    expect(html).toContain('Official Municipal Water Surveillance');
    expect(html).toContain('IS 10500:2012');
  });

  it('renders metrics overview cards (Monitored Points, Compliant, Exceeded, Pending)', () => {
    const html = renderComponent();
    expect(html).toContain('Total Monitored Points');
    expect(html).toContain('IS 10500 Compliant');
    expect(html).toContain('Exceeded / Alert');
    expect(html).toContain('Pending Lab Analysis');
  });

  it('renders seeded public water points and source types', () => {
    const html = renderComponent();
    expect(html).toContain('Bellandur Village Community Standpost Tap');
    expect(html).toContain('Kaikondrahalli Community RO Purification Kiosk');
    expect(html).toContain('HSR Sector 2 Public Borewell Handpump');
    expect(html).toContain('Municipal Piped Cauvery Supply');
  });

  it('renders search input and multi-filter dropdowns', () => {
    const html = renderComponent();
    expect(html).toContain('Search by water point name, ward, landmark, or ID...');
    expect(html).toContain('City / ULB');
    expect(html).toContain('Ward / Locality');
    expect(html).toContain('Water Point Type');
    expect(html).toContain('Compliance (IS 10500)');
  });

  it('renders role selector for authorized operator testing', () => {
    const html = renderComponent();
    expect(html).toContain('Role: Public Resident');
    expect(html).toContain('Role: Certified Sampler');
    expect(html).toContain('Role: NABL Lab Analyst');
    expect(html).toContain('Role: Municipal Health Officer');
  });
});
