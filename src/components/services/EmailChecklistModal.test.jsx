import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EmailChecklistModal from './EmailChecklistModal';

describe('EmailChecklistModal Component (#461)', () => {
  const sampleService = {
    id: 'srv-pension-01',
    title: 'Old Age Pension Application',
    category: 'Social Welfare',
    department: 'Department of Social Justice',
    fees: 'Free of Cost',
    turnaroundTime: '45 days',
    documents: [
      { name: 'Age Proof Certificate', copies: 1, optional: false },
      { name: 'Income Certificate', copies: 1, optional: false },
      { name: 'Bank Passbook front page copy', copies: 1, optional: false }
    ]
  };

  it('renders modal dialog when open with service summary and recipient inputs', () => {
    const html = renderToStaticMarkup(
      <EmailChecklistModal
        isOpen={true}
        onClose={() => {}}
        service={sampleService}
      />
    );

    expect(html).toContain('Email Service Checklist');
    expect(html).toContain('Old Age Pension Application');
    expect(html).toContain('Send to Myself');
    expect(html).toContain('Send to a Helper / Facilitator');
    expect(html).toContain('Recipient Email Address');
    expect(html).toContain('Send Checklist Email');
  });

  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(
      <EmailChecklistModal
        isOpen={false}
        onClose={() => {}}
        service={sampleService}
      />
    );

    expect(html).toBe('');
  });
});
