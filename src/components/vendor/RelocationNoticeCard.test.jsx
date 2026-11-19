import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RelocationNoticeCard from './RelocationNoticeCard.jsx';

describe('RelocationNoticeCard Component (#892)', () => {
  it('renders Section 18 relocation notice auditor', () => {
    const html = renderToStaticMarkup(<RelocationNoticeCard />);

    expect(html).toContain('Section 18 Relocation Notice &amp; Alternative Pitch Auditor');
    expect(html).toContain('Notice Period Days Given (Section 18(1))');
    expect(html).toContain('Viable alternative vending site allocated');
    expect(html).toContain('UNLAWFUL RELOCATION ORDER / DEFICIENT DUE PROCESS');
  });

  it('triggers onRelocationAuditChange callback with compliance results', () => {
    let captured = null;
    renderToStaticMarkup(
      <RelocationNoticeCard onRelocationAuditChange={(data) => { captured = data; }} />
    );

    expect(captured).not.toBeNull();
    expect(captured.isIllegalRelocation).toBe(true);
    expect(captured.status).toBe('UNLAWFUL_RELOCATION');
  });
});
