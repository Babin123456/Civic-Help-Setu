import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { CONTACT_SOURCE_TYPE_LABELS } from '../../services/offlineEmergencyCardConstants.js';

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

export default function OfflineEmergencyCardSourceForm({
  jurisdictions = [],
  defaultJurisdictionId = 'LKO',
  onSubmit,
  onCancel,
  busy = false,
  error = null,
}) {
  const [draft, setDraft] = useState({
    title: '',
    publisher: '',
    officialUrl: '',
    jurisdictionId: defaultJurisdictionId,
    sourceType: 'official_portal',
    retrievedAt: new Date().toISOString().slice(0, 10),
    reason: '',
  });

  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const submit = (event) => {
    event.preventDefault();
    onSubmit(draft);
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
      <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Add an official source</h3>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        Link the government page, gazette or district website where the number can be checked.
        Do not upload documents, identity papers or screenshots.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem' }}>
        <div>
          <label htmlFor="source-title" style={labelStyle}>Source title</label>
          <input id="source-title" style={fieldStyle} value={draft.title} onChange={(event) => update('title', event.target.value)} required />
        </div>
        <div>
          <label htmlFor="source-publisher" style={labelStyle}>Government publisher</label>
          <input id="source-publisher" style={fieldStyle} value={draft.publisher} onChange={(event) => update('publisher', event.target.value)} required />
        </div>
        <div>
          <label htmlFor="source-url" style={labelStyle}>Official URL</label>
          <input id="source-url" style={fieldStyle} value={draft.officialUrl} onChange={(event) => update('officialUrl', event.target.value)} placeholder="https://" required />
        </div>
        <div>
          <label htmlFor="source-type" style={labelStyle}>Source type</label>
          <select id="source-type" style={fieldStyle} value={draft.sourceType} onChange={(event) => update('sourceType', event.target.value)}>
            {Object.entries(CONTACT_SOURCE_TYPE_LABELS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="source-jurisdiction" style={labelStyle}>Jurisdiction</label>
          <select id="source-jurisdiction" style={fieldStyle} value={draft.jurisdictionId} onChange={(event) => update('jurisdictionId', event.target.value)}>
            {jurisdictions.map((jurisdiction) => (
              <option key={jurisdiction.id} value={jurisdiction.id}>{jurisdiction.name} — {jurisdiction.state}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="source-retrieved" style={labelStyle}>Date checked</label>
          <input id="source-retrieved" style={fieldStyle} type="date" value={draft.retrievedAt} onChange={(event) => update('retrievedAt', event.target.value)} required />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="source-reason" style={labelStyle}>Why is this source being added? (optional)</label>
          <input id="source-reason" style={fieldStyle} value={draft.reason} onChange={(event) => update('reason', event.target.value)} />
        </div>
      </div>
      {error && (
        <p role="alert" style={{ margin: '0.65rem 0 0', fontSize: '0.82rem', color: '#b91c1c' }}>{error}</p>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          <Save size={14} aria-hidden="true" /> Save source
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          <X size={14} aria-hidden="true" /> Cancel
        </button>
      </div>
    </form>
  );
}
