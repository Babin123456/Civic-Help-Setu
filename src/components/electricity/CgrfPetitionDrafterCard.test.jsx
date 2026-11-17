import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CgrfPetitionDrafterCard from './CgrfPetitionDrafterCard.jsx';

describe('CgrfPetitionDrafterCard Component (#891)', () => {
  it('renders Section 42(5) CGRF petition drafter and preview', () => {
    const html = renderToStaticMarkup(<CgrfPetitionDrafterCard />);

    expect(html).toContain('Section 42(5) CGRF &amp; Electricity Ombudsman Statutory Petition Drafter');
    expect(html).toContain('Consumer Full Name');
    expect(html).toContain('Consumer Account (CA) / Service ID');
    expect(html).toContain('Respondent DISCOM &amp; Division');
    expect(html).toContain('FORMAL STATUTORY GRIEVANCE PETITION UNDER SECTION 42(5)');
    expect(html).toContain('Save to Offline Vault');
  });
});
