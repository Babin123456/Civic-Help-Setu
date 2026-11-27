import { useState, useEffect, useCallback } from 'react';
import {
  createHouseholdWorkspace,
  addPersonRecord,
  updatePersonConsent,
  addApplicationChecklist,
  toggleChecklistItem,
  getPersonWorkspace,
  exportPersonChecklist,
  deletePersonOrApplication,
  VALID_CONSENT_BASES,
} from '../services/caregiverChecklistService.js';

const PROVENANCE_STYLES = {
  official_record: { label: 'Official Record', bg: '#e0f2fe', color: '#0369a1' },
  citizen_entered: { label: 'Citizen-Entered Fact', bg: '#f1f5f9', color: '#334155' },
  ai_suggestion: { label: 'AI / Community Suggestion', bg: '#fef3c7', color: '#92400e' },
};

export default function CaregiverChecklistWorkspace({ actorId = 'caregiver-demo' }) {
  const [household, setHousehold] = useState(null);
  const [persons, setPersons] = useState([]);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [personWorkspace, setPersonWorkspace] = useState(null);
  const [duplicateWarnings, setDuplicateWarnings] = useState([]);
  const [exportPreview, setExportPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine === false : false
  );

  // Forms
  const [householdName, setHouseholdName] = useState('');
  const [personLabel, setPersonLabel] = useState('');
  const [relationship, setRelationship] = useState('dependant');
  const [jurisdiction, setJurisdiction] = useState('Uttar Pradesh');
  const [consentBasis, setConsentBasis] = useState('minor_guardian');

  const [serviceName, setServiceName] = useState('');
  const [applicationRef, setApplicationRef] = useState('');
  const [docLabel, setDocLabel] = useState('');
  const [docProvenance, setDocProvenance] = useState('citizen_entered');

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

  const refreshPerson = useCallback((hhId, pId) => {
    if (!hhId || !pId) {
      setPersonWorkspace(null);
      return;
    }
    setLoading(true);
    const res = getPersonWorkspace({ householdId: hhId, personId: pId, actorId });
    setLoading(false);
    if (!res.ok) {
      setError(res.error || 'Unable to load person workspace.');
      setPersonWorkspace(null);
      return;
    }
    setError('');
    setPersonWorkspace(res.person);
  }, [actorId]);

  const handleCreateHousehold = (e) => {
    e.preventDefault();
    setError('');
    try {
      const hh = createHouseholdWorkspace({ householdName, caregiverId: actorId });
      setHousehold(hh);
      setPersons([]);
      setSelectedPersonId(null);
      setPersonWorkspace(null);
      setHouseholdName('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddPerson = (e) => {
    e.preventDefault();
    if (!household) return;
    setError('');
    const res = addPersonRecord({
      householdId: household.householdId,
      actorId,
      displayLabel: personLabel,
      relationship,
      jurisdiction,
      consentBasis,
      consentStatus: 'granted',
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setPersons((prev) => [...prev, res.person]);
    setSelectedPersonId(res.person.personId);
    setPersonLabel('');
    refreshPerson(household.householdId, res.person.personId);
  };

  const handleToggleConsent = (nextStatus) => {
    if (!household || !selectedPersonId) return;
    setError('');
    const res = updatePersonConsent({
      householdId: household.householdId,
      personId: selectedPersonId,
      actorId,
      consentStatus: nextStatus,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setPersons((prev) => prev.map((p) => (p.personId === selectedPersonId ? res.person : p)));
    refreshPerson(household.householdId, selectedPersonId);
  };

  const handleAddApplication = (e) => {
    e.preventDefault();
    if (!household || !selectedPersonId) return;
    setError('');
    const res = addApplicationChecklist({
      householdId: household.householdId,
      personId: selectedPersonId,
      actorId,
      serviceName,
      applicationRef,
      jurisdiction,
      items: docLabel ? [{ label: docLabel, provenance: docProvenance }] : [],
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDuplicateWarnings(res.duplicateWarnings || []);
    setServiceName('');
    setApplicationRef('');
    setDocLabel('');
    refreshPerson(household.householdId, selectedPersonId);
  };

  const handleToggleItem = (app, itemLabel, checked) => {
    const res = toggleChecklistItem({
      householdId: household.householdId,
      personId: selectedPersonId,
      applicationId: app.applicationId,
      itemLabel,
      checked,
      actorId,
      expectedRev: app.progress.rev,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    refreshPerson(household.householdId, selectedPersonId);
  };

  const handleExport = () => {
    if (!household || !selectedPersonId) return;
    const res = exportPersonChecklist({
      householdId: household.householdId,
      personId: selectedPersonId,
      actorId,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setExportPreview(res.exportPayload);
  };

  const handleDeletePerson = () => {
    if (!household || !selectedPersonId) return;
    const res = deletePersonOrApplication({
      householdId: household.householdId,
      personId: selectedPersonId,
      actorId,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const remaining = persons.filter((p) => p.personId !== selectedPersonId);
    setPersons(remaining);
    const nextId = remaining[0]?.personId || null;
    setSelectedPersonId(nextId);
    setExportPreview(null);
    refreshPerson(household.householdId, nextId);
  };

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem' }} aria-label="Caregiver Document Checklist Workspace">
      <header style={{ marginBottom: '1.5rem' }}>
        <h1>Caregiver-Managed Multi-Person Document Checklist</h1>
        <p>
          Keep each dependant&apos;s certificates, application references, and consent rules strictly isolated.
          Do not enter Aadhaar numbers, PAN, passwords, OTPs, or biometrics.
        </p>
      </header>

      {isOffline && (
        <div role="status" aria-live="polite" style={{ padding: '0.75rem', background: '#fef3c7', border: '1px solid #f59e0b', marginBottom: '1rem' }}>
          Offline mode: changes are saved locally in your browser workspace.
        </div>
      )}

      {error && (
        <div role="alert" style={{ padding: '0.75rem', background: '#fee2e2', border: '1px solid #ef4444', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {!household ? (
        <section aria-label="Create Household Workspace">
          <h2>Start a Household Workspace</h2>
          <form onSubmit={handleCreateHousehold} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <label htmlFor="household-name-input">Household Label</label>
            <input
              id="household-name-input"
              type="text"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="e.g., Sharma Family Workspace"
              required
            />
            <button type="submit">Create Workspace</button>
          </form>
        </section>
      ) : (
        <>
          <section aria-label="Household Members" style={{ marginBottom: '1.5rem' }}>
            <h2>Household: {household.householdName}</h2>
            <form onSubmit={handleAddPerson} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <input
                aria-label="Person Display Label"
                type="text"
                value={personLabel}
                onChange={(e) => setPersonLabel(e.target.value)}
                placeholder="Person label (e.g., Child A)"
                required
              />
              <input
                aria-label="Relationship"
                type="text"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="Relationship"
              />
              <input
                aria-label="Jurisdiction"
                type="text"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                placeholder="Jurisdiction"
              />
              <select aria-label="Consent Basis" value={consentBasis} onChange={(e) => setConsentBasis(e.target.value)}>
                {VALID_CONSENT_BASES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <button type="submit">Add Person Record</button>
            </form>

            {persons.length === 0 ? (
              <p>No person records yet. Add a dependant or family member above.</p>
            ) : (
              <div role="tablist" aria-label="Person Records" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {persons.map((p) => (
                  <button
                    key={p.personId}
                    type="button"
                    role="tab"
                    aria-selected={selectedPersonId === p.personId}
                    onClick={() => {
                      setSelectedPersonId(p.personId);
                      setExportPreview(null);
                      refreshPerson(household.householdId, p.personId);
                    }}
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontWeight: selectedPersonId === p.personId ? 'bold' : 'normal',
                    }}
                  >
                    {p.displayLabel} ({p.consentStatus})
                  </button>
                ))}
              </div>
            )}
          </section>

          {loading && <p role="status">Loading person checklist...</p>}

          {selectedPersonId && (
            <section aria-label="Selected Person Controls" style={{ border: '1px solid #cbd5e1', padding: '1rem', borderRadius: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                <div>
                  <strong>Guardian/Consent Controls:</strong>{' '}
                  <button type="button" onClick={() => handleToggleConsent('granted')}>Grant Consent</button>{' '}
                  <button type="button" onClick={() => handleToggleConsent('revoked')}>Revoke Consent</button>
                </div>
                <div>
                  <button type="button" onClick={handleExport}>Export Scoped Checklist</button>{' '}
                  <button type="button" onClick={handleDeletePerson}>Delete Person Record</button>
                </div>
              </div>

              {duplicateWarnings.length > 0 && (
                <div role="status" aria-live="polite" style={{ background: '#fef3c7', padding: '0.75rem', marginBottom: '1rem' }}>
                  <strong>Duplicate / Mixup Warnings:</strong>
                  <ul>
                    {duplicateWarnings.map((w, idx) => (
                      <li key={idx}>{w.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {personWorkspace && (
                <>
                  <form onSubmit={handleAddApplication} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <input
                      aria-label="Service Name"
                      type="text"
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      placeholder="Service (e.g., Income Certificate)"
                      required
                    />
                    <input
                      aria-label="Application Reference"
                      type="text"
                      value={applicationRef}
                      onChange={(e) => setApplicationRef(e.target.value)}
                      placeholder="Application Ref ID"
                    />
                    <input
                      aria-label="Checklist Document Item"
                      type="text"
                      value={docLabel}
                      onChange={(e) => setDocLabel(e.target.value)}
                      placeholder="Document item"
                    />
                    <select aria-label="Item Provenance" value={docProvenance} onChange={(e) => setDocProvenance(e.target.value)}>
                      <option value="citizen_entered">Citizen-Entered Fact</option>
                      <option value="official_record">Official Record</option>
                      <option value="ai_suggestion">AI / Community Suggestion</option>
                    </select>
                    <button type="submit">Add Application Checklist</button>
                  </form>

                  {personWorkspace.applications.length === 0 ? (
                    <p>No application checklists for {personWorkspace.displayLabel} yet.</p>
                  ) : (
                    personWorkspace.applications.map((app) => (
                      <article key={app.applicationId} style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                        <h3>{app.serviceName}</h3>
                        <p>
                          Ref: <code>{app.applicationRef || 'None'}</code> | Jurisdiction: {app.officialMetadata.jurisdiction} |{' '}
                          Official Rule Status: <strong>{app.officialMetadata.verificationStatus}</strong>
                        </p>
                        <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                          {app.items.map((item) => {
                            const checked = app.progress.checked.includes(item.label);
                            const badge = PROVENANCE_STYLES[item.provenance] || PROVENANCE_STYLES.citizen_entered;
                            return (
                              <li key={item.label} style={{ marginBottom: '0.4rem' }}>
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => handleToggleItem(app, item.label, e.target.checked)}
                                  />{' '}
                                  {item.label}{' '}
                                  <span style={{ background: badge.bg, color: badge.color, padding: '0.1rem 0.4rem', fontSize: '0.8rem', borderRadius: 4 }}>
                                    {badge.label}
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </article>
                    ))
                  )}
                </>
              )}

              {exportPreview && (
                <pre aria-label="Scoped Export Preview" style={{ background: '#f8fafc', padding: '0.75rem', overflowX: 'auto' }}>
                  {JSON.stringify(exportPreview, null, 2)}
                </pre>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
