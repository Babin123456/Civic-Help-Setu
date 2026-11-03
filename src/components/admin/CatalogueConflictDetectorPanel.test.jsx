import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CatalogueConflictDetectorPanel from './CatalogueConflictDetectorPanel';

describe('CatalogueConflictDetectorPanel Component (#473)', () => {
  beforeEach(() => {
    const store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, val) => {
        store[key] = String(val);
      }),
      removeItem: vi.fn((key) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach((k) => delete store[k]);
      }),
    });
  });

  const mockServices = [
    {
      id: 'srv-fee-conflict',
      title: 'Free Birth Certificate Registration',
      description: 'This is a completely free service provided by the municipal corporation.',
      fees: 'Mandatory processing charge of Rs. 200 per applicant',
      documents: ['Hospital discharge slip'],
    },
    {
      id: 'srv-doc-conflict',
      title: 'Senior Citizen Identity Card',
      description: 'Zero paperwork required to obtain senior citizen card.',
      documents: ['Aadhaar Card', 'Age proof certificate', 'Passport photos'],
      fees: 'Free of cost',
    },
    {
      id: 'srv-consistent',
      title: 'Standard Voter ID Update',
      description: 'Update your address on the national electoral roll online.',
      fees: 'No fee charged',
      documents: ['Proof of address'],
    },
  ];

  it('renders header, diagnostic safety notice, and summary metrics', () => {
    const html = renderToStaticMarkup(<CatalogueConflictDetectorPanel services={mockServices} />);

    expect(html).toContain('Catalogue Requirement Conflict Detector');
    expect(html).toContain('Admin Quality Assurance Guardrail:');
    expect(html).toContain('diagnostic findings only');
    expect(html).toContain('Scanned Records');
    expect(html).toContain('Active Contradictions');
  });

  it('renders conflicting services with side-by-side field values and explanations', () => {
    const html = renderToStaticMarkup(<CatalogueConflictDetectorPanel services={mockServices} />);

    expect(html).toContain('Free Birth Certificate Registration');
    expect(html).toContain('Fee Contradiction');
    expect(html).toContain('HIGH SEVERITY');
    expect(html).toContain('Senior Citizen Identity Card');
    expect(html).toContain('Document Mismatch');
  });

  it('renders empty state when all services are consistent', () => {
    const consistentOnly = [
      {
        id: 'c1',
        title: 'Online Land Record Search',
        description: 'Verify land registry entries online.',
        fees: 'Free of cost',
        documents: ['Survey number'],
      },
    ];

    const html = renderToStaticMarkup(<CatalogueConflictDetectorPanel services={consistentOnly} />);
    expect(html).toContain('No Catalogue Conflicts Detected');
    expect(html).toContain('All scanned services exhibit verified consistency');
  });
});
