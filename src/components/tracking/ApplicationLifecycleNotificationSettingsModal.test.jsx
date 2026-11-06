import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ApplicationLifecycleNotificationSettingsModal from './ApplicationLifecycleNotificationSettingsModal';

describe('ApplicationLifecycleNotificationSettingsModal', () => {
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
      }),
    });
  });

  const mockApp = {
    id: 'APP-99881',
    serviceTitle: 'Birth Certificate Issuance',
    category: 'Civil Registry',
    status: 'In Review',
    applicantEmail: 'citizen@example.gov.in'
  };

  it('renders modal when isOpen is true', () => {
    const html = renderToStaticMarkup(
      <ApplicationLifecycleNotificationSettingsModal
        isOpen={true}
        onClose={() => {}}
        application={mockApp}
      />
    );

    expect(html).toContain('Application Lifecycle Notifications');
    expect(html).toContain('Notification Preferences');
    expect(html).toContain('Preferred Notification Email');
    expect(html).toContain('Enable All Lifecycle Email Notifications');
  });

  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <ApplicationLifecycleNotificationSettingsModal
        isOpen={false}
        onClose={() => {}}
        application={mockApp}
      />
    );

    expect(html).toBe('');
  });
});
