import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MultiRegionHealthPanel from './MultiRegionHealthPanel.jsx';

describe('MultiRegionHealthPanel (#1233)', () => {
  it('renders the multi-region topology header and primary region', () => {
    const html = renderToStaticMarkup(<MultiRegionHealthPanel />);
    expect(html).toContain('Multi-Region Read Topology &amp; Replication Lag');
    expect(html).toContain('asia-south1');
    expect(html).toContain('Sovereign Residency (Mumbai)');
  });

  it('renders all configured regional read replicas', () => {
    const html = renderToStaticMarkup(<MultiRegionHealthPanel />);
    expect(html).toContain('us-central1');
    expect(html).toContain('europe-west1');
    expect(html).toContain('asia-southeast1');
    expect(html).toContain('australia-southeast1');
    expect(html).toContain('Iowa, USA');
    expect(html).toContain('Belgium, EU');
  });

  it('renders replication lag indicators and RYW consistency metric', () => {
    const html = renderToStaticMarkup(<MultiRegionHealthPanel />);
    expect(html).toContain('Max Replica Lag');
    expect(html).toContain('RYW Consistency');
    expect(html).toContain('Normal');
    expect(html).toContain('Configured Regional Read Replicas &amp; Lag SLOs');
  });

  it('renders canary rollout controls and data residency notice', () => {
    const html = renderToStaticMarkup(<MultiRegionHealthPanel />);
    expect(html).toContain('Canary Traffic Rollout Control');
    expect(html).toContain('Sovereign Data Residency Assurance');
    expect(html).toContain('users/*, vaultDocs, applications, grievanceTickets');
  });
});
