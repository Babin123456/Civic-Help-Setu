import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import DocumentPreflightInspectionCard from './DocumentPreflightInspectionCard';

describe('DocumentPreflightInspectionCard Component', () => {
  const renderComponent = (props) =>
    renderToStaticMarkup(
      <MemoryRouter>
        <DocumentPreflightInspectionCard {...props} />
      </MemoryRouter>
    );

  it('renders nothing when service is null', () => {
    const html = renderComponent({ service: null });
    expect(html).toBe('');
  });

  it('renders pre-flight inspection checklist for birth-certificate', () => {
    const service = {
      id: 'birth-certificate',
      name: 'Birth Certificate Registration',
      documents: ['Hospital discharge summary', 'Parents Aadhaar'],
    };

    const html = renderComponent({ service });

    expect(html).toContain('Document Pre-Flight Inspection &amp; Attestation Check');
    expect(html).toContain('Character-by-Character Name Spelling Check');
    expect(html).toContain('Self-Attestation with Current Date');
    expect(html).toContain('Proof of Address Freshness Buffer');
    expect(html).toContain('Copy Pre-Flight Inspection Report');
  });

  it('has accessible region landmark', () => {
    const service = {
      id: 'income-certificate',
      name: 'Income Certificate',
      documents: ['Salary slip', 'ITR'],
    };

    const html = renderComponent({ service });
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Document Pre-Flight &amp; Attestation Readiness for Income Certificate"');
  });
});
