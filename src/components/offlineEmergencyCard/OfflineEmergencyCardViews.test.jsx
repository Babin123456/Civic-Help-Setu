import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import OfflineEmergencyCardInstalledView from './OfflineEmergencyCardInstalledView.jsx';
import OfflineEmergencyCardSourceForm from './OfflineEmergencyCardSourceForm.jsx';

const staleContact = {
  publicRef: 'lucknow-fire-101',
  name: 'Lucknow Fire and Emergency Services',
  categoryLabel: 'Fire and rescue',
  organization: 'Lucknow Fire Service',
  phone: '101',
  alternatePhone: '',
  isStale: true,
  lastVerifiedAt: '2025-10-21T00:00:00.000Z',
  reviewIntervalDays: 180,
  freshness: {
    state: 'stale',
    label: 'Outdated — verify before relying on it',
    isStale: true,
  },
  source: {
    title: 'Lucknow District Administration',
    publisher: 'District Administration, Lucknow',
    url: 'https://lucknow.nic.in/',
  },
};

const freshContact = {
  publicRef: 'erss-112',
  name: 'National Emergency Response Support System (ERSS)',
  categoryLabel: 'All-in-one emergency',
  organization: 'Emergency Response Support System',
  phone: '112',
  alternatePhone: '1090',
  isStale: false,
  lastVerifiedAt: '2026-11-06T00:00:00.000Z',
  reviewIntervalDays: 180,
  freshness: {
    state: 'fresh',
    label: 'Recently verified',
    isStale: false,
  },
  source: {
    title: 'Emergency Response Support System (ERSS) — official portal',
    publisher: 'Government of India',
    url: 'https://112.gov.in/',
  },
};

const installed = {
  installed: true,
  storage: { persisted: true, level: 'ok' },
  card: {
    jurisdictionName: 'Lucknow',
    contactCount: 2,
    sourceCount: 2,
    cardVersion: 'card-lko-1',
    installedAt: '2026-11-20T10:00:00.000Z',
    lastRefreshedAt: '2026-11-20T10:00:00.000Z',
    freshness: { state: 'current', label: 'Card is current' },
    summary: {
      totalContacts: 2,
      freshContacts: 1,
      reviewDueContacts: 0,
      staleContacts: 1,
      categoriesCovered: 2,
    },
    contacts: [staleContact, freshContact],
  },
};

const draft = {
  note: 'Nearest hospital is on the main road.',
  includeNational: true,
  largeText: false,
  showTable: false,
};

const renderInstalled = (overrides = {}) =>
  renderToStaticMarkup(
    <OfflineEmergencyCardInstalledView
      installed={installed}
      isOnline
      preferenceDraft={draft}
      onPreferenceChange={() => {}}
      onSavePreferences={() => {}}
      onRefresh={() => {}}
      onExport={() => {}}
      onDelete={() => {}}
      onGoToPublic={() => {}}
      busyAction={null}
      storage={{ persisted: true, level: 'ok' }}
      {...overrides}
    />
  );

describe('Offline emergency card installed view and source form (#761)', () => {
  it('shows the empty installed state with a route back to the public card', () => {
    const html = renderToStaticMarkup(
      <OfflineEmergencyCardInstalledView
        installed={{ installed: false, card: null }}
        isOnline
        preferenceDraft={draft}
        onPreferenceChange={() => {}}
        onSavePreferences={() => {}}
        onRefresh={() => {}}
        onExport={() => {}}
        onDelete={() => {}}
        onGoToPublic={() => {}}
        storage={{ persisted: true }}
      />
    );

    expect(html).toContain('No card is installed on this device');
    expect(html).toContain('Go to the public card');
  });

  it('shows verification dates, source links, stale warnings and tel links', () => {
    const html = renderInstalled();

    expect(html).toContain('My offline card — Lucknow');
    expect(html).toContain('Contacts on this card');
    expect(html).toContain('Outdated contact.');
    expect(html).toContain('Lucknow Fire and Emergency Services');
    expect(html).toContain('href="tel:101"');
    expect(html).toContain('href="tel:112"');
    expect(html).toContain('href="https://112.gov.in/"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer noopener"');
    expect(html).toContain('Last verified:');
    expect(html).toContain('Nearest hospital is on the main road.');
    expect(html).toContain('Delete from this device');
  });

  it('switches to an accessible table view and larger text when preferred', () => {
    const html = renderInstalled({
      preferenceDraft: { ...draft, showTable: true, largeText: true },
    });

    expect(html).toContain('<table');
    expect(html).toContain('Contacts saved on this device');
    expect(html).toContain('scope="col"');
    expect(html).toContain('Official source');
    expect(html).toContain('font-size:1.12rem');
  });

  it('renders source form labels, required fields and an error alert', () => {
    const html = renderToStaticMarkup(
      <OfflineEmergencyCardSourceForm
        jurisdictions={[
          { id: 'NATIONAL', name: 'All India', state: 'India' },
          { id: 'LKO', name: 'Lucknow', state: 'Uttar Pradesh' },
        ]}
        defaultJurisdictionId="LKO"
        onSubmit={() => {}}
        onCancel={() => {}}
        busy={false}
        error="The official URL must start with https://."
      />
    );

    expect(html).toContain('Add an official source');
    expect(html).toContain('for="source-title"');
    expect(html).toContain('for="source-publisher"');
    expect(html).toContain('for="source-url"');
    expect(html).toContain('for="source-jurisdiction"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('must start with https://');
    expect((html.match(/required=""/g) || []).length).toBeGreaterThanOrEqual(4);
    expect(html).toContain('Save source');
  });
});
