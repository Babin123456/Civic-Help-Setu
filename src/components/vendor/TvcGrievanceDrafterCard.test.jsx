import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TvcGrievanceDrafterCard from './TvcGrievanceDrafterCard.jsx';

describe('TvcGrievanceDrafterCard Component (#892)', () => {
  it('renders Section 20 appeal drafter form and legal petition preview', () => {
    const html = renderToStaticMarkup(<TvcGrievanceDrafterCard />);

    expect(html).toContain('Section 20 Grievance Redressal Committee Statutory Appeal Drafter');
    expect(html).toContain('Vendor Full Name');
    expect(html).toContain('Operational Pitch Location');
    expect(html).toContain('FORMAL STATUTORY APPEAL UNDER SECTION 20 OF THE STREET VENDORS');
    expect(html).toContain('Save to Offline Vault');
  });
});
