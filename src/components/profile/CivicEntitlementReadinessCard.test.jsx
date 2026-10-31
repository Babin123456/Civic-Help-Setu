import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import CivicEntitlementReadinessCard from './CivicEntitlementReadinessCard';

describe('CivicEntitlementReadinessCard', () => {
  it('renders readiness score, tier label, and action buttons', () => {
    const profile = { state: 'Maharashtra', city: 'Pune' };
    const html = renderToString(
      <MemoryRouter>
        <CivicEntitlementReadinessCard profile={profile} />
      </MemoryRouter>
    );

    expect(html).toContain('Civic Profile &amp; Entitlement Readiness');
    expect(html).toContain('Document Completeness Score');
    expect(html).toContain('Open Digital Vault');
    expect(html).toContain('Check Scheme Eligibility');
    expect(html).toContain('Aadhaar / National Identity Proof');
  });
});
