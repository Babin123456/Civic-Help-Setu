import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DisconnectionLegalityCard from './DisconnectionLegalityCard.jsx';

describe('DisconnectionLegalityCard Component (#891)', () => {
  it('renders Section 56(1) disconnection legality auditor', () => {
    const html = renderToStaticMarkup(<DisconnectionLegalityCard />);

    expect(html).toContain('Section 56(1) Disconnection Legality &amp; Due Process Auditor');
    expect(html).toContain('Notice Period Days Provided by DISCOM');
    expect(html).toContain('Formal written notice delivered');
    expect(html).toContain('Supply disconnected after 1:00 PM');
    expect(html).toContain('ILLEGAL DISCONNECTION / SECTION 56(1) BREACH');
  });

  it('triggers onDisconnectionAuditChange callback with evaluation', () => {
    let captured = null;
    renderToStaticMarkup(
      <DisconnectionLegalityCard onDisconnectionAuditChange={(data) => { captured = data; }} />
    );

    expect(captured).not.toBeNull();
    expect(captured.isIllegalDisconnection).toBe(true);
    expect(captured.violations.length).toBeGreaterThan(0);
  });
});
