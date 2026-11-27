import { useMemo } from 'react';
import { MapPin, Phone, Search, Smartphone } from 'lucide-react';
import {
  CONTACT_FRESHNESS,
  OFFLINE_CARD_CATEGORY_LABELS,
} from '../../services/offlineEmergencyCardConstants.js';
import {
  OfflineCardEmptyState,
  OfflineCardFreshnessBadge,
  OfflineCardStaleNotice,
  OfflineCardSummary,
  OfflineCardVerifiedLine,
} from './OfflineEmergencyCardStates.jsx';

const FRESHNESS_OPTIONS = [
  { id: 'all', label: 'All verification states' },
  { id: CONTACT_FRESHNESS.FRESH, label: 'Recently verified' },
  { id: CONTACT_FRESHNESS.REVIEW_DUE, label: 'Review due soon' },
  { id: CONTACT_FRESHNESS.STALE, label: 'Outdated' },
];

const normalize = (value) => String(value || '').toLowerCase();

export default function OfflineEmergencyCardPublicView({
  card,
  query,
  onQueryChange,
  category,
  onCategoryChange,
  freshness,
  onFreshnessChange,
  selectedRefs,
  onToggleRef,
  onToggleAll,
  showTable,
  onShowTableChange,
  onInstall,
  canInstall = true,
}) {
  const contacts = useMemo(() => card?.contacts || [], [card]);
  const selected = useMemo(() => new Set(selectedRefs || []), [selectedRefs]);

  const filtered = useMemo(() => {
    const cleanQuery = normalize(query).trim();
    return contacts.filter((contact) => {
      if (category !== 'all' && contact.category !== category) return false;
      if (freshness !== 'all' && contact.freshness?.state !== freshness) return false;
      if (!cleanQuery) return true;
      const haystack = [
        contact.name,
        contact.organization,
        contact.phone,
        contact.alternatePhone,
        contact.categoryLabel,
        contact.address,
        contact.hours,
        contact.jurisdictionName,
        ...(contact.languages || []),
      ]
        .map(normalize)
        .join(' ');
      return haystack.includes(cleanQuery);
    });
  }, [contacts, query, category, freshness]);

  const staleContacts = filtered.filter((contact) => contact.isStale);
  const allSelected = filtered.length > 0 && filtered.every((contact) => selected.has(contact.publicRef));
  const categories = Object.entries(OFFLINE_CARD_CATEGORY_LABELS);

  return (
    <section aria-labelledby="offline-card-public-heading">
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '0.75rem',
          marginBottom: '0.75rem',
        }}
      >
        <div>
          <h2 id="offline-card-public-heading" style={{ margin: 0, fontSize: '1.2rem' }}>
            Approved emergency card for {card?.jurisdiction?.name || 'your area'}
          </h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Only contacts with an official source and a manual verification date appear here.
            Outdated records stay visible with a warning.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onShowTableChange(!showTable)}
          aria-pressed={Boolean(showTable)}
        >
          {showTable ? 'Show card view' : 'Show table view'}
        </button>
      </div>

      <OfflineCardSummary summary={card?.summary} />

      {staleContacts.length > 0 && (
        <OfflineCardStaleNotice
          contactName={staleContacts.length === 1 ? staleContacts[0].name : null}
          lastVerifiedAt={staleContacts.length === 1 ? staleContacts[0].lastVerifiedAt : null}
          source={staleContacts.length === 1 ? staleContacts[0].source : null}
        />
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(180px, 1fr) minmax(160px, 220px) minmax(160px, 220px)',
          gap: '0.6rem',
          marginBottom: '0.85rem',
        }}
      >
        <div>
          <label htmlFor="offline-card-search" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Search contacts
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Search size={15} aria-hidden="true" style={{ color: 'var(--text-secondary)' }} />
            <input
              id="offline-card-search"
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Number, service, area or language"
              style={{
                width: '100%',
                padding: '0.45rem 0.6rem',
                borderRadius: 6,
                border: '1px solid var(--border-main)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            />
          </div>
        </div>
        <div>
          <label htmlFor="offline-card-category" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Category
          </label>
          <select
            id="offline-card-category"
            value={category}
            onChange={(event) => onCategoryChange(event.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.6rem',
              borderRadius: 6,
              border: '1px solid var(--border-main)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            <option value="all">All categories</option>
            {categories.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="offline-card-freshness" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Verification state
          </label>
          <select
            id="offline-card-freshness"
            value={freshness}
            onChange={(event) => onFreshnessChange(event.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.6rem',
              borderRadius: 6,
              border: '1px solid var(--border-main)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            {FRESHNESS_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.75rem',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={() => onToggleAll(filtered)} style={{ fontSize: '0.78rem' }}>
            {allSelected ? 'Clear selection' : 'Select all shown'}
          </button>
          <span aria-live="polite">
            {filtered.length} of {contacts.length} contacts shown · {selected.size} selected for the
            offline card
          </span>
        </div>
        {canInstall && onInstall && (
          <button type="button" className="btn btn-primary" onClick={onInstall} style={{ fontSize: '0.82rem' }}>
            <Smartphone size={14} aria-hidden="true" /> Install selected
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <OfflineCardEmptyState
          title="No verified contact matches this search"
          message="Try a different number, category or verification state. If a service is missing, a municipal operator must add it from an official source before it can be installed."
        />
      ) : showTable ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <caption style={{ textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)', paddingBottom: '0.4rem' }}>
              Approved emergency contacts with verification dates and official sources
            </caption>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Select</th>
                <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Service</th>
                <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Number</th>
                <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Verified</th>
                <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((contact) => (
                <tr key={contact.publicRef}>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                    <input
                      type="checkbox"
                      checked={selected.has(contact.publicRef)}
                      onChange={() => onToggleRef(contact.publicRef)}
                      aria-label={`Select ${contact.name} for the offline card`}
                    />
                  </td>
                  <th scope="row" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                    {contact.name}
                    <span style={{ display: 'block', fontWeight: 400, color: 'var(--text-secondary)' }}>
                      {contact.categoryLabel} · {contact.organization}
                    </span>
                  </th>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
                    <a href={`tel:${String(contact.phone).replace(/[^\d+]/g, '')}`}>{contact.phone}</a>
                  </td>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                    {contact.lastVerifiedAt ? new Date(contact.lastVerifiedAt).toLocaleDateString() : 'Not recorded'}
                    <span style={{ display: 'block' }}>
                      <OfflineCardFreshnessBadge freshness={contact.freshness} />
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                    {contact.source?.url ? (
                      <a href={contact.source.url} target="_blank" rel="noreferrer noopener">
                        {contact.source.publisher}
                      </a>
                    ) : (
                      'Not recorded'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.75rem' }}>
          {filtered.map((contact) => (
            <li key={contact.publicRef}>
              <article
                aria-labelledby={`contact-${contact.publicRef}`}
                style={{
                  padding: '1rem',
                  background: 'var(--bg-surface)',
                  border: contact.isStale ? '1px solid rgba(220, 38, 38, 0.35)' : '1px solid var(--border-main)',
                  borderRadius: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem' }}>
                    <input
                      type="checkbox"
                      checked={selected.has(contact.publicRef)}
                      onChange={() => onToggleRef(contact.publicRef)}
                      aria-label={`Select ${contact.name} for the offline card`}
                      style={{ marginTop: '0.35rem' }}
                    />
                    <div>
                      <h3 id={`contact-${contact.publicRef}`} style={{ margin: 0, fontSize: '1rem' }}>
                        {contact.name}
                      </h3>
                      <p style={{ margin: '0.15rem 0 0.35rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {contact.categoryLabel} · {contact.organization}
                      </p>
                    </div>
                  </div>
                  <OfflineCardFreshnessBadge freshness={contact.freshness} />
                </div>

                <p style={{ margin: '0.4rem 0 0.55rem', fontSize: '0.85rem' }}>{contact.description}</p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <a
                    href={`tel:${String(contact.phone).replace(/[^\d+]/g, '')}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '1.15rem', fontWeight: 800 }}
                  >
                    <Phone size={17} aria-hidden="true" /> {contact.phone}
                  </a>
                  {contact.alternatePhone ? (
                    <a href={`tel:${String(contact.alternatePhone).replace(/[^\d+]/g, '')}`} style={{ fontSize: '0.9rem' }}>
                      Alternate: {contact.alternatePhone}
                    </a>
                  ) : null}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <MapPin size={13} aria-hidden="true" /> {contact.jurisdictionName}
                  </span>
                </div>

                <OfflineCardVerifiedLine contact={contact} />

                <details style={{ marginTop: '0.55rem' }}>
                  <summary style={{ cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
                    Hours, languages and address
                  </summary>
                  <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.25rem 0.6rem', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>
                    <dt style={{ fontWeight: 700 }}>Hours</dt>
                    <dd style={{ margin: 0 }}>{contact.hours}</dd>
                    <dt style={{ fontWeight: 700 }}>Languages</dt>
                    <dd style={{ margin: 0 }}>{(contact.languages || []).join(', ') || 'Not recorded'}</dd>
                    <dt style={{ fontWeight: 700 }}>Address</dt>
                    <dd style={{ margin: 0 }}>{contact.address || 'Not recorded'}</dd>
                    <dt style={{ fontWeight: 700 }}>Verification</dt>
                    <dd style={{ margin: 0 }}>{contact.verificationMethod}</dd>
                  </dl>
                </details>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
