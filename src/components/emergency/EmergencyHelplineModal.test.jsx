import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EmergencyHelplineModal from './EmergencyHelplineModal';

describe('EmergencyHelplineModal Component', () => {
  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(
      <EmergencyHelplineModal isOpen={false} />
    );
    expect(html).toBe('');
  });

  it('renders key emergency numbers when open', () => {
    const html = renderToStaticMarkup(
      <EmergencyHelplineModal isOpen={true} />
    );

    expect(html).toContain('Civic Emergency &amp; SOS Helplines');
    expect(html).toContain('112');
    expect(html).toContain('1930');
    expect(html).toContain('National Emergency Response Support System');
    expect(html).toContain('National Cybercrime Financial Fraud Helpline');
    expect(html).toContain('Call Now');
    expect(html).toContain('tel:112');
    expect(html).toContain('tel:1930');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });
});
