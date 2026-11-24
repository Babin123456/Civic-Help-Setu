import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import CivicDataApi from './CivicDataApi';
import CivicDataApiDatasetCard from '../components/civicDataApi/CivicDataApiDatasetCard';
import CivicDataApiClientForm from '../components/civicDataApi/CivicDataApiClientForm';
import CivicDataApiClientCard from '../components/civicDataApi/CivicDataApiClientCard';
import CivicDataApiGovernancePanel from '../components/civicDataApi/CivicDataApiGovernancePanel';
import { AuthProvider } from '../context/AuthContext';
import { NetworkProvider } from '../context/NetworkContext';
import { DATASET_DEFINITIONS } from '../data/civicDataApiCatalog';

const renderPage = () => renderToStaticMarkup(
  <MemoryRouter>
    <AuthProvider>
      <NetworkProvider>
        <CivicDataApi />
      </NetworkProvider>
    </AuthProvider>
  </MemoryRouter>
);

describe('Civic Data API developer portal (#773)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    });
  });

  it('renders the named route page, governance boundary and approved dataset catalogue', () => {
    const html = renderPage();
    expect(html).toContain('Civic Data API &amp; Developer Sandbox');
    expect(html).toContain('Public data only');
    expect(html).toContain('Governance boundary');
    expect(html).toContain('Municipal Service Locations');
    expect(html).toContain('Public Notices');
    expect(html).toContain('Ward-Level Aggregate Metrics');
    expect(html).toContain('Sign in to create a sandbox client');
    expect(html).toContain('Sandbox request console');
    expect(html).toContain('Versioned API reference');
    expect(html).toContain('/api/v1/datasets');
  });

  it('renders a dataset card with version, quota, public fields and accessible endpoint details', () => {
    const html = renderToStaticMarkup(
      <CivicDataApiDatasetCard dataset={{ ...DATASET_DEFINITIONS[0], recordCount: 18, endpoint: '/api/v1/datasets/service-locations/records' }} onUseInSandbox={() => {}} />
    );
    expect(html).toContain('Municipal Service Locations');
    expect(html).toContain('v1 / schema 1');
    expect(html).toContain('18');
    expect(html).toContain('Public fields only');
    expect(html).toContain('Filters and endpoint');
    expect(html).toContain('Use in sandbox');
    expect(html).toContain('aria-labelledby="dataset-title-service-locations"');
  });

  it('renders a keyboard-operable client form with a labelled dataset fieldset', () => {
    const html = renderToStaticMarkup(
      <CivicDataApiClientForm datasets={DATASET_DEFINITIONS} onCreate={() => {}} submitting={false} error="" />
    );
    expect(html).toContain('Create API client');
    expect(html).toContain('<fieldset');
    expect(html).toContain('<legend');
    expect(html).toContain('Client name');
    expect(html).toContain('Environment');
    expect(html).toContain('Sandbox (synthetic data)');
    expect(html).toContain('Production (admin approval)');
    expect(html).toContain('Allowed datasets');
  });

  it('renders client keys, scopes and state actions without exposing key hashes', () => {
    const client = {
      id: 'client_test',
      name: 'Civic dashboard',
      description: 'Ward metrics dashboard',
      environment: 'sandbox',
      state: 'active',
      ownerId: 'citizen-1',
      allowedDatasetIds: ['service-locations'],
      jurisdiction: { state: 'Karnataka', district: 'All' },
      dailyQuota: 250,
      rateLimitPerMinute: 30,
      keys: [{
        id: 'key_test',
        clientId: 'client_test',
        label: 'Default key',
        keyPrefix: 'cdk_sandbox_abc',
        keyLast4: '1234',
        state: 'active',
        lastUsedAt: null,
      }],
    };
    const html = renderToStaticMarkup(
      <CivicDataApiClientCard
        client={client}
        canAdmin={false}
        onApprove={() => {}}
        onSuspend={() => {}}
        onRevoke={() => {}}
        onCreateKey={() => {}}
        onRotateKey={() => {}}
        onRevokeKey={() => {}}
      />
    );
    expect(html).toContain('Civic dashboard');
    expect(html).toContain('Karnataka / All');
    expect(html).toContain('250/day');
    expect(html).toContain('cdk_sandbox_abc');
    expect(html).toContain('Create key');
    expect(html).toContain('Rotate');
    expect(html).toContain('Revoke');
    expect(html).not.toContain('keyHash');
  });

  it('renders aggregate usage as an accessible table and explains empty states', () => {
    const empty = renderToStaticMarkup(
      <CivicDataApiGovernancePanel usage={[]} clients={[]} audits={[]} anomalies={[]} isAdmin={false} onReviewAnomaly={() => {}} />
    );
    expect(empty).toContain('Usage governance');
    expect(empty).toContain('No API requests recorded yet');

    const populated = renderToStaticMarkup(
      <CivicDataApiGovernancePanel
        usage={[{ id: 'u1', clientId: 'c1', datasetId: 'service-locations', date: '2026-11-19', requestCount: 4, errorCount: 0, bytes: 900 }]}
        clients={[{ id: 'c1', name: 'Civic dashboard' }]}
        audits={[]}
        anomalies={[]}
        isAdmin={false}
        onReviewAnomaly={() => {}}
      />
    );
    expect(populated).toContain('<caption');
    expect(populated).toContain('Aggregate API usage by client, dataset and day');
    expect(populated).toContain('Civic dashboard');
    expect(populated).toContain('service-locations');
  });
});
