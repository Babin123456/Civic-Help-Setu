import { useState, useEffect } from 'react';
import {
  listSchemeRenewalRules,
  saveSchemeToCalendar,
  listSavedSchemeCalendar,
  exportSchemeCalendarIcs,
} from '../services/schemeRenewalCalendarService.js';

export default function SchemeRenewalCalendarWorkspace({ actorId = 'citizen-demo' }) {
  const [rules] = useState(() => listSchemeRenewalRules());
  const [savedSchemes, setSavedSchemes] = useState(() => listSavedSchemeCalendar({ actorId }).entries || []);
  const [selectedSchemeId, setSelectedSchemeId] = useState('post_matric_scholarship');
  const [customSchemeName, setCustomSchemeName] = useState('');
  const [lastCertifiedDate, setLastCertifiedDate] = useState('2026-01-15');
  const [leadDays, setLeadDays] = useState(15);
  const [optInReminder, setOptInReminder] = useState(true);
  const [icsPreview, setIcsPreview] = useState('');
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

  const handleSaveScheme = (e) => {
    e.preventDefault();
    setError('');
    const res = saveSchemeToCalendar({
      actorId,
      schemeId: selectedSchemeId,
      customSchemeName,
      lastCertifiedDate,
      leadDays,
      optInReminder,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSavedSchemes(listSavedSchemeCalendar({ actorId }).entries || []);
    setCustomSchemeName('');
  };

  const handleExportIcs = () => {
    setError('');
    const res = exportSchemeCalendarIcs({ actorId });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setIcsPreview(res.icsContent);
  };

  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: '1.5rem' }} aria-label="Government Scheme Renewal and Recertification Calendar">
      <header style={{ marginBottom: '1.5rem' }}>
        <h1>Government Scheme Renewal &amp; Recertification Calendar</h1>
        <p>
          Save selected schemes to track renewal cycles, grace-period rules, and reminder preferences.
          This calendar never automatically claims that an official renewal has been completed.
        </p>
      </header>

      {isOffline && (
        <div role="status" aria-live="polite" style={{ padding: '0.75rem', background: '#fef3c7', border: '1px solid #f59e0b', marginBottom: '1rem' }}>
          Offline mode: saved scheme reminders and .ics export remain available locally.
        </div>
      )}

      {error && (
        <div role="alert" style={{ padding: '0.75rem', background: '#fee2e2', border: '1px solid #ef4444', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <section aria-label="Save Scheme to Renewal Calendar" style={{ marginBottom: '1.5rem' }}>
        <h2>Add Scheme to Your Renewal Calendar</h2>
        <form onSubmit={handleSaveScheme} style={{ display: 'grid', gap: '0.75rem', maxWidth: 520 }}>
          <label>
            Scheme / Benefit
            <select value={selectedSchemeId} onChange={(e) => setSelectedSchemeId(e.target.value)}>
              {rules.map((r) => (
                <option key={r.schemeId} value={r.schemeId}>
                  {r.schemeName} ({r.cycleMonths}m cycle)
                </option>
              ))}
              <option value="custom_scheme">Other / Custom Scheme (Unverified)</option>
            </select>
          </label>

          {selectedSchemeId === 'custom_scheme' && (
            <label>
              Custom Scheme Name (Citizen-Entered Fact)
              <input
                type="text"
                value={customSchemeName}
                onChange={(e) => setCustomSchemeName(e.target.value)}
                placeholder="e.g., State Merit Scholarship"
                required
              />
            </label>
          )}

          <label>
            Last Certified / Approved Date
            <input
              type="date"
              value={lastCertifiedDate}
              onChange={(e) => setLastCertifiedDate(e.target.value)}
              required
            />
          </label>

          <label>
            Reminder Lead Days
            <input
              type="number"
              min={1}
              max={90}
              value={leadDays}
              onChange={(e) => setLeadDays(e.target.value)}
            />
          </label>

          <label>
            <input
              type="checkbox"
              checked={optInReminder}
              onChange={(e) => setOptInReminder(e.target.checked)}
            />{' '}
            Opt in to renewal reminders
          </label>

          <button type="submit">Save to Renewal Calendar</button>
        </form>
      </section>

      <section aria-label="Saved Scheme Renewals" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2>Saved Schemes ({savedSchemes.length})</h2>
          <button type="button" onClick={handleExportIcs}>Export Calendar (.ics)</button>
        </div>

        {savedSchemes.length === 0 ? (
          <p>No schemes saved yet. Add a scheme above to track its next recertification deadline.</p>
        ) : (
          <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
            {savedSchemes.map((entry) => (
              <li key={entry.entryId} style={{ border: '1px solid #cbd5e1', padding: '0.75rem', borderRadius: 6, marginBottom: '0.75rem' }}>
                <h3>{entry.schemeName}</h3>
                <p>
                  Next Renewal Due: <strong>{entry.nextRenewalDueDate}</strong> | Reminder Lead:{' '}
                  {entry.reminderPreferences.leadDays} days | Auto-Completed:{' '}
                  <strong>{String(entry.autoRenewalClaimed)}</strong>
                </p>
                <p>
                  Rule Status: <strong>{entry.officialRuleMetadata.verificationStatus}</strong> | Provenance:{' '}
                  {entry.officialRuleMetadata.provenance} | Grace Period: {entry.officialRuleMetadata.gracePeriodDays} days
                </p>
                {entry.officialRuleMetadata.sourceUrl && (
                  <p>
                    Official Grace-Period Source:{' '}
                    <a href={entry.officialRuleMetadata.sourceUrl} target="_blank" rel="noreferrer">
                      {entry.officialRuleMetadata.sourceUrl}
                    </a>{' '}
                    (Verified: {entry.officialRuleMetadata.lastVerifiedAt})
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {icsPreview && (
          <pre aria-label="Exported iCalendar Preview" style={{ background: '#f8fafc', padding: '0.75rem', overflowX: 'auto' }}>
            {icsPreview}
          </pre>
        )}
      </section>
    </main>
  );
}
