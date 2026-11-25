import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, FileCheck2, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function TransitConcessionReviewQueue() {
  const { getSessionToken } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getSessionToken?.();
      if (!token) throw new Error('Administrator sign-in is required.');
      const response = await fetch('/api/transit-concessions?view=moderation', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load corrections.');
      setItems(result.items);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  }, [getSessionToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadQueue(), 0);
    return () => window.clearTimeout(timer);
  }, [loadQueue]);

  const review = async (id, decision) => {
    try {
      const token = await getSessionToken?.();
      if (!token) throw new Error('Administrator sign-in is required.');
      const response = await fetch('/api/transit-concessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, decision }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Review was not saved.');
      setItems((previous) => previous.filter((item) => item.id !== id));
      toast?.success?.(`Correction ${decision}. It remains unpublished until incorporated into a reviewed data release.`);
    } catch (failure) {
      setError(failure.message);
    }
  };

  return (
    <section className="card" aria-labelledby="transit-review-title" style={{ padding: '1.5rem', marginTop: '2rem' }}>
      <h3 id="transit-review-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <FileCheck2 size={20} aria-hidden="true" /> Transit concession corrections
      </h3>
      <p>Source-backed community submissions. Approval records the review decision but does not publish policy claims.</p>
      {loading && <p role="status">Loading corrections…</p>}
      {error && <p role="alert">{error} <button type="button" onClick={loadQueue}>Retry</button></p>}
      {!loading && !error && items.length === 0 && <p>No pending transit corrections.</p>}
      <div className="transit-review-list">
        {items.map((item) => (
          <article key={item.id} className="transit-review-item">
            <h4>{item.authority} — {item.jurisdiction.city}, {item.jurisdiction.state}</h4>
            <p>{item.proposedChange}</p>
            <p>Source date: {item.sourceDate}{item.effectiveDate ? ` · Effective: ${item.effectiveDate}` : ''}</p>
            <a href={item.officialSourceUrl} target="_blank" rel="noreferrer">Review official source</a>
            <div className="transit-review-actions">
              <button type="button" onClick={() => review(item.id, 'approved')}><CheckCircle2 size={15} aria-hidden="true" /> Approve</button>
              <button type="button" onClick={() => review(item.id, 'dismissed')}><XCircle size={15} aria-hidden="true" /> Dismiss</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
