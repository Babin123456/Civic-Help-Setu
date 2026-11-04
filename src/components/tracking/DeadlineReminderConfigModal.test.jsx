import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DeadlineReminderConfigModal from './DeadlineReminderConfigModal';

describe('DeadlineReminderConfigModal Component (#460)', () => {
  beforeEach(() => {
    const store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((k) => store[k] || null),
      setItem: vi.fn((k, v) => {
        store[k] = String(v);
      }),
      removeItem: vi.fn((k) => {
        delete store[k];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach((k) => delete store[k]);
      })
    });
  });

  const sampleApp = {
    id: 'APP-DEADLINE-909',
    serviceTitle: 'Ration Card Verification',
    applicantEmail: 'user@example.com'
  };

  it('renders modal when open with configuration form controls', () => {
    const html = renderToStaticMarkup(
      <DeadlineReminderConfigModal
        isOpen={true}
        onClose={() => {}}
        application={sampleApp}
      />
    );

    expect(html).toContain('Application Deadline Reminders');
    expect(html).toContain('Official Deadline Date');
    expect(html).toContain('Reminder Cadence');
    expect(html).toContain('Save Reminder Schedule');
    expect(html).toContain('Test Send Sample');
  });

  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(
      <DeadlineReminderConfigModal
        isOpen={false}
        onClose={() => {}}
        application={sampleApp}
      />
    );

    expect(html).toBe('');
  });
});
