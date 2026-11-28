import { useState, useEffect } from 'react';
import {
  listVersionedMappings,
  diagnosePmKisanStatus,
  toggleHelpDeskChecklistItem,
  PM_KISAN_MAPPING_VERSION,
} from '../services/pmKisanExceptionGuideService.js';

export default function PmKisanExceptionGuideWorkspace({ actorId = 'farmer-demo' }) {
  const [mappings] = useState(() => listVersionedMappings());
  const [statusCode, setStatusCode] = useState('ekyc_pending');
  const [customMessage, setCustomMessage] = useState('');
  const [session, setSession] = useState(null);
  const [checkedItems, setCheckedItems] = useState([]);
  const [showPrintable, setShowPrintable] = useState(false);
  const [error, setError] = useState('');
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine === false : false
  );

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      return () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      };
    }
    return undefined;
  }, []);

  const handleDiagnose = (e) => {
    e.preventDefault();
    setError('');
    const res = diagnosePmKisanStatus({
      actorId,
      statusCode,
      customPortalMessage: customMessage,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSession(res.session);
    setCheckedItems([]);
    setShowPrintable(false);
  };

  const handleToggle = (label, checked) => {
    if (!session) return;
    const res = toggleHelpDeskChecklistItem({
      sessionId: session.sessionId,
      actorId,
      itemLabel: label,
      checked,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCheckedItems(res.state.checked);
  };

  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: '1.5rem' }} aria-label="PM-KISAN Installment Exception Diagnosis Guide">
      <header style={{ marginBottom: '1.5rem' }}>
        <h1>PM-KISAN Installment Exception Diagnosis Guide</h1>
        <p>
          Select the status message shown on the official PM-KISAN portal to view the next safe official channel and
          printable help-desk checklist. Mapping Version: <code>{PM_KISAN_MAPPING_VERSION}</code>.
        </p>
        <p>
          <strong>Privacy Guarantee:</strong> Do NOT enter Aadhaar numbers, bank account numbers, OTPs, or passwords.
        </p>
      </header>

      {isOffline && (
        <div role="status" aria-live="polite" style={{ padding: '0.75rem', background: '#fef3c7', border: '1px solid #f59e0b', marginBottom: '1rem' }}>
          Offline mode: versioned status mappings and help-desk checklists work offline.
        </div>
      )}

      {error && (
        <div role="alert" style={{ padding: '0.75rem', background: '#fee2e2', border: '1px solid #ef4444', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <section aria-label="Portal Status Decision Tree" style={{ marginBottom: '1.5rem' }}>
        <h2>Step 1: Select Portal Status Message</h2>
        <form onSubmit={handleDiagnose} style={{ display: 'grid', gap: '0.75rem', maxWidth: 540 }}>
          <label>
            PM-KISAN Portal Status
            <select value={statusCode} onChange={(e) => setStatusCode(e.target.value)}>
              {mappings.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.portalMessage}
                </option>
              ))}
              <option value="unknown">Other / Unknown Portal Message</option>
            </select>
          </label>

          {statusCode === 'unknown' && (
            <label>
              Portal Message Text (Citizen-Entered Fact, no Aadhaar/bank info)
              <input
                type="text"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="e.g., Pending for state approval"
              />
            </label>
          )}

          <button type="submit">Diagnose Next Safe Step</button>
        </form>
      </section>

      {session && (
        <section aria-label="Diagnosis Result and Help-Desk Checklist" style={{ border: '1px solid #cbd5e1', padding: '1rem', borderRadius: 6 }}>
          <h2>{session.diagnosis.portalMessage}</h2>
          <p>{session.diagnosis.plainExplanation}</p>
          <p>
            Provenance: <strong>{session.diagnosis.provenance}</strong> | Rule Status:{' '}
            <strong>{session.diagnosis.verificationStatus}</strong> | Jurisdiction: {session.diagnosis.jurisdiction}
          </p>
          {session.diagnosis.sourceUrl && (
            <p>
              Official Source:{' '}
              <a href={session.diagnosis.sourceUrl} target="_blank" rel="noreferrer">
                {session.diagnosis.sourceUrl}
              </a>{' '}
              (Effective: {session.diagnosis.effectiveDate}, Verified: {session.diagnosis.lastVerifiedAt})
            </p>
          )}

          <h3>Official Correction Channels</h3>
          <ul>
            {session.diagnosis.officialChannels.map((ch) => (
              <li key={ch.label}>
                <a href={ch.url} target="_blank" rel="noreferrer">{ch.label}</a>
              </li>
            ))}
          </ul>

          <h3>Documents to Carry to Help-Desk</h3>
          <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
            {session.diagnosis.documentsToCarry.map((doc) => (
              <li key={doc} style={{ marginBottom: '0.4rem' }}>
                <label>
                  <input
                    type="checkbox"
                    checked={checkedItems.includes(doc)}
                    onChange={(e) => handleToggle(doc, e.target.checked)}
                  />{' '}
                  {doc}
                </label>
              </li>
            ))}
          </ul>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" onClick={() => setShowPrintable((v) => !v)}>
              {showPrintable ? 'Hide Printable Help-Desk Checklist' : 'Show Printable Help-Desk Checklist'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.print) window.print();
              }}
            >
              Print Checklist
            </button>
          </div>

          {showPrintable && (
            <pre aria-label="Printable Help-Desk Checklist" style={{ background: '#f8fafc', padding: '0.75rem', marginTop: '0.75rem', whiteSpace: 'pre-wrap' }}>
              {session.printableChecklistText}
            </pre>
          )}
        </section>
      )}
    </main>
  );
}
