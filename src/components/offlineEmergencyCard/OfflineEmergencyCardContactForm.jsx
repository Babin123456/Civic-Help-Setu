import { useMemo, useState } from 'react';
import { Save, X } from 'lucide-react';
import {
  OFFLINE_CARD_CATEGORY_LABELS,
  OFFLINE_CARD_LIMITS,
  SOURCE_STATUS,
} from '../../services/offlineEmergencyCardConstants.js';

const EMPTY = {
  name: '',
  organization: '',
  category: 'emergency',
  jurisdictionId: 'LKO',
  sourceId: '',
  phone: '',
  alternatePhone: '',
  email: '',
  website: '',
  address: '',
  hours: '24 hours, 7 days',
  languages: 'Hindi, English',
  description: '',
  reviewIntervalDays: 180,
  changeReason: '',
};

const toDraft = (contact, defaultJurisdictionId) => {
  if (!contact) return { ...EMPTY, jurisdictionId: defaultJurisdictionId || EMPTY.jurisdictionId };
  return {
    name: contact.name || '',
    organization: contact.organization || '',
    category: contact.category || EMPTY.category,
    jurisdictionId: contact.jurisdictionId || defaultJurisdictionId || EMPTY.jurisdictionId,
    sourceId: contact.sourceId || contact.source?.id || '',
    phone: contact.phone || '',
    alternatePhone: contact.alternatePhone || '',
    email: contact.email || '',
    website: contact.website || '',
    address: contact.address || '',
    hours: contact.hours || EMPTY.hours,
    languages: Array.isArray(contact.languages) ? contact.languages.join(', ') : EMPTY.languages,
    description: contact.description || '',
    reviewIntervalDays: contact.reviewIntervalDays || 180,
    changeReason: '',
  };
};

const fieldStyle = {
  width: '100%',
  padding: '0.45rem 0.6rem',
  borderRadius: 6,
  border: '1px solid var(--border-main)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  fontSize: '0.85rem',
};

