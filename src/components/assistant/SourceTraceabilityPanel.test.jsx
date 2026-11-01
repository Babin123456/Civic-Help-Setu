import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import SourceTraceabilityPanel from './SourceTraceabilityPanel';
import { RAG_CONFIDENCE_LEVELS } from '../../services/groundedCivicRagService';

describe('SourceTraceabilityPanel Component (#400)', () => {
  const supportedResult = {
    status: 'SUPPORTED',
    confidenceLevel: RAG_CONFIDENCE_LEVELS.HIGH,
    coverageScore: 85,
    citations: [
      {
        citationId: 'cit-1',
        serviceId: 'pm-kisan',
        serviceTitle: 'PM Kisan Samman Nidhi',
        field: 'documents',
        fieldLabel: 'Required Documents',
        excerpt: 'Aadhaar card linked to bank account and land holding passbook',
        department: 'Agriculture Department',
        officialUrl: 'https://pmkisan.gov.in',
      },
    ],
    uncertaintyAcknowledged: false,
  };

  it('renders grounded citations with service link, excerpt, and official portal', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SourceTraceabilityPanel ragResult={supportedResult} defaultExpanded={true} />
      </MemoryRouter>
    );

    expect(html).toContain('Source Traceability &amp; Grounding');
    expect(html).toContain('Grounded in Verified Records');
    expect(html).toContain('85% coverage');
    expect(html).toContain('PM Kisan Samman Nidhi');
    expect(html).toContain('Required Documents');
    expect(html).toContain('Aadhaar card linked to bank account');
    expect(html).toContain('Official Portal');
  });

  it('renders uncertainty disclosure for partially grounded inquiries', () => {
    const partialResult = {
      status: 'PARTIALLY_SUPPORTED',
      confidenceLevel: RAG_CONFIDENCE_LEVELS.MEDIUM,
      coverageScore: 45,
      citations: [],
      uncertaintyAcknowledged: true,
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SourceTraceabilityPanel ragResult={partialResult} />
      </MemoryRouter>
    );

    expect(html).toContain('Partially Grounded');
    expect(html).toContain('Grounding Disclosure:');
    expect(html).toContain('states uncertainty instead of guessing');
  });

  it('returns null when ragResult is missing', () => {
    const html = renderToStaticMarkup(<SourceTraceabilityPanel ragResult={null} />);
    expect(html).toBe('');
  });
});
