/**
 * src/components/caseCollaboration/ShareCreator.jsx
 *
 * Item-level share creation: choose case, items, recipient, scope, expiry,
 * max views and optional passcode. Emits share parameters to the parent.
 * Accessible, mobile-first, no PII.
 */

import { useState, useCallback } from 'react';
import { ShieldCheck, FileText, User, Lock, Download, List } from 'lucide-react';

export function ShareCreator({
  cases,
  caseItems,
  recipients,
  scopes,
  expiryOptions,
  onCreate,
  defaultCaseId,
}) {
  const [caseId, setCaseId] = useState(defaultCaseId || (cases[0]?.id || null));
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [recipientId, setRecipientId] = useState(recipients[0]?.id || null);
  const [recipientEmail, setRecipientEmail] = useState(recipients[0]?.email || '');
  const [scope, setScope] = useState(scopes[0] || 'view-download');
  const [expiryOption, setExpiryOption] = useState('7d');
  const [maxViews, setMaxViews] = useState(null);
  const [accessPin, setAccessPin] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const caseObj = cases.find((c) => c.id === caseId) || null;
  const eligibleItems = caseItems.filter((i) => i.caseId === caseId);
  const recipient = recipients.find((r) => r.id === recipientId) || null;

  const handleCaseChange = useCallback((id) => {
    setCaseId(id);
    const items = caseItems.filter((i) => i.caseId === id);
    setSelectedItemIds(items.map((i) => i.id));
    const c = cases.find((x) => x.id === id) || null;
    setTitle(c ? `${c.title} — Case Share` : 'Case Share');
  }, [caseItems, cases]);

  const toggleItem = useCallback((id) => {
    setSelectedItemIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const notify = useCallback(() => {
    onCreate({
      title,
      description,
      caseId,
      itemIds: selectedItemIds,
      recipientEmail: recipientEmail || (recipient?.email || ''),
      recipientId,
      scope,
      expiryOption,
      maxViews: maxViews === '' ? null : maxViews ? Number(maxViews) : null,
      accessPin: accessPin || undefined,
    });
  }, [title, description, caseId, selectedItemIds, recipientEmail, recipientId, scope, expiryOption, maxViews, accessPin]);

  return (
    <section className="cc-creator" aria-label="Create case share">
      <div className="creator-card">
        <h2 className="creator-title">
          <ShieldCheck aria-hidden="true" /> Create case share
        </h2>

        <div className="creator-field">
          <List aria-hidden="true" />
          <label htmlDef="cc-case">Case</label>
          <select id="cc-case" value={caseId} onChange={(e) => { setCaseId(e.target.value); handleCaseChange(e.target.value); }} aria-describedby="cc-case-desc">
            {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          {caseObj && <p id="cc-case-desc" className="creator-hint">{cObjHint(caseObj)}</p>}
        </div>

        <div className="creator-field">
          <label htmlFor="cc-title">Share title</label>
          <input id="cc-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="e.g. Income Certificate — Helper Review" />
        </div>

        <div className="creator-field">
          <label htmlFor="cc-desc">Description (optional)</label>
          <textarea id="cc-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows="2" maxLength={1000} placeholder="What is this share for?" />
        </div>

        <div className="creator-grid">
          <div className="creator-field">
            <FileText aria-hidden="true" />
            <label htmlFor="cc-items">Case items to share</label>
            <div className="item-chips" role="group" aria-label="Case items">
              {eligibleItems.map((item) => {
                const active = selectedItemIds.includes(item.id);
                return (
                  <button key={item.id} type="button" className={`item-chip ${active ? 'active' : ''}`} onClick={() => toggleItem(item.id)} aria-pressed={active} title={item.description}>
                    <span className="item-chip-label">{item.title}</span>
                    <span className="item-chip-mime">{item.category}</span>
                    {active && <span className="item-chip-on" aria-hidden="true">✓</span>}
                  </button>
                );
              })}
            </div>
            <p className="creator-hint">Select the specific documents to share. No other account data is exposed.</p>
          </div>

          <div className="creator-field">
            <User aria-hidden="true" />
            <label htmlFor="cc-recipient">Trusted helper (recipient)</label>
            <select id="cc-recipient" value={recipientId} onChange={(e) => { setRecipientId(e.target.value); const r = recipients.find((x) => x.id === e.target.value) || null; setRecipientEmail(r?.email || ''); }} aria-describedby="cc-recipient-desc">
              {recipients.map((r) => <option key={r.id} value={r.id}>{r.name} — {r.role}</option>)}
            </select>
            {recipient && <p id="cc-recipient-desc" className="creator-hint">{recipient.email} • {recipient.role}</p>}
          </div>
        </div>

        <div className="creator-field selector-inline">
          <label htmlFor="cc-scope">Share scope</label>
          <select id="cc-scope" value={scope} onChange={(e) => setScope(e.target.value)}>
            {scopes.map((s) => <option key={s} value={s}>{s === 'view-download' ? 'View &amp; Download' : 'View Only'}</option>)}
          </select>
          <span className="creator-hint">View-only blocks file downloads.</span>
        </div>

        <div className="creator-field selector-inline">
          <label htmlFor="cc-expiry">Expires after</label>
          <select id="cc-expiry" value={expiryOption} onChange={(e) => setExpiryOption(e.target.value)}>
            {Object.values(expiryOptions).map((o) => <option key={o} value={o}>{o === 'never' ? 'Never' : o.toUpperCase()}</option>)}
          </select>
          <span className="creator-hint">Links expire and are refused after expiry.</span>
        </div>

        <div className="creator-field selector-inline">
          <label htmlFor="cc-maxviews">Max views (optional)</label>
          <input id="cc-maxviews" type="number" min="1" value={maxViews === null ? '' : maxViews} onChange={(e) => setMaxViews(e.target.value)} placeholder="Unlimited" />
          <span className="creator-hint">Leave blank for unlimited views.</span>
        </div>

        <div className="creator-field selector-inline">
          <label htmlFor="cc-pin">Viewer passcode (optional)</label>
          <input id="cc-pin" type="password" value={accessPin} onChange={(e) => setAccessPin(e.target.value)} minLength={4} placeholder="≥ 4 chars" />
          <span className="creator-hint">Recipient must enter this to view.</span>
        </div>

        <div className="creator-actions">
          <button className="btn btn-primary" type="button" onClick={notify} disabled={!caseId || selectedItemIds.length === 0 || !title} aria-label="Create share link">
            <Download aria-hidden="true" /> Create share link
          </button>
        </div>

        <div className="creator-risk">
          <Lock aria-hidden="true" />
          <strong>Granular &amp; revocable.</strong> You can revoke this link at any
          time. Revoked links are refused even if previously cached. Shares are
          illustrative and never confer official status.
        </div>
      </div>
    </section>
  );
}

function cObjHint(c) {
  return `${c.stage} • ${c.serviceId}`;
}
