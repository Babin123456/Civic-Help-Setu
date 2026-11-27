import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ClipboardCheck,
  FileText,
  History,
  ListChecks,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  CONTACT_ACTION,
  CONTACT_ACTION_LABELS,
  CONTACT_STATUS,
  OFFLINE_CARD_CATEGORY_LABELS,
  OFFLINE_CARD_LIMITS,
  RECOMMENDATION_STATUS,
} from '../../services/offlineEmergencyCardConstants.js';
import {
  OfflineCardEmptyState,
  OfflineCardErrorState,
  OfflineCardFreshnessBadge,
  OfflineCardLowStorageBanner,
  OfflineCardStatusBadge,
} from './OfflineEmergencyCardStates.jsx';
import OfflineEmergencyCardContactForm from './OfflineEmergencyCardContactForm.jsx';
import OfflineEmergencyCardSourceForm from './OfflineEmergencyCardSourceForm.jsx';

const STATUS_TONES = {
  [CONTACT_STATUS.PUBLISHED]: 'success',
  [CONTACT_STATUS.PENDING_REVIEW]: 'warning',
  [CONTACT_STATUS.CHANGES_REQUESTED]: 'danger',
  [CONTACT_STATUS.DRAFT]: 'neutral',
  [CONTACT_STATUS.ARCHIVED]: 'neutral',
};

const PRIORITY_TONES = { critical: 'danger', high: 'warning', routine: 'info' };

const fieldStyle = {
  width: '100%',
  padding: '0.4rem 0.55rem',
  borderRadius: 6,
  border: '1px solid var(--border-main)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  fontSize: '0.82rem',
};

const actionReasonLabel = (action) => {
  if (action === CONTACT_ACTION.APPROVE) return 'Verification note';
  if (action === CONTACT_ACTION.REQUEST_CHANGES) return 'What must the operator change?';
  if (action === CONTACT_ACTION.ARCHIVE) return 'Why is this contact being archived?';
  return 'Why is this contact being restored?';
};

