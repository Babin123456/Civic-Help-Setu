import { useState } from 'react';
import { Download, RefreshCw, Save, Smartphone, Trash2, WifiOff } from 'lucide-react';
import {
  OFFLINE_CARD_LIMITS,
  OFFLINE_CARD_METHODOLOGY_NOTE,
} from '../../services/offlineEmergencyCardConstants.js';
import {
  OfflineCardEmptyState,
  OfflineCardFreshnessBadge,
  OfflineCardLowStorageBanner,
  OfflineCardOfflineBanner,
  OfflineCardStaleNotice,
  OfflineCardStatusBadge,
  OfflineCardSummary,
  OfflineCardVerifiedLine,
} from './OfflineEmergencyCardStates.jsx';

export default function OfflineEmergencyCardInstalledView({
  installed,
  isOnline,
  preferenceDraft,
  onPreferenceChange,
  onSavePreferences,
  onRefresh,
  onExport,
  onDelete,
  onGoToPublic,
  busyAction,
  storage,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!installed?.installed || !installed.card) {
    return (
      <section aria-labelledby="offline-card-installed-heading">
        <h2 id="offline-card-installed-heading" style={{ marginTop: 0, fontSize: '1.2rem' }}>
          My offline card
        </h2>
        <OfflineCardEmptyState
          title="No card is installed on this device"
          message="Choose a jurisdiction on the public card, select the contacts you need, and install them. The card is saved locally and opens without a connection."
          actionLabel="Go to the public card"
          onAction={onGoToPublic}
        />
      </section>
    );
  }

  const card = installed.card;
  const stale = (card.contacts || []).filter((contact) => contact.isStale);

  return (
    <section
      aria-labelledby="offline-card-installed-heading"
      style={preferenceDraft.largeText ? { fontSize: '1.12rem' } : undefined}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <h2 id="offline-card-installed-heading" style={{ margin: 0, fontSize: '1.2rem' }}>
            My offline card — {card.jurisdictionName}
          </h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Saved on this device. {card.contactCount} contacts from {card.sourceCount} official
            sources. Card version {card.cardVersion || 'not recorded'}.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onRefresh} disabled={busyAction === 'refresh'}>
            <RefreshCw size={14} aria-hidden="true" /> Refresh card
          </button>
          <button type="button" className="btn btn-secondary" onClick={onExport}>
            <Download size={14} aria-hidden="true" /> Export a copy
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
            style={{ color: '#b91c1c', borderColor: 'rgba(220, 38, 38, 0.4)' }}
          >
            <Trash2 size={14} aria-hidden="true" /> {confirmDelete ? 'Confirm delete from this device' : 'Delete from this device'}
          </button>
        </div>
      </div>

      {!isOnline && (
        <OfflineCardOfflineBanner lastRefreshedAt={card.lastRefreshedAt} onRefresh={onRefresh} />
      )}
      <OfflineCardLowStorageBanner storage={storage || installed.storage} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
        <OfflineCardStatusBadge
          label={card.freshness?.label || 'Card age unknown'}
          tone={
            card.freshness?.state === 'expired'
              ? 'danger'
              : card.freshness?.state === 'refresh_due'
                ? 'warning'
                : 'success'
          }
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Installed {card.installedAt ? new Date(card.installedAt).toLocaleString() : 'unknown'} ·
          Last refreshed {card.lastRefreshedAt ? new Date(card.lastRefreshedAt).toLocaleString() : 'never'}
        </span>
        {!isOnline && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#b45309' }}>
            <WifiOff size={13} aria-hidden="true" /> Working offline
          </span>
        )}
      </div>

      {stale.length > 0 && (
        <OfflineCardStaleNotice
          contactName={stale.length === 1 ? stale[0].name : null}
          lastVerifiedAt={stale.length === 1 ? stale[0].lastVerifiedAt : null}
          source={stale.length === 1 ? stale[0].source : null}
          onRefresh={onRefresh}
        />
      )}

      <OfflineCardSummary summary={card.summary} label="Installed card coverage" />

      <div
        style={{
          padding: '0.9rem 1rem',
          border: '1px solid var(--border-main)',
          borderRadius: '0.75rem',
          background: 'var(--bg-surface)',
          marginBottom: '1rem',
        }}
      >
        <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem' }}>Card preferences and personal note</h3>
        <p style={{ margin: '0 0 0.65rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          The note stays on this device. Do not store Aadhaar, medical records, passwords, OTPs or
          another person&apos;s phone number. Use it for non-sensitive instructions such as
          &quot;nearest hospital is on the main road&quot;.
        </p>
        <label htmlFor="offline-card-note" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.25rem' }}>
          Personal note (optional)
        </label>
        <textarea
          id="offline-card-note"
          value={preferenceDraft.note}
          maxLength={OFFLINE_CARD_LIMITS.MAX_NOTE_LENGTH}
          onChange={(event) => onPreferenceChange('note', event.target.value)}
          rows={3}
          style={{
            width: '100%',
            padding: '0.5rem 0.6rem',
            borderRadius: 6,
            border: '1px solid var(--border-main)',
            background: 'var(--bg-main)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', margin: '0.6rem 0' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}>
            <input
              type="checkbox"
              checked={Boolean(preferenceDraft.largeText)}
              onChange={(event) => onPreferenceChange('largeText', event.target.checked)}
            />
            Use larger text
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}>
            <input
              type="checkbox"
              checked={Boolean(preferenceDraft.showTable)}
              onChange={(event) => onPreferenceChange('showTable', event.target.checked)}
            />
            Prefer the table view
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}>
            <input
              type="checkbox"
              checked={preferenceDraft.includeNational !== false}
              onChange={(event) => onPreferenceChange('includeNational', event.target.checked)}
            />
            Include national helplines
          </label>
        </div>
        <button type="button" className="btn btn-primary" onClick={onSavePreferences} disabled={busyAction === 'preferences'}>
          <Save size={14} aria-hidden="true" /> Save preferences
        </button>
      </div>

      <h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Contacts on this card</h3>
      {preferenceDraft.showTable ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <caption style={{ textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)', paddingBottom: '0.4rem' }}>
              Contacts saved on this device
            </caption>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Service</th>
                <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Number</th>
                <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Verification</th>
                <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Official source</th>
              </tr>
            </thead>
            <tbody>
              {card.contacts.map((contact) => (
                <tr key={contact.publicRef}>
                  <th scope="row" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                    {contact.name}
                    <span style={{ display: 'block', fontWeight: 400, color: 'var(--text-secondary)' }}>
                      {contact.categoryLabel} · {contact.organization}
                    </span>
                  </th>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)', fontWeight: 800 }}>
                    <a href={`tel:${String(contact.phone).replace(/[^\d+]/g, '')}`}>{contact.phone}</a>
                  </td>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                    <OfflineCardFreshnessBadge freshness={contact.freshness} />
                    <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      {contact.lastVerifiedAt ? new Date(contact.lastVerifiedAt).toLocaleDateString() : 'Never verified'}
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                    {contact.source?.url ? (
                      <a href={contact.source.url} target="_blank" rel="noreferrer noopener">
                        {contact.source.title || contact.source.publisher || 'Official source'}
                      </a>
                    ) : (
                      'Source unavailable'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.6rem' }}>
          {card.contacts.map((contact) => (
            <li
              key={contact.publicRef}
              style={{
                padding: '0.75rem 0.85rem',
                border: contact.isStale ? '1px solid rgba(220, 38, 38, 0.35)' : '1px solid var(--border-main)',
                borderRadius: '0.6rem',
                background: 'var(--bg-surface)',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div>
                  <strong>{contact.name}</strong>
                  <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {contact.categoryLabel} · {contact.organization}
                  </span>
                </div>
                <OfflineCardFreshnessBadge freshness={contact.freshness} />
              </div>
              <div style={{ margin: '0.4rem 0', fontSize: '1.05rem', fontWeight: 800 }}>
                <a href={`tel:${String(contact.phone).replace(/[^\d+]/g, '')}`}>{contact.phone}</a>
                {contact.alternatePhone ? (
                  <span style={{ fontSize: '0.82rem', fontWeight: 400, marginLeft: '0.6rem' }}>
                    Alternate: {contact.alternatePhone}
                  </span>
                ) : null}
              </div>
              <OfflineCardVerifiedLine contact={contact} />
            </li>
          ))}
        </ul>
      )}

      <p style={{ marginTop: '1rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        {OFFLINE_CARD_METHODOLOGY_NOTE}
      </p>
      <p style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        <Smartphone size={12} aria-hidden="true" /> This card is stored in this browser on this
        device. Deleting it removes the saved contacts, note and snapshot immediately.
      </p>
    </section>
  );
}
