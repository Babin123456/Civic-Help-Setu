import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import OpenContractingAuditQueue from './OpenContractingAuditQueue';
import { ToastProvider } from '../../context/ToastContext';

describe('OpenContractingAuditQueue Component (#751)', () => {
  it('renders queue items with sealed tokens, dispositions, and certification actions', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <OpenContractingAuditQueue />
      </ToastProvider>
    );

    expect(html).toContain('Open Contracting Red-Flag Audit &amp; Triage Queue (#751)');
    expect(html).toContain('AUDIT-SEAL-8B41-2A99');
    expect(html).toContain('Certify');
    expect(html).toContain('Dismiss');
    expect(html).toContain('Sealed Token:');
  });
});