const labelStyle = { display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.2rem' };

export default function OfflineEmergencyCardContactForm({
  initialContact = null,
  sources = [],
  jurisdictions = [],
  defaultJurisdictionId,
  onSubmit,
  onCancel,
  busy = false,
  error = null,
}) {
  const [draft, setDraft] = useState(() => toDraft(initialContact, defaultJurisdictionId));
  const [localError, setLocalError] = useState(null);
  const editing = Boolean(initialContact);
  const availableSources = useMemo(
    () => sources.filter((source) => source.jurisdictionId === draft.jurisdictionId && source.status === SOURCE_STATUS.ACTIVE),
    [sources, draft.jurisdictionId]
  );

  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const submit = (event) => {
    event.preventDefault();
    setLocalError(null);
    if (!draft.sourceId) {
      setLocalError('Choose an active official source for this jurisdiction before saving.');
      return;
    }
    const payload = {
      ...draft,
      languages: String(draft.languages || '')
        .split(',')
        .map((language) => language.trim())
        .filter(Boolean),
      reviewIntervalDays: Number(draft.reviewIntervalDays),
      contactScope: 'public_office',
      reason: draft.changeReason,
      ...(editing
        ? {
            expectedVersion: initialContact.version,
            changeReason: draft.changeReason,
          }
        : {}),
    };
    onSubmit(payload);
  };

  return (
    <form
      onSubmit={submit}
      style={{
        padding: '1rem',
        border: '1px solid var(--border-main)',
        borderRadius: '0.75rem',
        background: 'var(--bg-secondary)',
        marginBottom: '1rem',
      }}
    >
      <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>
        {editing ? `Edit ${initialContact.name}` : 'New emergency contact'}
      </h3>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        Enter a public office number and link the official source where a reviewer can check it.
        Do not enter personal phone numbers, home addresses, Aadhaar or medical details.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem' }}>
        <div>
          <label htmlFor="contact-name" style={labelStyle}>Service name</label>
          <input id="contact-name" style={fieldStyle} value={draft.name} maxLength={OFFLINE_CARD_LIMITS.MAX_NAME_LENGTH} onChange={(event) => update('name', event.target.value)} required />
        </div>
        <div>
          <label htmlFor="contact-organization" style={labelStyle}>Public office or organisation</label>
          <input id="contact-organization" style={fieldStyle} value={draft.organization} maxLength={OFFLINE_CARD_LIMITS.MAX_ORGANIZATION_LENGTH} onChange={(event) => update('organization', event.target.value)} required />
        </div>
        <div>
          <label htmlFor="contact-category" style={labelStyle}>Category</label>
          <select id="contact-category" style={fieldStyle} value={draft.category} onChange={(event) => update('category', event.target.value)}>
            {Object.entries(OFFLINE_CARD_CATEGORY_LABELS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="contact-jurisdiction" style={labelStyle}>Jurisdiction</label>
          <select id="contact-jurisdiction" style={fieldStyle} value={draft.jurisdictionId} onChange={(event) => { update('jurisdictionId', event.target.value); update('sourceId', ''); }} disabled={editing}>
            {jurisdictions.map((jurisdiction) => (
              <option key={jurisdiction.id} value={jurisdiction.id}>{jurisdiction.name} — {jurisdiction.state}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="contact-source" style={labelStyle}>Official source</label>
          <select id="contact-source" style={fieldStyle} value={draft.sourceId} onChange={(event) => update('sourceId', event.target.value)} required>
            <option value="">Choose an active source</option>
            {availableSources.map((source) => (
              <option key={source.id} value={source.id}>{source.title} — {source.publisher}</option>
            ))}
          </select>
          {availableSources.length === 0 && (
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: '#b45309' }}>
              No active source exists for this jurisdiction. Add an official source first.
            </p>
          )}
        </div>
        <div>
          <label htmlFor="contact-phone" style={labelStyle}>Public phone number</label>
          <input id="contact-phone" style={fieldStyle} value={draft.phone} onChange={(event) => update('phone', event.target.value)} inputMode="tel" required />
        </div>
        <div>
          <label htmlFor="contact-alt-phone" style={labelStyle}>Alternate public number (optional)</label>
          <input id="contact-alt-phone" style={fieldStyle} value={draft.alternatePhone} onChange={(event) => update('alternatePhone', event.target.value)} inputMode="tel" />
        </div>
        <div>
          <label htmlFor="contact-email" style={labelStyle}>Official email (optional)</label>
          <input id="contact-email" style={fieldStyle} type="email" value={draft.email} onChange={(event) => update('email', event.target.value)} />
        </div>
        <div>
          <label htmlFor="contact-website" style={labelStyle}>Official website (optional)</label>
          <input id="contact-website" style={fieldStyle} value={draft.website} onChange={(event) => update('website', event.target.value)} placeholder="https://" />
        </div>
        <div>
          <label htmlFor="contact-hours" style={labelStyle}>Availability</label>
          <input id="contact-hours" style={fieldStyle} value={draft.hours} onChange={(event) => update('hours', event.target.value)} required />
        </div>
        <div>
          <label htmlFor="contact-languages" style={labelStyle}>Languages (comma separated)</label>
          <input id="contact-languages" style={fieldStyle} value={draft.languages} onChange={(event) => update('languages', event.target.value)} required />
        </div>
        <div>
          <label htmlFor="contact-review-interval" style={labelStyle}>Review interval (days)</label>
          <input id="contact-review-interval" style={fieldStyle} type="number" min="30" max="365" value={draft.reviewIntervalDays} onChange={(event) => update('reviewIntervalDays', event.target.value)} required />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="contact-address" style={labelStyle}>Public office address (optional)</label>
          <input id="contact-address" style={fieldStyle} value={draft.address} maxLength={OFFLINE_CARD_LIMITS.MAX_ADDRESS_LENGTH} onChange={(event) => update('address', event.target.value)} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="contact-description" style={labelStyle}>What the service handles</label>
          <textarea id="contact-description" style={{ ...fieldStyle, resize: 'vertical' }} rows={3} value={draft.description} maxLength={OFFLINE_CARD_LIMITS.MAX_DESCRIPTION_LENGTH} onChange={(event) => update('description', event.target.value)} />
        </div>
        {editing && (
          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="contact-change-reason" style={labelStyle}>Why is this contact being changed?</label>
            <input id="contact-change-reason" style={fieldStyle} value={draft.changeReason} maxLength={OFFLINE_CARD_LIMITS.MAX_REASON_LENGTH} onChange={(event) => update('changeReason', event.target.value)} placeholder="Recorded in the audit trail" />
          </div>
        )}
      </div>

      {(localError || error) && (
        <p role="alert" style={{ margin: '0.65rem 0 0', fontSize: '0.82rem', color: '#b91c1c' }}>
          {localError || error}
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          <Save size={14} aria-hidden="true" /> {editing ? 'Save revision' : 'Save draft contact'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          <X size={14} aria-hidden="true" /> Cancel
        </button>
      </div>
    </form>
  );
}
