import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CatalogueCompletenessAuditorPanel from './CatalogueCompletenessAuditorPanel';

describe('CatalogueCompletenessAuditorPanel Component (#474)', () => {
  beforeEach(() => {
    const store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((k) => store[k] || null),
      setItem: vi.fn((k, v) => {
        store[k] = String(v);
      }),
      removeItem: vi.fn((k) => {
        delete store[k];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach((k) => delete store[k]);
      }),
    });
  });

  const mockServices = [
    {
      id: 'srv-incomp',
      title: 'State Solar Pump Grant',
      description: 'Subsidy grant etc.', // vague term
      department: '',
      documents: [],
    },
    {
      id: 'srv-comp',
      title: 'Pradhan Mantri Matru Vandana Yojana',
      description: 'Maternity benefit cash incentive program provided directly to pregnant women and lactating mothers.',
      targetAudience: 'Pregnant women and lactating mothers',
      department: 'Ministry of Women and Child Development',
      applicationMode: 'Online portal & Anganwadi centers',
      documents: ['Aadhaar card', 'MCP card', 'Bank account details'],
      officialUrl: 'https://pmmvy.nic.in',
      contactInfo: '011-23386423',
      lastVerifiedDate: '2026-10-01',
    },
  ];

  it('renders completeness auditor header, metrics, and quality defects', () => {
    const html = renderToStaticMarkup(
      <CatalogueCompletenessAuditorPanel services={mockServices} />
    );

    expect(html).toContain('AI-Assisted Catalogue Completeness Auditor');
    expect(html).toContain('AI Assistance Guardrail:');
    expect(html).toContain('State Solar Pump Grant');
    expect(html).toContain('CRITICAL');
    expect(html).toContain('Deficiency:');
    expect(html).toContain('Export CSV');
  });

  it('renders clean empty state when all services meet quality criteria', () => {
    const html = renderToStaticMarkup(
      <CatalogueCompletenessAuditorPanel services={[mockServices[1]]} />
    );

    expect(html).toContain('All Scanned Records Meet Quality Thresholds');
  });
});
