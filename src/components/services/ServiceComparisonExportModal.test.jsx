import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ServiceComparisonExportModal from './ServiceComparisonExportModal.jsx';

describe('ServiceComparisonExportModal (#436)', () => {
  const mockServices = [
    {
      id: 's1',
      name: 'Birth Certificate',
      department: 'Municipal Dept',
      fees: '₹50',
      documents: ['Hospital Discharge Summary', 'Aadhaar Card'],
    },
    {
      id: 's2',
      name: 'Income Certificate',
      department: 'Revenue Dept',
      fees: '₹25',
      documents: ['Salary Slip', 'Aadhaar Card'],
    },
  ];

  it('returns null when isOpen is false or comparedServices is empty', () => {
    const htmlClosed = renderToStaticMarkup(
      <ServiceComparisonExportModal isOpen={false} onClose={() => {}} comparedServices={mockServices} />
    );
    expect(htmlClosed).toBe('');

    const htmlEmpty = renderToStaticMarkup(
      <ServiceComparisonExportModal isOpen={true} onClose={() => {}} comparedServices={[]} />
    );
    expect(htmlEmpty).toBe('');
  });

  it('renders modal header, format tabs, overlap pill, and action buttons', () => {
    const html = renderToStaticMarkup(
      <ServiceComparisonExportModal isOpen={true} onClose={() => {}} comparedServices={mockServices} />
    );

    expect(html).toContain('Export Comparison Dossier');
    expect(html).toContain('Markdown (.md)');
    expect(html).toContain('Plain Text (.txt)');
    expect(html).toContain('1 shared document requirements identified');
    expect(html).toContain('Copy Content');
    expect(html).toContain('Download .md');
    expect(html).toContain('Print');
  });

  it('renders preview text containing comparison matrix details', () => {
    const html = renderToStaticMarkup(
      <ServiceComparisonExportModal isOpen={true} onClose={() => {}} comparedServices={mockServices} />
    );

    expect(html).toContain('Civic Help Setu — Service Comparison Dossier');
    expect(html).toContain('Birth Certificate');
    expect(html).toContain('Income Certificate');
  });
});
