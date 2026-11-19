import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import BulkWasteGeneratorCard from './BulkWasteGeneratorCard.jsx';

describe('BulkWasteGeneratorCard Component (#878)', () => {
  it('renders bulk waste generator form and statutory callout', () => {
    const html = renderToStaticMarkup(<BulkWasteGeneratorCard />);

    expect(html).toContain('Bulk Waste Generator (BWG) Statutory Compliance Auditor');
    expect(html).toContain('Daily Waste Generated (kg/day)');
    expect(html).toContain('Total Plinth / Campus Area (sq.m)');
    expect(html).toContain('Mandatory In-Situ Wet Waste Processing');
    expect(html).toContain('Spot Fine Exposure');
  });

  it('displays BWG classification and rule infractions', () => {
    const html = renderToStaticMarkup(<BulkWasteGeneratorCard />);

    expect(html).toContain('BWG Classification');
    expect(html).toContain('Compliance Rating');
    expect(html).toContain('Statutory Infractions Under SWM Rules, 2016');
  });
});
