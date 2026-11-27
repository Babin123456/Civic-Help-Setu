import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import OfflineEmergencyCardWorkspace from './OfflineEmergencyCardWorkspace.jsx';
import OfflineEmergencyCardStaffPanel from '../components/offlineEmergencyCard/OfflineEmergencyCardStaffPanel.jsx';
import {
  OfflineCardEmptyState,
  OfflineCardErrorState,
  OfflineCardFreshnessBadge,
  OfflineCardLowStorageBanner,
  OfflineCardOfflineBanner,
  OfflineCardPermissionDenied,
  OfflineCardSkeleton,
  OfflineCardStaleNotice,
  OfflineCardStatusBadge,
  OfflineCardSummary,
} from '../components/offlineEmergencyCard/OfflineEmergencyCardStates.jsx';
import {
  CONTACT_FRESHNESS,
  OFFLINE_CARD_ROLES,
  OFFLINE_CARD_STORAGE_KEY,
} from '../services/offlineEmergencyCardConstants.js';
import {
  createContact,
  generateRecommendations,
  getActorScope,
  listAuditEvents,
  listContacts,
  listContactSources,
  listRecommendations,
  resetOfflineCardRateLimitsForTests,
} from '../services/offlineEmergencyCardService.js';
import { resetOfflineCardStorageForTests } from '../services/offlineEmergencyCardMigrations.js';

const mockAuthState = { user: null };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));
vi.mock('../context/NetworkContext', () => ({
  useNetwork: () => ({ isOnline: true }),
}));
vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const reviewer = {
  id: 'reviewer-1',
  username: 'ReviewerLucknow',
  role: 'reviewer',
  offlineCardRole: OFFLINE_CARD_ROLES.REVIEWER,
  jurisdictionId: 'LKO',
};
const operator = {
  id: 'operator-1',
  username: 'OperatorLucknow',
  role: 'operator',
  offlineCardRole: OFFLINE_CARD_ROLES.OPERATOR,
  jurisdictionId: 'LKO',
};

const renderWorkspace = () =>
  renderToStaticMarkup(
    <MemoryRouter>
      <OfflineEmergencyCardWorkspace />
    </MemoryRouter>
  );

