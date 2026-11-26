import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AbcComplianceAuditCard from './AbcComplianceAuditCard.jsx';

describe('AbcComplianceAuditCard', () => {
  it('renders ABC rules 2023 ward auditor and statutory relocation injunction', () => {
    const html = renderToStaticMarkup(<AbcComplianceAuditCard />);
    expect(html).toContain('Animal Birth Control (ABC) Rules, 2023 Ward Auditor');
    expect(html).toContain('STATUTORY INJUNCTION: ILLEGAL DOG RELOCATION IS A PENAL OFFENSE');
    expect(html).toContain('Ward Sterilization Coverage');
    expect(html).toContain('AWBI v. A. Nagaraja');
  });

  it('renders ABC checkpoints', () => {
    const html = renderToStaticMarkup(<AbcComplianceAuditCard />);
    expect(html).toContain('Mandatory Release into the EXACT SAME Territory / Street');
    expect(html).toContain('Permanent &quot;V-Notch&quot; Ear Tagging for Sterilized Dogs');
  });
});
