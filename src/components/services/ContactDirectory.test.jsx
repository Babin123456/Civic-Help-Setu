import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ContactDirectory from './ContactDirectory';

const today = new Date().toISOString().slice(0, 10);
const base = {
  type: 'helpdesk',
  method: 'phone',
  value: '1800 111 555',
  sourceUrl: 'https://example.gov.in/contact',
  lastVerified: today,
};

describe('ContactDirectory (#266)', () => {
  it('shows the neutral message when no contacts are listed', () => {
    const html = renderToStaticMarkup(<ContactDirectory service={{ id: 'x' }} />);
    expect(html).toContain('No verified contact listed');
    expect(html).toContain('aria-labelledby="contact-dir-heading"');
    expect(html).not.toContain('href="tel:');
  });

  it('renders phone, email and web actions for multiple verified contacts', () => {
    const service = {
      contacts: [
        { ...base, hours: 'Mon-Fri 9-5' },
        { ...base, type: 'grievance', method: 'email', value: 'help@example.gov.in' },
        { ...base, type: 'department', method: 'web', value: 'https://example.gov.in/dept' },
      ],
    };
    const html = renderToStaticMarkup(<ContactDirectory service={service} />);
    expect(html).toContain('href="tel:1800111555"');
    expect(html).toContain('href="mailto:help@example.gov.in"');
    expect(html).toContain('href="https://example.gov.in/dept"');
    expect(html).toContain('Published hours: Mon-Fri 9-5');
    expect(html.match(/Verified<\/span>/g)).toHaveLength(3);
    expect(html).not.toContain('Needs admin review');
  });

  it('marks expired contacts for admin review and hides malformed values', () => {
    const service = {
      contacts: [
        { ...base, lastVerified: '2020-01-01' },
        { ...base, method: 'email', value: 'not-an-email' },
      ],
    };
    const html = renderToStaticMarkup(<ContactDirectory service={service} />);
    expect(html.match(/Needs admin review/g)).toHaveLength(2);
    expect(html).not.toContain('not-an-email');
    expect(html).not.toContain('mailto:');
    expect(html).toContain('href="tel:1800111555"');
  });
});
