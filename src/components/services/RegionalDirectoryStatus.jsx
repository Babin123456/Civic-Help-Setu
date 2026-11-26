import { useEffect, useReducer } from 'react';
import { REGIONAL_REVIEW_KEY, buildRegionalDirectory, readRegionalReviews } from '../../services/regionalServiceDirectoryService';

export default function RegionalDirectoryStatus({ services }) {
  const [, refresh] = useReducer((value) => value + 1, 0);
  useEffect(() => {
    const onStorage = (event) => { if (!event.key || event.key === REGIONAL_REVIEW_KEY) refresh(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener(REGIONAL_REVIEW_KEY, refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(REGIONAL_REVIEW_KEY, refresh); window.clearInterval(timer); };
  }, []);
  const state = readRegionalReviews();
  const entries = buildRegionalDirectory(services, state.records).map((entry) => state.ok ? entry : { ...entry, status: 'unknown', availability: 'unknown' });
  return <details style={{ margin: '1rem 0', padding: '1rem', border: '1px solid var(--border-main)', borderRadius: '0.75rem' }}>
    <summary>Regional directory review: {entries.filter((entry) => entry.status === 'stale').length} overdue, {entries.filter((entry) => entry.conflict).length} jurisdiction conflicts</summary>
    <p>These are catalogue review dates and locally recorded availability, not live service guarantees. Confirm with the public authority. Private reviewer details are excluded.</p>
    {!state.ok && <p role="status">Local review metadata could not be read; catalogue dates remain informational.</p>}
    <ul>{entries.slice(0, 20).map((entry) => <li key={entry.id} style={{ marginBottom: '0.75rem' }}>
      <strong>{entry.name}</strong> — {entry.region}; public authority: {entry.department}.
      <div>Review: {entry.status}; availability: {entry.availability}; cadence: {entry.cadenceDays} days. {entry.verifiedAt && `Catalogue review date: ${entry.verifiedAt}.`}</div>
      {entry.conflict && <p>Jurisdiction records need maintainer review. Do not assume applicability.</p>}
      {entry.escalation && <p>{entry.escalation}</p>}
      {entry.sourceUrl && <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">Source evidence</a>}
      {entry.authorityUrl && <> · <a href={entry.authorityUrl} target="_blank" rel="noopener noreferrer">Public authority contact</a></>}
    </li>)}</ul>
    {entries.length > 20 && <p>Showing the first 20 matches. Refine the existing region/search filters to inspect others.</p>}
  </details>;
}
