import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, ShieldCheck, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { useToast } from '../context/ToastContext';
import OfflineEmergencyCardHeader from '../components/offlineEmergencyCard/OfflineEmergencyCardHeader.jsx';
import OfflineEmergencyCardPublicView from '../components/offlineEmergencyCard/OfflineEmergencyCardPublicView.jsx';
import OfflineEmergencyCardInstalledView from '../components/offlineEmergencyCard/OfflineEmergencyCardInstalledView.jsx';
import OfflineEmergencyCardStaffPanel from '../components/offlineEmergencyCard/OfflineEmergencyCardStaffPanel.jsx';
import {
  OfflineCardErrorState,
  OfflineCardOfflineBanner,
  OfflineCardPermissionDenied,
  OfflineCardSkeleton,
} from '../components/offlineEmergencyCard/OfflineEmergencyCardStates.jsx';
import {
  OFFLINE_CARD_ERROR_CODES,
  OFFLINE_CARD_ROLES,
  STAFF_OFFLINE_CARD_ROLES,
} from '../services/offlineEmergencyCardConstants.js';
import {
  archiveContactSource,
  createContact,
  createContactSource,
  decideRecommendation,
  deleteLocalCard,
  exportCard,
  generateRecommendations,
  getActorScope,
  getInstalledCard,
  getMetadata,
  getPublicCard,
  getStorageHealth,
  installCard,
  listAuditEvents,
  listContacts,
  listContactSources,
  listJurisdictions,
  listRecommendations,
  refreshCard,
  resetToEmpty,
  restoreMigrationBackup,
  reviewContact,
  runMigrationRollback,
  runRetention,
  saveCardPreferences,
  submitContact,
  toUserMessage,
  updateContact,
} from '../services/offlineEmergencyCardService.js';

const makeIdempotencyKey = (prefix) => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const draftFromPreference = (preference) => ({
  note: preference?.note || '',
  includeNational: preference?.includeNational !== false,
  largeText: Boolean(preference?.largeText),
  showTable: Boolean(preference?.showTable),
});

const loadPublicState = (jurisdictionId) => {
  try {
    return {
      card: getPublicCard({ jurisdictionId, includeNational: true }),
      error: null,
    };
  } catch (caught) {
    return { card: null, error: caught };
  }
};

const loadInstalledState = (actor) => {
  try {
    return { installed: getInstalledCard(actor), error: null };
  } catch (caught) {
    return { installed: null, error: caught };
  }
};

const loadStaffState = (actor, isStaff) => {
  if (!isStaff) {
    return {
      contacts: [],
      sources: [],
      recommendations: [],
      audit: [],
      scope: null,
      error: null,
    };
  }
  try {
    const scope = getActorScope(actor);
    const contacts = listContacts({ page: 1, pageSize: 100 }, actor).items;
    const sources = listContactSources({ page: 1, pageSize: 100 }, actor).items;
    const recommendations = listRecommendations({ page: 1, pageSize: 100 }, actor).items;
    const audit = listAuditEvents({ page: 1, pageSize: 100 }, actor).items;
    return { contacts, sources, recommendations, audit, scope, error: null };
  } catch (caught) {
    return {
      contacts: [],
      sources: [],
      recommendations: [],
      audit: [],
      scope: null,
      error: caught,
    };
  }
};

const downloadText = (filename, text, mimeType) => {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
    return false;
  }
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
};

