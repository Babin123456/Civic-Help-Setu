import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import DocumentRenewalDigestModal from './DocumentRenewalDigestModal.jsx';

describe('DocumentRenewalDigestModal (#432)', () => {
  it('returns null when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <DocumentRenewalDigestModal isOpen={false} onClose={() => {}} documents={[]} />
      </MemoryRouter>
    );
    expect(html).toBe('');
  });

  it('renders modal header, summary badges, and privacy notice when open', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <DocumentRenewalDigestModal isOpen={true} onClose={() => {}} documents={[]} />
      </MemoryRouter>
    );

    expect(html).toContain('Document Renewal Digest &amp; Expiry Alerts');
    expect(html).toContain('Export Calendar Reminders (.ics)');
    expect(html).toContain('Action Required');
    expect(html).toContain('Zero-Knowledge');
  });

  it('renders documents with urgency statuses and service guide links', () => {
    const mockDocs = [
      {
        id: 'doc-dl',
        name: 'Driving License',
        type: 'Driving Licence',
        expiryDate: '2026-11-10',
      },
      {
        id: 'doc-pass',
        name: 'Passport',
        type: 'Passport',
        expiryDate: '2027-02-01',
      },
    ];

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <DocumentRenewalDigestModal isOpen={true} onClose={() => {}} documents={mockDocs} />
      </MemoryRouter>
    );

    expect(html).toContain('Driving License');
    expect(html).toContain('href="/services/driving-license"');
    expect(html).toContain('Open official renewal service guide');
  });
});
