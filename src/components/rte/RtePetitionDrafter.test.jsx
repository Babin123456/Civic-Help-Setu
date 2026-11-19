import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RtePetitionDrafter from './RtePetitionDrafter.jsx';

describe('RtePetitionDrafter Component (#889)', () => {
  it('renders Section 32 petition drafter with input fields and legal preview', () => {
    const html = renderToStaticMarkup(<RtePetitionDrafter />);

    expect(html).toContain('Section 32 Statutory Redressal Petition Drafter');
    expect(html).toContain('Child Applicant Name');
    expect(html).toContain('Parent / Guardian Name');
    expect(html).toContain('Respondent School Name');
    expect(html).toContain('FORMAL STATUTORY COMPLAINT UNDER SECTION 32 OF THE RIGHT OF CHILDREN');
    expect(html).toContain('Save to Offline Vault');
  });
});
