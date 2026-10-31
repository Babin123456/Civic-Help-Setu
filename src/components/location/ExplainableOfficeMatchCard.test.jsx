import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ExplainableOfficeMatchCard from './ExplainableOfficeMatchCard';

describe('ExplainableOfficeMatchCard Component (#399)', () => {
  const service = {
    id: 'ration-karnataka',
    title: 'Karnataka Ration Card',
    department: 'Department of Food & Civil Supplies',
    jurisdiction: 'Karnataka',
  };

  it('renders confirmed responsible office badge with verified notice', () => {
    const office = {
      id: 'off-1',
      name: 'Food & Civil Supplies Taluk Office',
      department: 'Department of Food & Civil Supplies',
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      servicesOffered: ['Karnataka Ration Card'],
    };

    const html = renderToStaticMarkup(
      <ExplainableOfficeMatchCard office={office} service={service} defaultExpanded={true} />
    );

    expect(html).toContain('Confirmed Responsible Office');
    expect(html).toContain('Verified primary intake authority');
    expect(html).toContain('Match Evaluation Criteria');
  });

  it('renders unverified jurisdiction alert when office region is missing', () => {
    const unverifiedOffice = {
      id: 'off-unv',
      name: 'General Food Counter',
      department: 'Department of Food & Civil Supplies',
      state: '',
    };

    const html = renderToStaticMarkup(
      <ExplainableOfficeMatchCard office={unverifiedOffice} service={service} />
    );

    expect(html).toContain('Unverified Jurisdiction');
    expect(html).toContain('Please telephone the office prior to visiting');
  });

  it('renders nearby civic facility only badge when office has different department', () => {
    const nearbyFacility = {
      id: 'off-rto',
      name: 'Central RTO Driving Licensing Authority',
      department: 'Transport Department',
      state: 'Karnataka',
    };

    const html = renderToStaticMarkup(
      <ExplainableOfficeMatchCard office={nearbyFacility} service={service} />
    );

    expect(html).toContain('Nearby Civic Facility Only');
    expect(html).toContain('primary department does not match');
  });

  it('returns null when office is not provided', () => {
    const html = renderToStaticMarkup(<ExplainableOfficeMatchCard office={null} service={service} />);
    expect(html).toBe('');
  });
});