function ReviewActionForm({ contact, action, onSubmit, onCancel, busy }) {
  const [reason, setReason] = useState('');
  const [verificationMethod, setVerificationMethod] = useState('Official source checked manually');
  const [lastVerifiedAt, setLastVerifiedAt] = useState(new Date().toISOString().slice(0, 10));
  const requiresReason = [
    CONTACT_ACTION.REQUEST_CHANGES,
    CONTACT_ACTION.ARCHIVE,
    CONTACT_ACTION.RESTORE,
  ].includes(action);

  const submit = (event) => {
    event.preventDefault();
    onSubmit({
      reason,
      verificationMethod,
      lastVerifiedAt,
      expectedVersion: contact.version,
    });
  };

  return (
    <form onSubmit={submit} style={{ marginTop: '0.5rem', padding: '0.65rem', background: 'var(--bg-secondary)', borderRadius: 6 }}>
      <p style={{ margin: '0 0 0.45rem', fontSize: '0.8rem', fontWeight: 700 }}>
        {CONTACT_ACTION_LABELS[action]} — {contact.name}
      </p>
      {action === CONTACT_ACTION.APPROVE && (
        <div style={{ display: 'grid', gap: '0.45rem', marginBottom: '0.45rem' }}>
          <div>
            <label htmlFor={`verify-method-${contact.id}`} style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700 }}>
              How was the official source checked?
            </label>
            <input
              id={`verify-method-${contact.id}`}
              style={fieldStyle}
              value={verificationMethod}
              onChange={(event) => setVerificationMethod(event.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor={`verify-date-${contact.id}`} style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700 }}>
              Date verified
            </label>
            <input
              id={`verify-date-${contact.id}`}
              style={fieldStyle}
              type="date"
              value={lastVerifiedAt}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setLastVerifiedAt(event.target.value)}
              required
            />
          </div>
        </div>
      )}
      <label htmlFor={`review-reason-${contact.id}`} style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700 }}>
        {actionReasonLabel(action)}
        {requiresReason ? ' (required, written to the audit trail)' : ' (optional)'}
      </label>
      <textarea
        id={`review-reason-${contact.id}`}
        style={{ ...fieldStyle, resize: 'vertical' }}
        rows={2}
        value={reason}
        maxLength={OFFLINE_CARD_LIMITS.MAX_REASON_LENGTH}
        onChange={(event) => setReason(event.target.value)}
        required={requiresReason}
      />
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.45rem' }}>
        <button type="submit" className="btn btn-primary" style={{ fontSize: '0.78rem' }} disabled={busy}>
          Confirm {CONTACT_ACTION_LABELS[action].toLowerCase()}
        </button>
        <button type="button" className="btn btn-secondary" style={{ fontSize: '0.78rem' }} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function RecommendationDecisionForm({ recommendation, action, onSubmit, onCancel, busy }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState(recommendation.humanNote || '');
  const isReject = action === 'reject';
  const isEdit = action === 'edit';

  const submit = (event) => {
    event.preventDefault();
    onSubmit({ action, reason, note, expectedVersion: recommendation.version });
  };

  return (
    <form onSubmit={submit} style={{ marginTop: '0.5rem', padding: '0.65rem', background: 'var(--bg-secondary)', borderRadius: 6 }}>
      <p style={{ margin: '0 0 0.45rem', fontSize: '0.8rem', fontWeight: 700 }}>
        {isReject ? 'Reject' : 'Edit'} recommendation — {recommendation.ruleLabel}
      </p>
      <label htmlFor={`rec-note-${recommendation.id}`} style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700 }}>
        Human note {isEdit ? '(required)' : '(optional)'}
      </label>
      <textarea
        id={`rec-note-${recommendation.id}`}
        style={{ ...fieldStyle, resize: 'vertical' }}
        rows={2}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        required={isEdit}
      />
      <label htmlFor={`rec-reason-${recommendation.id}`} style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginTop: '0.4rem' }}>
        Reason {isReject ? '(required)' : '(optional)'}
      </label>
      <textarea
        id={`rec-reason-${recommendation.id}`}
        style={{ ...fieldStyle, resize: 'vertical' }}
        rows={2}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        required={isReject}
      />
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.45rem' }}>
        <button type="submit" className="btn btn-primary" style={{ fontSize: '0.78rem' }} disabled={busy}>
          Record decision
        </button>
        <button type="button" className="btn btn-secondary" style={{ fontSize: '0.78rem' }} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function OfflineEmergencyCardStaffPanel({
  scope,
  contacts = [],
  sources = [],
  recommendations = [],
  audit = [],
  jurisdictions = [],
  busyAction,
  error,
  storage,
  onRefresh,
  onCreateContact,
  onUpdateContact,
  onSubmitContact,
  onReviewContact,
  onGenerateRecommendations,
  onDecideRecommendation,
  onCreateSource,
  onArchiveSource,
  onRunRetention,
  onRollback,
  onRestoreBackup,
  onReset,
  isAdmin = false,
  isReviewer = false,
}) {
  const [tab, setTab] = useState('contacts');
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [actionPanel, setActionPanel] = useState(null);
  const [recommendationPanel, setRecommendationPanel] = useState(null);
  const [sourceArchiveId, setSourceArchiveId] = useState(null);
  const [sourceArchiveReason, setSourceArchiveReason] = useState('');
  const [rollbackReason, setRollbackReason] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const pendingReview = useMemo(
    () => contacts.filter((contact) => contact.status === CONTACT_STATUS.PENDING_REVIEW),
    [contacts]
  );
  const pendingRecommendations = useMemo(
    () => recommendations.filter((recommendation) => recommendation.status === RECOMMENDATION_STATUS.PENDING),
    [recommendations]
  );

  const tabs = [
    { id: 'contacts', label: 'Contacts', Icon: FileText },
    { id: 'review', label: `Review queue (${pendingReview.length})`, Icon: ClipboardCheck },
    { id: 'sources', label: 'Official sources', Icon: ShieldCheck },
    { id: 'recommendations', label: `Recommendations (${pendingRecommendations.length})`, Icon: ListChecks },
    { id: 'audit', label: 'Audit trail', Icon: History },
  ];
  if (isAdmin) tabs.push({ id: 'admin', label: 'Administration', Icon: Archive });

  const openEdit = (contact) => {
    setEditingContact(contact);
    setShowContactForm(true);
    setActionPanel(null);
  };

  const submitContactForm = async (payload) => {
    const ok = editingContact
      ? await onUpdateContact(editingContact.id, payload)
      : await onCreateContact(payload);
    if (ok) {
      setShowContactForm(false);
      setEditingContact(null);
    }
  };

  const submitReviewAction = async (contact, action, payload) => {
    const ok = await onReviewContact(contact.id, action, payload);
    if (ok) setActionPanel(null);
  };

  const renderContactActions = (contact) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
      {(contact.availableActions || []).map((action) => {
        if (action === 'edit') {
          return (
            <button key={action} type="button" className="btn btn-secondary" style={{ fontSize: '0.74rem' }} onClick={() => openEdit(contact)}>
              Edit
            </button>
          );
        }
        if (action === CONTACT_ACTION.SUBMIT) {
          return (
            <button
              key={action}
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.74rem' }}
              disabled={busyAction === `submit-${contact.id}`}
              onClick={() => onSubmitContact(contact.id)}
            >
              Submit for verification
            </button>
          );
        }
        return (
          <button
            key={action}
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '0.74rem' }}
            onClick={() => setActionPanel({ contactId: contact.id, action })}
          >
            {CONTACT_ACTION_LABELS[action] || action}
          </button>
        );
      })}
    </div>
  );

  return (
    <section aria-labelledby="offline-card-staff-heading">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <h2 id="offline-card-staff-heading" style={{ margin: 0, fontSize: '1.2rem' }}>
            Verified contact administration
          </h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {scope?.label || 'Staff scope'} · Operators draft and submit; reviewers verify and
            publish; every override records a reason.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={onRefresh}>
            <RefreshCw size={14} aria-hidden="true" /> Reload
          </button>
          {isReviewer && (
            <button type="button" className="btn btn-secondary" onClick={onGenerateRecommendations} disabled={busyAction === 'generate-recommendations'}>
              <ListChecks size={14} aria-hidden="true" /> Generate recommendations
            </button>
          )}
        </div>
      </div>

      <OfflineCardLowStorageBanner storage={storage} />
      {error && <OfflineCardErrorState message={error.message} code={error.code} onRetry={onRefresh} />}

      <div role="tablist" aria-label="Contact administration sections" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.85rem' }}>
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`offline-card-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`offline-card-panel-${id}`}
            onClick={() => setTab(id)}
            className={tab === id ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ fontSize: '0.78rem' }}
          >
            <Icon size={14} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`offline-card-panel-${tab}`} aria-labelledby={`offline-card-tab-${tab}`}>
        {tab === 'contacts' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
              <button type="button" className="btn btn-primary" onClick={() => { setEditingContact(null); setShowContactForm(true); }}>
                <PlusCircle size={14} aria-hidden="true" /> New contact
              </button>
            </div>
            {showContactForm && (
              <OfflineEmergencyCardContactForm
                initialContact={editingContact}
                sources={sources}
                jurisdictions={jurisdictions}
                defaultJurisdictionId={scope?.jurisdictionIds?.[0] || 'LKO'}
                onSubmit={submitContactForm}
                onCancel={() => { setShowContactForm(false); setEditingContact(null); }}
                busy={busyAction === 'contact-form'}
                error={error?.code ? error.message : null}
              />
            )}
            {contacts.length === 0 ? (
              <OfflineCardEmptyState
                title="No contacts in your jurisdiction yet"
                message="Add a draft contact from an official source, then submit it for reviewer verification."
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <caption style={{ textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)', paddingBottom: '0.4rem' }}>
                    Contacts in your assigned jurisdiction, including drafts and returned records
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Service</th>
                      <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Status</th>
                      <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Verification</th>
                      <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Source</th>
                      <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact) => (
                      <tr key={contact.id}>
                        <th scope="row" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                          {contact.name}
                          <span style={{ display: 'block', fontWeight: 400, color: 'var(--text-secondary)' }}>
                            {OFFLINE_CARD_CATEGORY_LABELS[contact.category]} · {contact.jurisdictionName} · v{contact.version}
                          </span>
                        </th>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                          <OfflineCardStatusBadge label={contact.statusLabel} tone={STATUS_TONES[contact.status] || 'neutral'} />
                        </td>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                          <OfflineCardFreshnessBadge freshness={contact.freshness} />
                          <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            {contact.lastVerifiedAt ? new Date(contact.lastVerifiedAt).toLocaleDateString() : 'Never verified'}
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                          {contact.source?.title || 'Missing source'}
                        </td>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                          {renderContactActions(contact)}
                          {actionPanel?.contactId === contact.id && (
                            <ReviewActionForm
                              contact={contact}
                              action={actionPanel.action}
                              busy={Boolean(busyAction)}
                              onCancel={() => setActionPanel(null)}
                              onSubmit={(payload) => submitReviewAction(contact, actionPanel.action, payload)}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'review' && (
          pendingReview.length === 0 ? (
            <OfflineCardEmptyState title="Review queue is clear" message="No contact is waiting for manual verification. Submitted contacts appear here for a reviewer." />
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.6rem' }}>
              {pendingReview.map((contact) => (
                <li key={contact.id} style={{ padding: '0.8rem', border: '1px solid var(--border-main)', borderRadius: '0.6rem', background: 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div>
                      <strong>{contact.name}</strong>
                      <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {contact.organization} · {contact.phone} · v{contact.version}
                      </span>
                    </div>
                    <OfflineCardStatusBadge label="Awaiting verification" tone="warning" />
                  </div>
                  <p style={{ margin: '0.4rem 0', fontSize: '0.82rem' }}>{contact.description}</p>
                  <p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Source: {contact.source?.title || 'missing'} · {contact.source?.officialUrl || 'no URL'} ·
                    {' '}retrieved {contact.source?.retrievedAt ? new Date(contact.source.retrievedAt).toLocaleDateString() : 'unknown'}
                  </p>
                  {renderContactActions(contact)}
                  {actionPanel?.contactId === contact.id && (
                    <ReviewActionForm
                      contact={contact}
                      action={actionPanel.action}
                      busy={Boolean(busyAction)}
                      onCancel={() => setActionPanel(null)}
                      onSubmit={(payload) => submitReviewAction(contact, actionPanel.action, payload)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )
        )}

        {tab === 'sources' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
              <button type="button" className="btn btn-primary" onClick={() => setShowSourceForm(true)}>
                <PlusCircle size={14} aria-hidden="true" /> Add official source
              </button>
            </div>
            {showSourceForm && (
              <OfflineEmergencyCardSourceForm
                jurisdictions={jurisdictions}
                defaultJurisdictionId={scope?.jurisdictionIds?.[0] || 'LKO'}
                onSubmit={async (payload) => {
                  const ok = await onCreateSource(payload);
                  if (ok) setShowSourceForm(false);
                }}
                onCancel={() => setShowSourceForm(false)}
                busy={busyAction === 'source-form'}
                error={error?.code ? error.message : null}
              />
            )}
            {sources.length === 0 ? (
              <OfflineCardEmptyState title="No official sources yet" message="Add the government page or gazette that proves each emergency number before creating a contact." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <caption style={{ textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)', paddingBottom: '0.4rem' }}>
                    Official sources available to your jurisdiction
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Source</th>
                      <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Jurisdiction</th>
                      <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Checked</th>
                      <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Contacts</th>
                      <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((source) => (
                      <tr key={source.id}>
                        <th scope="row" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                          {source.title}
                          <span style={{ display: 'block', fontWeight: 400, color: 'var(--text-secondary)' }}>
                            {source.publisher} ·{' '}
                            <a href={source.officialUrl} target="_blank" rel="noreferrer noopener">official page</a>
                          </span>
                        </th>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>{source.jurisdictionName || source.jurisdictionId}</td>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                          {source.retrievedAt ? new Date(source.retrievedAt).toLocaleDateString() : 'Unknown'}
                        </td>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>{source.contactCount ?? 0}</td>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                          {source.status === 'active' ? (
                            sourceArchiveId === source.id ? (
                              <form
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  onArchiveSource(source.id, sourceArchiveReason).then((ok) => {
                                    if (ok) { setSourceArchiveId(null); setSourceArchiveReason(''); }
                                  });
                                }}
                              >
                                <label htmlFor={`archive-source-${source.id}`} style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700 }}>
                                  Archive reason (required)
                                </label>
                                <textarea
                                  id={`archive-source-${source.id}`}
                                  style={{ ...fieldStyle, resize: 'vertical' }}
                                  rows={2}
                                  value={sourceArchiveReason}
                                  onChange={(event) => setSourceArchiveReason(event.target.value)}
                                  required
                                />
                                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.3rem' }}>
                                  <button type="submit" className="btn btn-primary" style={{ fontSize: '0.74rem' }}>Confirm archive</button>
                                  <button type="button" className="btn btn-secondary" style={{ fontSize: '0.74rem' }} onClick={() => setSourceArchiveId(null)}>Cancel</button>
                                </div>
                              </form>
                            ) : (
                              <button type="button" className="btn btn-secondary" style={{ fontSize: '0.74rem' }} onClick={() => setSourceArchiveId(source.id)}>
                                Archive
                              </button>
                            )
                          ) : (
                            <OfflineCardStatusBadge label="Archived" tone="neutral" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'recommendations' && (
          recommendations.length === 0 ? (
            <OfflineCardEmptyState
              title="No review recommendations yet"
              message="Generate deterministic recommendations to find contacts that are overdue for verification, stale, or missing a critical category. No recommendation changes a contact without a human decision."
            />
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.6rem' }}>
              {recommendations.map((recommendation) => (
                <li key={recommendation.id} style={{ padding: '0.8rem', border: '1px solid var(--border-main)', borderRadius: '0.6rem', background: 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.4rem' }}>
                    <div>
                      <strong>{recommendation.ruleLabel}</strong>
                      <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {recommendation.jurisdictionName} · {recommendation.categoryLabel || 'All categories'} · ruleset {recommendation.rulesetVersion}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      <OfflineCardStatusBadge label={recommendation.priority} tone={PRIORITY_TONES[recommendation.priority] || 'neutral'} />
                      <OfflineCardStatusBadge label={recommendation.statusLabel || recommendation.status} tone="info" />
                    </div>
                  </div>
                  <p style={{ margin: '0.4rem 0', fontSize: '0.84rem' }}>{recommendation.reason}</p>
                  <p style={{ margin: '0 0 0.4rem', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    Deterministic rule · executed {recommendation.executedAt ? new Date(recommendation.executedAt).toLocaleString() : 'unknown'} ·
                    human decision required
                  </p>
                  {[RECOMMENDATION_STATUS.PENDING, RECOMMENDATION_STATUS.EDITED].includes(recommendation.status) && (
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-primary" style={{ fontSize: '0.74rem' }} onClick={() => onDecideRecommendation(recommendation.id, { action: 'accept', expectedVersion: recommendation.version })}>
                        Accept
                      </button>
                      <button type="button" className="btn btn-secondary" style={{ fontSize: '0.74rem' }} onClick={() => setRecommendationPanel({ id: recommendation.id, action: 'edit' })}>
                        Edit
                      </button>
                      <button type="button" className="btn btn-secondary" style={{ fontSize: '0.74rem' }} onClick={() => setRecommendationPanel({ id: recommendation.id, action: 'reject' })}>
                        Reject
                      </button>
                    </div>
                  )}
                  {recommendationPanel?.id === recommendation.id && (
                    <RecommendationDecisionForm
                      recommendation={recommendation}
                      action={recommendationPanel.action}
                      busy={Boolean(busyAction)}
                      onCancel={() => setRecommendationPanel(null)}
                      onSubmit={async (payload) => {
                        const ok = await onDecideRecommendation(recommendation.id, payload);
                        if (ok) setRecommendationPanel(null);
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          )
        )}

        {tab === 'audit' && (
          audit.length === 0 ? (
            <OfflineCardEmptyState title="No audit events yet" message="Publishing, returning, archiving and overriding a contact writes an append-only event with a reason." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <caption style={{ textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)', paddingBottom: '0.4rem' }}>
                  Append-only audit trail with the reason recorded for every override
                </caption>
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>When</th>
                    <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Action</th>
                    <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Actor</th>
                    <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Jurisdiction</th>
                    <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((event) => (
                    <tr key={event.id}>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
                        {event.timestamp ? new Date(event.timestamp).toLocaleString() : 'Unknown'}
                      </td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>{event.action}</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>{event.actorLabel} ({event.actorRole})</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>{event.jurisdictionId}</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>{event.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === 'admin' && isAdmin && (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ padding: '0.85rem', border: '1px solid var(--border-main)', borderRadius: '0.6rem' }}>
              <h3 style={{ margin: '0 0 0.3rem', fontSize: '0.95rem' }}>Retention</h3>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Remove expired sync events, inactive device preferences, old audit events and long-archived contacts. Published contacts are retained with their stale warnings.
              </p>
              <button type="button" className="btn btn-secondary" onClick={onRunRetention} disabled={busyAction === 'retention'}>
                Apply retention policy
              </button>
            </div>
            <div style={{ padding: '0.85rem', border: '1px solid var(--border-main)', borderRadius: '0.6rem' }}>
              <h3 style={{ margin: '0 0 0.3rem', fontSize: '0.95rem' }}>Rollback to verified seed</h3>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                The current bundle is copied to a local backup before the seed is restored.
              </p>
              <label htmlFor="rollback-reason" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700 }}>Rollback reason (required)</label>
              <input id="rollback-reason" style={fieldStyle} value={rollbackReason} onChange={(event) => setRollbackReason(event.target.value)} />
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                <button type="button" className="btn btn-secondary" disabled={busyAction === 'rollback'} onClick={() => onRollback(rollbackReason).then((ok) => { if (ok) setRollbackReason(''); })}>
                  <RotateCcw size={14} aria-hidden="true" /> Roll back
                </button>
                <button type="button" className="btn btn-secondary" onClick={onRestoreBackup} disabled={busyAction === 'restore'}>
                  Restore last backup
                </button>
              </div>
            </div>
            <div style={{ padding: '0.85rem', border: '1px solid rgba(220, 38, 38, 0.35)', borderRadius: '0.6rem' }}>
              <h3 style={{ margin: '0 0 0.3rem', fontSize: '0.95rem' }}>Reset to empty</h3>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Remove all local sources, contacts, preferences and recommendations. Use this only for a documented reset.
              </p>
              <button type="button" className="btn btn-secondary" style={{ color: '#b91c1c' }} onClick={() => (confirmReset ? onReset() : setConfirmReset(true))} disabled={busyAction === 'reset'}>
                <Trash2 size={14} aria-hidden="true" /> {confirmReset ? 'Confirm reset to empty' : 'Reset to empty'}
              </button>
            </div>
          </div>
        )}
      </div>

      <p style={{ marginTop: '1rem', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
        <AlertTriangle size={12} aria-hidden="true" /> This browser build stores records locally.
        Role and jurisdiction checks stop mistakes and casual misuse; shared production data
        requires server-side enforcement. See docs/offline-emergency-civic-card.md.
      </p>
    </section>
  );
}
