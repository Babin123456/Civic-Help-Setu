import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ApplicabilityPanel from './ApplicabilityPanel';
import ApplicabilityBadge from './ApplicabilityBadge';

describe('applicability components (#260)', () => {
  it('shows an unverified notice for a service without jurisdiction data', () => {
    const html = renderToStaticMarkup(<ApplicabilityPanel service={{ id: 'x', name: 'X' }} />);
    expect(html).toContain('Where this service applies');
    expect(html).toContain('Not specified');
    expect(html).toContain('has not been verified');
    expect(html).not.toContain('Applies across India');
  });

  it('shows the state and district of a district service', () => {
    const html = renderToStaticMarkup(
      <ApplicabilityPanel
        service={{ jurisdiction: { level: 'district', states: ['Kerala'], districts: ['Ernakulam'] } }}
      />
    );
    expect(html).toContain('District');
    expect(html).toContain('Kerala');
    expect(html).toContain('Ernakulam');
  });

  it('badges national and unverified services differently', () => {
    expect(renderToStaticMarkup(<ApplicabilityBadge service={{ jurisdiction: { level: 'national' } }} />)).toContain(
      'applicability-badge--national'
    );
    const unknown = renderToStaticMarkup(<ApplicabilityBadge service={{}} />);
    expect(unknown).toContain('applicability-badge--unknown');
    expect(unknown).toContain('Jurisdiction unverified');
  });
});
