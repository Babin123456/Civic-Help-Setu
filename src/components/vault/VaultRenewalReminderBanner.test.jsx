import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import VaultRenewalReminderBanner from './VaultRenewalReminderBanner';

describe('VaultRenewalReminderBanner', () => {
  it('renders nothing when documents list is empty or has no expiring documents', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <VaultRenewalReminderBanner documents={[]} />
      </MemoryRouter>
    );
    expect(html).toBe('');
  });

  it('renders statutory renewal alert when expired income certificate is present', () => {
    const docs = [
      {
        id: 'inc-99',
        type: 'Income Certificate',
        number: 'XXXX 4512',
        issueDate: '2024-05-10',
      },
    ];
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <VaultRenewalReminderBanner documents={docs} />
      </MemoryRouter>
    );
    expect(html).toContain('Statutory Document Expiry &amp; Renewal Notices');
    expect(html).toContain('Income Certificate (XXXX 4512)');
    expect(html).toContain('Financial Year Validity Lapsed');
    expect(html).toContain('Apply Renewal');
  });
});
