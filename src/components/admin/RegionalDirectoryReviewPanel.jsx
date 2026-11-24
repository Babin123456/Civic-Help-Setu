import { useState } from 'react';
import { readRegionalReviews, saveRegionalReview } from '../../services/regionalServiceDirectoryService';

export default function RegionalDirectoryReviewPanel({ service, auditLogs = [] }) {
  const [saved, setSaved] = useState(() => readRegionalReviews().records[service.id]);
  const [form, setForm] = useState(() => ({ cadenceDays: saved?.cadenceDays || 180, availability: saved?.availability || 'unknown', verifiedAt: saved?.verifiedAt || '', sourceUrl: saved?.sourceUrl || '', authorityUrl: saved?.authorityUrl || '' }));
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setMessage('');
    try {
      const result = await saveRegionalReview(service.id, form, { expectedRevision: saved?.revision || 0 });
      if (result.ok) { setSaved(result.record); setMessage('Saved on this browser/device only.'); }
      else setMessage(result.error);
    } catch {
      setMessage('This session cannot change local reviews. Sign in as an administrator and retry.');
    } finally {
      setSaving(false);
    }
  };
  const exportHistory = () => {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, serviceId: service.id, review: saved }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'local-regional-review.json'; link.click(); URL.revokeObjectURL(url);
  };
  const ownershipHistory = auditLogs.filter((log) => log.target === service.id && log.action === 'OWNERSHIP_CHANGED');
  return <section aria-label="Device-local regional review" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-main)', paddingTop: '1rem' }}>
    <h3>Regional verification and availability</h3>
    <p role="note"><strong>Device-local only.</strong> Ownership and verification history stays in this browser. It is not synchronized across staff devices and is not an authoritative or organization-wide audit trail.</p>
    <p>Availability, dates and the two public links below appear in the public directory. Reviewer names and private notes do not.</p>
    <form onSubmit={submit}>
      <fieldset disabled={saving} style={{ display: 'grid', gap: '0.75rem', border: 0, padding: 0 }}>
        <label>Review cadence (days)<input className="input-field" type="number" min="1" max="365" step="1" value={form.cadenceDays} onChange={change('cadenceDays')} required /></label>
        <label>Recorded availability<select className="input-field" value={form.availability} onChange={change('availability')}><option value="unknown">Unknown</option><option value="available">Available at review</option><option value="unavailable">Unavailable at review</option></select></label>
        <label>Catalogue review date<input className="input-field" type="date" value={form.verifiedAt} onChange={change('verifiedAt')} /></label>
        <label>Public source evidence URL<input className="input-field" type="url" value={form.sourceUrl} onChange={change('sourceUrl')} maxLength={1000} /></label>
        <label>Public authority contact URL<input className="input-field" type="url" value={form.authorityUrl} onChange={change('authorityUrl')} maxLength={1000} /></label>
        <button type="submit" className="btn btn-primary">{saving ? 'Saving…' : 'Save local directory review'}</button>
      </fieldset>
      {message && <p role="status">{message}</p>}
    </form>
    {saved && <><button type="button" className="btn btn-secondary" onClick={exportHistory}>Export local verification history</button><p>Revision {saved.revision}; {saved.history.length} earlier local verification revisions retained.</p></>}
    <details><summary>Local ownership transfer history ({ownershipHistory.length})</summary><p>The existing admin audit log retains the latest 150 events across this device. Transfers before this feature can be shown only if their local events remain.</p><ol>{ownershipHistory.map((log, index) => <li key={`${log.id}:${index}`}>{log.timestamp}: {log.details}</li>)}</ol></details>
  </section>;
}
