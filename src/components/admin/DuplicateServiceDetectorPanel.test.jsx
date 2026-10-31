import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DuplicateServiceDetectorPanel from './DuplicateServiceDetectorPanel';

describe('DuplicateServiceDetectorPanel Component (#397)', () => {
  const mockServices = [
    {
      id: 'srv-1',
      title: 'Pradhan Mantri Awas Yojana Gramin',
      department: 'Ministry of Rural Development',
      jurisdiction: 'National',
      description: 'Housing assistance scheme for rural poor families.',
      officialUrl: 'https://pmayg.nic.in',
    },
    {
      id: 'srv-2',
      title: 'Pradhan Mantri Awas Yojana - Gramin Housing',
      department: 'Ministry of Rural Development',
      jurisdiction: 'National',
      description: 'Rural housing grant for construction of permanent home.',
      officialUrl: 'https://pmayg.nic.in/home',
    },
    {
      id: 'srv-3',
      title: 'Driving Licence Renewal Online',
      department: 'Transport Department',
      jurisdiction: 'Maharashtra',
      description: 'Apply for online renewal of expired driving licence card.',
      officialUrl: 'https://parivahan.gov.in',
    },
  ];

  it('renders safety guardrail explaining advisory nature and no auto-deletion', () => {
    const html = renderToStaticMarkup(<DuplicateServiceDetectorPanel services={mockServices} />);
    expect(html).toContain('Duplicate &amp; Near-Duplicate Service Detector');
    expect(html).toContain('Safety Guardrail:');
    expect(html).toContain('never auto-delete, auto-merge, or modify services');
  });

  it('renders side-by-side candidate comparison with similarity score and matched fields', () => {
    const html = renderToStaticMarkup(<DuplicateServiceDetectorPanel services={mockServices} />);
    expect(html).toContain('Candidate Service 1');
    expect(html).toContain('Candidate Service 2');
    expect(html).toContain('Pradhan Mantri Awas Yojana Gramin');
    expect(html).toContain('Pradhan Mantri Awas Yojana - Gramin Housing');
    expect(html).toContain('Similarity');
    expect(html).toContain('Matched title');
    expect(html).toContain('Matched department');
    expect(html).toContain('Confirm Duplicate');
    expect(html).toContain('Mark Distinct');
  });

  it('renders clean empty state when no services meet duplicate threshold', () => {
    const distinctServices = [
      { id: 'd1', title: 'Passport Seva', department: 'External Affairs', jurisdiction: 'National' },
      { id: 'd2', title: 'Electricity Connection', department: 'Power Dept', jurisdiction: 'Delhi' },
    ];
    const html = renderToStaticMarkup(<DuplicateServiceDetectorPanel services={distinctServices} />);
    expect(html).toContain('No Duplicate Candidates Found');
  });
});
