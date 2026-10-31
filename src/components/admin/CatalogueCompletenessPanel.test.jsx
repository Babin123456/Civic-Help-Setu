import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CatalogueCompletenessPanel from './CatalogueCompletenessPanel';

describe('CatalogueCompletenessPanel component', () => {
  const sampleServices = [
    {
      id: 'svc-complete',
      name: 'Passport Seva',
      officialUrl: 'https://passportindia.gov.in',
      department: 'Ministry of External Affairs',
      jurisdiction: 'India',
      documents: ['Birth Certificate', 'Aadhaar Card'],
      contact: '1800-258-1800',
      processingTime: '21 working days',
      fee: '₹1500',
      eligibilityCriteria: ['Indian Citizen'],
      steps: ['Apply online', 'Visit PSK']
    },
    {
      id: 'svc-incomplete',
      name: 'Old Age Pension Rural',
      // Missing officialUrl, documents, department, jurisdiction
      fee: 'Free'
    }
  ];

  it('exports a valid React functional component', () => {
    expect(typeof CatalogueCompletenessPanel).toBe('function');
  });

  it('renders overall catalogue health metrics and incomplete records', () => {
    const html = renderToStaticMarkup(
      <CatalogueCompletenessPanel services={sampleServices} onEditService={() => {}} />
    );

    expect(html).toContain('AI Catalogue Completeness &amp; Data Quality Audit');
    expect(html).toContain('Catalogue Health');
    expect(html).toContain('Old Age Pension Rural');
    expect(html).toContain('Missing Field(s)');
  });

  it('displays empty state when all services are complete', () => {
    const html = renderToStaticMarkup(
      <CatalogueCompletenessPanel services={[sampleServices[0]]} onEditService={() => {}} />
    );

    expect(html).toContain('No Data Quality Issues Found');
    expect(html).toContain('100% Core Fields Populated');
  });
});