export default function OfflineEmergencyCardWorkspace() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const { toast } = useToast();

  const [activeRole, setActiveRole] = useState(() =>
    user?.role === 'admin' ? OFFLINE_CARD_ROLES.ADMIN : OFFLINE_CARD_ROLES.CITIZEN
  );
  const [activeTab, setActiveTab] = useState('public');
  const [jurisdictionId, setJurisdictionId] = useState('LKO');
  const [selectedRefs, setSelectedRefs] = useState([]);
  const [publicQuery, setPublicQuery] = useState('');
  const [publicCategory, setPublicCategory] = useState('all');
  const [publicFreshness, setPublicFreshness] = useState('all');
  const [showPublicTable, setShowPublicTable] = useState(false);
  const [preferenceDraftOverride, setPreferenceDraftOverride] = useState(null);
  const [, setRefreshTick] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState(null);
  const [error, setError] = useState(null);
  const [announcement, setAnnouncement] = useState('');

  const isStaff = STAFF_OFFLINE_CARD_ROLES.includes(activeRole);
  const isReviewer = [OFFLINE_CARD_ROLES.REVIEWER, OFFLINE_CARD_ROLES.ADMIN].includes(activeRole);
  const isAdmin = activeRole === OFFLINE_CARD_ROLES.ADMIN;

  const actor = useMemo(
    () => ({
      id: user?.id || 'usr_offline_card_demo',
      username: user?.username || user?.name || (isStaff ? 'MunicipalCardStaff' : 'PublicVisitor'),
      role: activeRole === OFFLINE_CARD_ROLES.ADMIN ? 'admin' : activeRole,
      offlineCardRole: activeRole,
      jurisdictionId,
    }),
    [user, activeRole, isStaff, jurisdictionId]
  );

  const notify = useCallback(
    (type, title, message) => {
      toast({ type, title, message });
      setAnnouncement(`${title}. ${message}`);
    },
    [toast]
  );

  const refresh = useCallback(() => {
    setRefreshTick((current) => current + 1);
    setIsRefreshing(true);
  }, []);

  useEffect(() => {
    if (!isRefreshing) return undefined;
    const timer = setTimeout(() => setIsRefreshing(false), 180);
    return () => clearTimeout(timer);
  }, [isRefreshing]);

  const jurisdictions = useMemo(() => listJurisdictions(), []);
  const metadata = useMemo(() => getMetadata(), []);

  // Storage-backed reads run on every render. A write calls setRefreshTick to
  // trigger a render; the reads themselves are cheap and keep the cache-free
  // local-first model easy to reason about.
  const publicState = loadPublicState(jurisdictionId);
  const installedState = loadInstalledState(actor);
  const staffState = loadStaffState(actor, isStaff);
  const preferenceDraft =
    preferenceDraftOverride ?? draftFromPreference(installedState.installed?.preference);

  const runAction = useCallback(
    async (name, action) => {
      setBusyAction(name);
      setError(null);
      try {
        const result = await action();
        setRefreshTick((current) => current + 1);
        return result === undefined ? true : result;
      } catch (caught) {
        const info = {
          code: caught?.code || OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
          message: toUserMessage(caught),
        };
        setError(info);
        notify('error', 'Action not completed', info.message);
        return false;
      } finally {
        setBusyAction(null);
      }
    },
    [notify]
  );

  const handleRoleChange = (role) => {
    setActiveRole(role);
    setError(null);
    if (!STAFF_OFFLINE_CARD_ROLES.includes(role)) setActiveTab('public');
  };

  const handleJurisdictionChange = (nextJurisdictionId) => {
    setJurisdictionId(nextJurisdictionId);
    setSelectedRefs([]);
    setPublicQuery('');
    setPublicCategory('all');
    setPublicFreshness('all');
    setError(null);
    setPreferenceDraftOverride(null);
    setRefreshTick((current) => current + 1);
  };

  const toggleRef = (publicRef) => {
    setSelectedRefs((current) =>
      current.includes(publicRef)
        ? current.filter((ref) => ref !== publicRef)
        : [...current, publicRef]
    );
  };

  const toggleAll = (contacts) => {
    const refs = contacts.map((contact) => contact.publicRef);
    setSelectedRefs((current) => (refs.every((ref) => current.includes(ref)) ? [] : refs));
  };

  const handleInstall = () =>
    runAction('install', async () => {
      const result = installCard(
        {
          jurisdictionId,
          includeNational: true,
          selectedContactRefs: selectedRefs,
          note: preferenceDraft.note,
          largeText: preferenceDraft.largeText,
          showTable: preferenceDraft.showTable,
          idempotencyKey: makeIdempotencyKey('install'),
        },
        actor,
        { online: isOnline }
      );
      notify(
        'success',
        result.offlineInstall ? 'Card installed offline' : 'Offline card installed',
        `${result.card.contactCount} verified contacts are saved on this device.`
      );
      setPreferenceDraftOverride(null);
      setActiveTab('installed');
      return true;
    });

  const handleRefresh = () =>
    runAction('refresh', async () => {
      const result = refreshCard(actor, {
        online: isOnline,
        idempotencyKey: makeIdempotencyKey('refresh'),
      });
      notify(
        'success',
        result.offlineRefresh ? 'Offline copy refreshed' : 'Card refreshed',
        result.changed
          ? `The card now has ${result.card.contactCount} contacts.`
          : 'The card is already up to date with the approved records on this device.'
      );
      return true;
    });

  const handleSavePreferences = () =>
    runAction('preferences', async () => {
      const existingRefs = installedState.installed?.preference?.selectedContactRefs || [];
      saveCardPreferences(
        {
          jurisdictionId,
          selectedContactRefs: selectedRefs.length > 0 ? selectedRefs : existingRefs,
          note: preferenceDraft.note,
          includeNational: preferenceDraft.includeNational,
          largeText: preferenceDraft.largeText,
          showTable: preferenceDraft.showTable,
          expectedVersion: installedState.installed?.preference?.version,
        },
        actor,
        { idempotencyKey: makeIdempotencyKey('preferences') }
      );
      notify('success', 'Preferences saved', 'Your note and display preferences are stored on this device only.');
      setPreferenceDraftOverride(null);
      return true;
    });

  const handleDelete = () =>
    runAction('delete', async () => {
      deleteLocalCard(actor);
      notify('success', 'Card deleted from this device', 'The saved contacts, note and snapshot were removed immediately.');
      setPreferenceDraftOverride(null);
      setActiveTab('public');
      return true;
    });

  const handleExport = () =>
    runAction('export', async () => {
      const payload = exportCard(actor);
      const downloaded = downloadText(
        `offline-emergency-card-${jurisdictionId.toLowerCase()}.json`,
        JSON.stringify(payload, null, 2),
        'application/json'
      );
      notify(
        'success',
        'Card export prepared',
        downloaded
          ? 'A public copy without internal identifiers or account details was downloaded.'
          : 'Downloads are unavailable in this browser, but the card remains available offline.'
      );
      return true;
    });

  const handleCreateContact = (payload) =>
    runAction('contact-form', async () => {
      const result = createContact(
        { ...payload, idempotencyKey: makeIdempotencyKey('contact') },
        actor
      );
      notify('success', 'Draft contact saved', `${result.contact.name} is ready to submit for verification.`);
      return true;
    });

  const handleUpdateContact = (contactId, payload) =>
    runAction('contact-form', async () => {
      const result = updateContact(contactId, payload, actor);
      notify('success', 'Contact updated', `Version ${result.contact.version} was saved and is ready for review.`);
      return true;
    });

  const handleSubmitContact = (contactId) =>
    runAction(`submit-${contactId}`, async () => {
      const contact = staffState.contacts.find((item) => item.id === contactId);
      submitContact(contactId, actor, { expectedVersion: contact?.version });
      notify('success', 'Submitted for verification', 'A reviewer must check the official source before it appears on the public card.');
      return true;
    });

  const handleReviewContact = (contactId, action, payload) =>
    runAction(`review-${contactId}-${action}`, async () => {
      reviewContact(contactId, action, payload, actor);
      notify(
        'success',
        'Review decision recorded',
        action === 'approve'
          ? 'The contact is published with a new verification date and source link.'
          : 'The decision and its reason were written to the audit trail.'
      );
      return true;
    });

  const handleCreateSource = (payload) =>
    runAction('source-form', async () => {
      const result = createContactSource(
        { ...payload, idempotencyKey: makeIdempotencyKey('source') },
        actor
      );
      notify(
        'success',
        result.alreadyExists ? 'Source already recorded' : 'Official source saved',
        result.source.title
      );
      return true;
    });

  const handleArchiveSource = (sourceId, reason) =>
    runAction(`archive-source-${sourceId}`, async () => {
      archiveContactSource(sourceId, { reason }, actor);
      notify('success', 'Source archived', 'The source can no longer back a published contact.');
      return true;
    });

  const handleGenerateRecommendations = () =>
    runAction('generate-recommendations', async () => {
      const result = generateRecommendations({ jurisdictionId }, actor);
      notify(
        'success',
        'Recommendations generated',
        `${result.created.length} new deterministic suggestions need a human decision.`
      );
      return true;
    });

  const handleDecideRecommendation = (recommendationId, payload) =>
    runAction(`recommendation-${recommendationId}`, async () => {
      decideRecommendation(recommendationId, payload, actor);
      notify('success', 'Recommendation decision recorded', 'The human decision and reason are in the audit trail.');
      return true;
    });

  const handleRunRetention = () =>
    runAction('retention', async () => {
      const result = runRetention({}, actor);
      notify(
        'success',
        'Retention policy applied',
        `${result.counts.syncEventsRemoved} sync events and ${result.counts.archivedContactsRemoved} long-archived contacts removed.`
      );
      return true;
    });

  const handleRollback = (reason) =>
    runAction('rollback', async () => {
      const result = runMigrationRollback({ reason }, actor);
      notify(
        'success',
        'Rolled back to the verified seed',
        result.backupPersisted ? 'The previous bundle was copied to a local backup first.' : 'Seed restored.'
      );
      return true;
    });

  const handleRestoreBackup = () =>
    runAction('restore', async () => {
      restoreMigrationBackup(actor);
      notify('success', 'Backup restored', 'The previous local card bundle is active again.');
      return true;
    });

  const handleReset = () =>
    runAction('reset', async () => {
      resetToEmpty(actor);
      notify('success', 'Card store reset', 'All local contacts, sources and preferences were removed.');
      setActiveTab('public');
      return true;
    });

  const installed = installedState.installed;
  const publicCard = publicState.card;
  const activeError = error || publicState.error || staffState.error || installedState.error;
  const storage = getStorageHealth();
  const showPermissionDenied =
    activeError?.code === OFFLINE_CARD_ERROR_CODES.PERMISSION_DENIED ||
    activeError?.code === OFFLINE_CARD_ERROR_CODES.UNAUTHENTICATED ||
    activeError?.code === OFFLINE_CARD_ERROR_CODES.JURISDICTION_DENIED;

  const tabs = [
    { id: 'public', label: 'Public card', Icon: ShieldCheck },
    { id: 'installed', label: 'My card', Icon: Smartphone },
    ...(isStaff ? [{ id: 'staff', label: 'Staff administration', Icon: ClipboardList }] : []),
  ];

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '1.25rem 1rem 3rem' }}>
      <OfflineEmergencyCardHeader
        activeRole={activeRole}
        onRoleChange={handleRoleChange}
        jurisdictions={jurisdictions}
        jurisdictionId={jurisdictionId}
        onJurisdictionChange={handleJurisdictionChange}
        isOnline={isOnline}
        installed={Boolean(installed?.installed)}
        selectedCount={selectedRefs.length}
        onInstall={handleInstall}
        onRefresh={handleRefresh}
        onExport={installed?.installed ? handleExport : null}
        canInstall={Boolean(publicCard)}
        canRefresh={Boolean(installed?.installed)}
        canExport={Boolean(installed?.installed)}
        onNewContact={isStaff ? () => setActiveTab('staff') : null}
        canCreateContact={isStaff}
        storage={storage}
      />

      <div role="tablist" aria-label="Offline emergency card sections" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1rem' }}>
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`offline-card-section-${id}`}
            aria-selected={activeTab === id}
            aria-controls={`offline-card-section-panel-${id}`}
            className={activeTab === id ? 'btn btn-primary' : 'btn btn-secondary'}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={15} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="sr-only">{announcement}</div>

      {!isOnline && (
        <OfflineCardOfflineBanner
          lastRefreshedAt={installed?.card?.lastRefreshedAt}
          onRefresh={installed?.installed ? handleRefresh : null}
          canRefresh={Boolean(installed?.installed)}
        />
      )}

      {isRefreshing ? (
        <OfflineCardSkeleton />
      ) : showPermissionDenied ? (
        <OfflineCardPermissionDenied message={activeError.message} role={activeRole} />
      ) : activeError && !publicCard && !installed?.installed ? (
        <OfflineCardErrorState
          message={activeError.message}
          code={activeError.code}
          onRetry={refresh}
        />
      ) : (
        <div
          role="tabpanel"
          id={`offline-card-section-panel-${activeTab}`}
          aria-labelledby={`offline-card-section-${activeTab}`}
        >
          {activeTab === 'public' && publicCard && (
            <OfflineEmergencyCardPublicView
              card={publicCard}
              query={publicQuery}
              onQueryChange={setPublicQuery}
              category={publicCategory}
              onCategoryChange={setPublicCategory}
              freshness={publicFreshness}
              onFreshnessChange={setPublicFreshness}
              selectedRefs={selectedRefs}
              onToggleRef={toggleRef}
              onToggleAll={toggleAll}
              showTable={showPublicTable}
              onShowTableChange={setShowPublicTable}
              onInstall={handleInstall}
              canInstall
            />
          )}

          {activeTab === 'installed' && installed && (
            <OfflineEmergencyCardInstalledView
              installed={installed}
              isOnline={isOnline}
              preferenceDraft={preferenceDraft}
              onPreferenceChange={(field, value) =>
                setPreferenceDraftOverride((current) => ({
                  ...(current ?? preferenceDraft),
                  [field]: value,
                }))
              }
              onSavePreferences={handleSavePreferences}
              onRefresh={handleRefresh}
              onExport={handleExport}
              onDelete={handleDelete}
              onGoToPublic={() => setActiveTab('public')}
              busyAction={busyAction}
              storage={storage}
            />
          )}

          {activeTab === 'staff' && isStaff && (
            <OfflineEmergencyCardStaffPanel
              scope={staffState.scope}
              contacts={staffState.contacts}
              sources={staffState.sources}
              recommendations={staffState.recommendations}
              audit={staffState.audit}
              jurisdictions={jurisdictions}
              busyAction={busyAction}
              error={error || staffState.error}
              storage={storage}
              onRefresh={refresh}
              onCreateContact={handleCreateContact}
              onUpdateContact={handleUpdateContact}
              onSubmitContact={handleSubmitContact}
              onReviewContact={handleReviewContact}
              onGenerateRecommendations={handleGenerateRecommendations}
              onDecideRecommendation={handleDecideRecommendation}
              onCreateSource={handleCreateSource}
              onArchiveSource={handleArchiveSource}
              onRunRetention={handleRunRetention}
              onRollback={handleRollback}
              onRestoreBackup={handleRestoreBackup}
              onReset={handleReset}
              isAdmin={isAdmin}
              isReviewer={isReviewer}
            />
          )}

          {activeTab === 'public' && !publicCard && (
            <OfflineCardErrorState
              message={publicState.error?.message || 'The public card could not be loaded.'}
              code={publicState.error?.code}
              onRetry={refresh}
            />
          )}
        </div>
      )}

      <p style={{ marginTop: '1.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        {metadata.methodologyNote}
      </p>
    </div>
  );
}
