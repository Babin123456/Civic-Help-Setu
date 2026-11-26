// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import OfflineEmergencyCardContactForm from './OfflineEmergencyCardContactForm.jsx';

const jurisdictions = [
  { id: 'NATIONAL', name: 'All India', state: 'India' },
  { id: 'LKO', name: 'Lucknow', state: 'Uttar Pradesh' },
];

const activeSource = {
  id: 'src-lko-police',
  title: 'Uttar Pradesh Police',
  publisher: 'Uttar Pradesh Police',
  jurisdictionId: 'LKO',
  status: 'active',
};

const existingContact = {
  id: 'contact-1',
  name: 'Lucknow Police Control Room',
  organization: 'Lucknow Police',
  category: 'police',
  jurisdictionId: 'LKO',
  sourceId: 'src-lko-police',
  phone: '112',
  alternatePhone: '',
  email: '',
  website: 'https://uppolice.gov.in/',
  address: '',
  hours: '24 hours, 7 days',
  languages: ['Hindi', 'English'],
  description: 'Police control room.',
  reviewIntervalDays: 180,
  version: 4,
};

describe('OfflineEmergencyCardContactForm', () => {
  let container;
  let root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const render = async (element) => {
    await act(async () => root.render(element));
  };

  const submit = async () => {
    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  };

  it('blocks a contact without an active official source', async () => {
    const onSubmit = vi.fn();
    await render(
      <OfflineEmergencyCardContactForm
        sources={[]}
        jurisdictions={jurisdictions}
        defaultJurisdictionId="LKO"
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    );

    await submit();

    expect(container.textContent).toContain('No active source exists for this jurisdiction');
    expect(container.textContent).toContain('Choose an active official source');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits an edit with the expected version, languages and change reason', async () => {
    const onSubmit = vi.fn();
    await render(
      <OfflineEmergencyCardContactForm
        initialContact={existingContact}
        sources={[activeSource]}
        jurisdictions={jurisdictions}
        defaultJurisdictionId="LKO"
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    );

    const reason = container.querySelector('#contact-change-reason');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      setter.call(reason, 'Official source now lists this number.');
      reason.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.expectedVersion).toBe(4);
    expect(payload.languages).toEqual(['Hindi', 'English']);
    expect(payload.contactScope).toBe('public_office');
    expect(payload.changeReason).toContain('Official source');
    expect(payload.name).toBe('Lucknow Police Control Room');
  });

  it('does not offer archived sources in the source picker', async () => {
    await render(
      <OfflineEmergencyCardContactForm
        sources={[{ ...activeSource, status: 'archived' }]}
        jurisdictions={jurisdictions}
        defaultJurisdictionId="LKO"
        onSubmit={() => {}}
        onCancel={() => {}}
      />
    );

    expect(container.textContent).toContain('No active source exists for this jurisdiction');
    expect(container.querySelectorAll('#contact-source option')).toHaveLength(1);
  });
});
