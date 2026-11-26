import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CdWasteTrackerCard from './CdWasteTrackerCard.jsx';

describe('CdWasteTrackerCard Component (#878)', () => {
  it('renders C&D parameters and 4-stream breakdown', () => {
    const html = renderToStaticMarkup(<CdWasteTrackerCard />);

    expect(html).toContain('Construction &amp; Demolition (C&amp;D) Waste Compliance Tracker');
    expect(html).toContain('Estimated Daily Debris Generation (Tonnes/day)');
    expect(html).toContain('Total Estimated Project Debris (Tonnes)');
    expect(html).toContain('4-Stream Debris Segregation Breakdown');
    expect(html).toContain('Concrete &amp; Mortar');
    expect(html).toContain('Soil, Sand &amp; Gravel');
  });

  it('renders statutory plan status indicator', () => {
    const html = renderToStaticMarkup(<CdWasteTrackerCard />);

    expect(html).toContain('C&amp;D Generator Status');
    expect(html).toContain('Statutory Plan Status');
  });
});
