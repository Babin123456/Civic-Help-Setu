import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CapitationFeeAuditorCard from './CapitationFeeAuditorCard.jsx';

describe('CapitationFeeAuditorCard Component (#889)', () => {
  it('renders Section 13 illegal screening & capitation auditor form', () => {
    const html = renderToStaticMarkup(<CapitationFeeAuditorCard />);

    expect(html).toContain('Section 13 Illegal Screening &amp; Capitation Fee Penalty Auditor');
    expect(html).toContain('Capitation Fine (10x Cap)');
    expect(html).toContain('Screening Penalty');
    expect(html).toContain('Total Statutory Liability');
    expect(html).toContain('Sec 13(2)(a) RTE Act');
  });
});