describe('OfflineEmergencyCardWorkspace and component states (#761)', () => {
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear(),
    });
    resetOfflineCardStorageForTests();
    resetOfflineCardRateLimitsForTests();
    localStorage.removeItem(OFFLINE_CARD_STORAGE_KEY);
    mockAuthState.user = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the public card, role and jurisdiction controls, and installation actions', () => {
    const html = renderWorkspace();

    expect(html).toContain('Offline Emergency Civic Information Card');
    expect(html).toContain('Verified local contacts');
    expect(html).toContain('Jurisdiction');
    expect(html).toContain('Role perspective');
    expect(html).toContain('Citizen / public');
    expect(html).toContain('Operator');
    expect(html).toContain('Reviewer');
    expect(html).toContain('Administrator');
    expect(html).toContain('aria-label="Offline emergency card sections"');
    expect(html).toContain('Public card');
    expect(html).toContain('My card');
    expect(html).toContain('Install card');
    expect(html).toContain('Approved emergency card for Lucknow');
    expect(html).toContain('National Emergency Response Support System');
    expect(html).toContain('Last verified:');
    expect(html).toContain('Source:');
    expect(html).toContain('Recently verified');
    expect(html).toContain('Outdated');
    expect(html).toContain('Show table view');
    expect(html).toContain('Search contacts');
    expect(html).toContain('Verification state');
  });

  it('shows verification dates and source links for every public contact', () => {
    const html = renderWorkspace();
    expect(html).toContain('lucknow.nic.in');
    expect(html).toContain('112.gov.in');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer noopener"');
    expect(html).toContain('tel:112');
    expect(html).toContain('tel:1090');
  });

  it('does not expose internal identifiers or audit details on the public card', () => {
    const html = renderWorkspace();
    expect(html).not.toContain('contact-lko-fire-101');
    expect(html).not.toContain('src-lko-district');
    expect(html).not.toContain('idempotencyKey');
    expect(html).not.toContain('auditEvents');
    expect(html).not.toContain('operator-1');
  });

  it('keeps the staff tab hidden from citizens', () => {
    const html = renderWorkspace();
    expect(html).not.toContain('Staff administration');
    expect(html).not.toContain('Verified contact administration');
  });

  it('renders the staff workspace with the review queue, sources, recommendations and audit tabs', () => {
    generateRecommendations({ jurisdictionId: 'LKO' }, reviewer);
    const contacts = listContacts({ page: 1, pageSize: 100 }, reviewer).items;
    const sources = listContactSources({ page: 1, pageSize: 100 }, reviewer).items;
    const recommendations = listRecommendations({ page: 1, pageSize: 100 }, reviewer).items;
    const audit = listAuditEvents({ page: 1, pageSize: 100 }, reviewer).items;
    const scope = getActorScope(reviewer);

    const html = renderToStaticMarkup(
      <OfflineEmergencyCardStaffPanel
        activeRole={OFFLINE_CARD_ROLES.REVIEWER}
        scope={scope}
        contacts={contacts}
        sources={sources}
        recommendations={recommendations}
        audit={audit}
        jurisdictions={[
          { id: 'NATIONAL', name: 'All India', state: 'India' },
          { id: 'LKO', name: 'Lucknow', state: 'Uttar Pradesh' },
        ]}
        busyAction={null}
        error={null}
        storage={{ persisted: true }}
        onRefresh={() => {}}
        onCreateContact={() => true}
        onUpdateContact={() => true}
        onSubmitContact={() => true}
        onReviewContact={() => true}
        onGenerateRecommendations={() => true}
        onDecideRecommendation={() => true}
        onCreateSource={() => true}
        onArchiveSource={() => true}
        onRunRetention={() => true}
        onRollback={() => true}
        onRestoreBackup={() => true}
        onReset={() => true}
        isAdmin={false}
        isReviewer
      />
    );

    expect(html).toContain('Verified contact administration');
    expect(html).toContain('Review queue');
    expect(html).toContain('Official sources');
    expect(html).toContain('Recommendations');
    expect(html).toContain('Audit trail');
    expect(html).not.toContain('offline-card-tab-admin');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('Lucknow Fire and Emergency Services');
  });

  it('shows operator-only drafting controls without reviewer-only audit access', () => {
    createContact(
      {
        name: 'Lucknow Drainage Emergency Line',
        organization: 'Lucknow Municipal Corporation',
        category: 'municipal',
        jurisdictionId: 'LKO',
        sourceId: 'src-lko-district',
        phone: '1092',
        hours: '24 hours, 7 days',
        languages: ['Hindi'],
        description: 'Blocked drain and local flooding assistance.',
      },
      operator
    );
    const contacts = listContacts({ page: 1, pageSize: 100 }, operator).items;
    const html = renderToStaticMarkup(
      <OfflineEmergencyCardStaffPanel
        activeRole={OFFLINE_CARD_ROLES.OPERATOR}
        scope={getActorScope(operator)}
        contacts={contacts}
        sources={listContactSources({ page: 1, pageSize: 100 }, operator).items}
        recommendations={[]}
        audit={[]}
        jurisdictions={[{ id: 'LKO', name: 'Lucknow', state: 'Uttar Pradesh' }]}
        busyAction={null}
        error={null}
        storage={{ persisted: true }}
        onRefresh={() => {}}
        onCreateContact={() => true}
        onUpdateContact={() => true}
        onSubmitContact={() => true}
        onReviewContact={() => true}
        onGenerateRecommendations={() => true}
        onDecideRecommendation={() => true}
        onCreateSource={() => true}
        onArchiveSource={() => true}
        onRunRetention={() => true}
        onRollback={() => true}
        onRestoreBackup={() => true}
        onReset={() => true}
        isAdmin={false}
        isReviewer={false}
      />
    );

    expect(html).toContain('New contact');
    expect(html).toContain('Submit for verification');
    expect(html).not.toContain('Verify and publish');
    expect(html).not.toContain('Generate recommendations');
  });

  it('renders loading, offline, empty, error and permission-denied states', () => {
    const skeleton = renderToStaticMarkup(<OfflineCardSkeleton count={2} />);
    expect(skeleton).toContain('role="status"');
    expect(skeleton).toContain('Loading the offline emergency card');

    const offline = renderToStaticMarkup(
      <OfflineCardOfflineBanner
        lastRefreshedAt="2026-11-20T10:00:00.000Z"
        onRefresh={() => {}}
      />
    );
    expect(offline).toContain('Offline mode.');
    expect(offline).toContain('Refresh offline copy');

    const empty = renderToStaticMarkup(<OfflineCardEmptyState title="Nothing here" />);
    expect(empty).toContain('Nothing here');

    const error = renderToStaticMarkup(
      <OfflineCardErrorState message="Saved data was kept." code="OFFLINE_CARD_MIGRATION_FAILED" onRetry={() => {}} />
    );
    expect(error).toContain('role="alert"');
    expect(error).toContain('Saved data was kept.');
    expect(error).toContain('OFFLINE_CARD_MIGRATION_FAILED');
    expect(error).toContain('Try again');

    const denied = renderToStaticMarkup(<OfflineCardPermissionDenied role="citizen" />);
    expect(denied).toContain('Your role cannot open this section');
    expect(denied).toContain('citizen');
  });

  it('renders stale warnings with the source to re-check', () => {
    const html = renderToStaticMarkup(
      <OfflineCardStaleNotice
        contactName="Lucknow Fire and Emergency Services"
        lastVerifiedAt="2025-10-20T00:00:00.000Z"
        source={{ title: 'Lucknow District Administration' }}
        onRefresh={() => {}}
      />
    );
    expect(html).toContain('Outdated contact.');
    expect(html).toContain('Lucknow Fire and Emergency Services');
    expect(html).toContain('Lucknow District Administration');
    expect(html).toContain('Check for updates');
  });

  it('renders low-storage and summary states', () => {
    const low = renderToStaticMarkup(
      <OfflineCardLowStorageBanner storage={{ persisted: false, level: 'memory_only' }} />
    );
    expect(low).toContain('role="alert"');
    expect(low).toContain('Low device storage.');

    const near = renderToStaticMarkup(
      <OfflineCardLowStorageBanner storage={{ persisted: true, level: 'near_limit' }} />
    );
    expect(near).toContain('Device storage is almost full.');

    const summary = renderToStaticMarkup(
      <OfflineCardSummary
        summary={{
          totalContacts: 12,
          freshContacts: 8,
          reviewDueContacts: 2,
          staleContacts: 2,
          categoriesCovered: 7,
        }}
      />
    );
    expect(summary).toContain('Contacts');
    expect(summary).toContain('Outdated');
    expect(summary).toContain('12');
  });

  it('writes freshness state in text, not only colour', () => {
    const fresh = renderToStaticMarkup(
      <OfflineCardFreshnessBadge freshness={{ state: CONTACT_FRESHNESS.FRESH }} />
    );
    const stale = renderToStaticMarkup(
      <OfflineCardFreshnessBadge freshness={{ state: CONTACT_FRESHNESS.STALE }} />
    );
    const review = renderToStaticMarkup(
      <OfflineCardFreshnessBadge freshness={{ state: CONTACT_FRESHNESS.REVIEW_DUE }} />
    );
    expect(fresh).toContain('Recently verified');
    expect(stale).toContain('Outdated');
    expect(review).toContain('Review due soon');

    const badge = renderToStaticMarkup(<OfflineCardStatusBadge label="Published" tone="success" />);
    expect(badge).toContain('Published');
  });

  it('uses accessible headings, labels, live regions and table semantics', () => {
    const html = renderWorkspace();
    expect((html.match(/<h1/g) || []).length).toBe(1);
    expect(html).toContain('for="offline-card-search"');
    expect(html).toContain('for="offline-card-category"');
    expect(html).toContain('for="offline-card-freshness"');
    expect(html).toContain('for="offline-card-role"');
    expect(html).toContain('for="offline-card-jurisdiction"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-label="Select National Emergency Response Support System (ERSS) for the offline card"');
  });
});
