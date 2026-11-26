import { useEffect, useMemo, useState } from 'react';
import { BusFront, CalendarDays, ExternalLink, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import StandardPageHeader from '../components/common/StandardPageHeader';
import {
  findTransitRecord,
  formatTransitPolicyValue,
  getTransitCities,
  getTransitOperators,
  getTransitStates,
  isTransitRecordStale,
  TRANSIT_POLICY_FIELDS,
  TRANSIT_MODES,
} from '../data/transitConcessions';
import {
  deleteTransitChecklist,
  readTransitChecklists,
  saveTransitChecklist,
} from '../services/transitConcessionStorage';
import './TransitConcessionsDirectory.css';

const CHECKLIST_ITEMS = [
  ['eligibility', 'Check eligibility with the operator'],
  ['application', 'Confirm application steps and required documents'],
  ['renewal', 'Confirm renewal steps'],
  ['lost_pass', 'Confirm lost or blocked pass procedure'],
];

const emptyChecklist = () => ({ renewalDate: '', completed: {}, notes: '' });

export default function TransitConcessionsDirectory() {
  const states = useMemo(() => getTransitStates(), []);
  const [state, setState] = useState(states[0] || '');
  const [city, setCity] = useState(() => getTransitCities(states[0])[0] || '');
  const [operatorId, setOperatorId] = useState(() => getTransitOperators(states[0], getTransitCities(states[0])[0])[0]?.id || '');
  const [mode, setMode] = useState(() => findTransitRecord(operatorId)?.mode || 'bus');
  const [checklists, setChecklists] = useState({});
  const [checklistsLoading, setChecklistsLoading] = useState(true);
  const [storageError, setStorageError] = useState('');
  const [correction, setCorrection] = useState({ proposedChange: '', officialSourceUrl: '', sourceDate: '', effectiveDate: '', website_trap: '' });
  const [submissionStatus, setSubmissionStatus] = useState({ loading: false, error: '', message: '' });

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => readTransitChecklists())
      .then((saved) => {
        if (active) setChecklists(saved);
      })
      .catch((error) => {
        if (active) setStorageError(error.message);
      })
      .finally(() => {
        if (active) setChecklistsLoading(false);
      });
    return () => { active = false; };
  }, []);

  const cities = useMemo(() => getTransitCities(state), [state]);
  const operators = useMemo(() => getTransitOperators(state, city), [state, city]);
  const selectedRecord = operators.find((record) => record.id === operatorId && record.mode === mode) ||
    operators.find((record) => record.mode === mode) || null;
  const recordIsStale = selectedRecord ? isTransitRecordStale(selectedRecord) : true;
  const canShowRules = selectedRecord?.status === 'verified' && !recordIsStale;
  const matchingModes = operators.map((record) => record.mode);
  const currentChecklist = checklists[operatorId] || emptyChecklist();

  const handleStateChange = (nextState) => {
    const nextCity = getTransitCities(nextState)[0] || '';
    const nextOperator = getTransitOperators(nextState, nextCity)[0];
    setState(nextState);
    setCity(nextCity);
    setOperatorId(nextOperator?.id || '');
    setMode(nextOperator?.mode || 'bus');
  };

  const handleCityChange = (nextCity) => {
    const nextOperator = getTransitOperators(state, nextCity)[0];
    setCity(nextCity);
    setOperatorId(nextOperator?.id || '');
    setMode(nextOperator?.mode || 'bus');
  };

  const handleOperatorChange = (nextId) => {
    const nextRecord = findTransitRecord(nextId);
    setOperatorId(nextId);
    if (nextRecord) setMode(nextRecord.mode);
  };

  const handleModeChange = (nextMode) => {
    const nextOperator = operators.find((record) => record.mode === nextMode);
    if (!nextOperator) return;
    setMode(nextMode);
    setOperatorId(nextOperator.id);
  };

  const updateChecklist = (patch) => {
    const updated = { ...currentChecklist, ...patch };
    try {
      const saved = saveTransitChecklist(operatorId, updated);
      setChecklists((previous) => ({ ...previous, [operatorId]: saved }));
      setStorageError('');
    } catch (error) {
      setStorageError(error.message);
    }
  };

  const handleDeleteChecklist = () => {
    try {
      deleteTransitChecklist(operatorId);
      setChecklists((previous) => {
        const next = { ...previous };
        delete next[operatorId];
        return next;
      });
      setStorageError('');
    } catch (error) {
      setStorageError(error.message);
    }
  };

  const handleSubmitCorrection = async (event) => {
    event.preventDefault();
    setSubmissionStatus({ loading: true, error: '', message: '' });
    try {
      const response = await fetch('/api/transit-concessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...correction, recordId: operatorId, mode }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.details?.join(' ') || result.error || 'Unable to submit correction.');
      setCorrection({ proposedChange: '', officialSourceUrl: '', sourceDate: '', effectiveDate: '', website_trap: '' });
      setSubmissionStatus({ loading: false, error: '', message: 'Correction sent for administrator review. It will not appear as verified until reviewed.' });
    } catch (error) {
      setSubmissionStatus({ loading: false, error: error.message, message: '' });
    }
  };

  return (
    <div className="transit-directory section">
      <div className="container">
        <StandardPageHeader
          eyebrow="Transport access"
          eyebrowIcon={<BusFront size={16} />}
          title="Public transport concessions"
          subtitle="Check operator-specific concession rules, track pass renewal, and share source-backed corrections."
          badgeText="Official-source first"
          badgeType="accent"
        />

        <p className="transit-privacy-note" role="note">
          Saved checklist details stay in this browser. Do not enter pass numbers, identity numbers, phone numbers, or other personal identifiers.
        </p>

        <section className="transit-panel" aria-labelledby="transit-jurisdiction-heading">
          <h2 id="transit-jurisdiction-heading">Choose your transport operator</h2>
          <div className="transit-select-grid">
            <label>
              State / Union Territory
              <select value={state} onChange={(event) => handleStateChange(event.target.value)} aria-label="State or Union Territory">
                {states.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              City
              <select value={city} onChange={(event) => handleCityChange(event.target.value)} aria-label="City">
                {cities.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Transport operator
              <select value={operatorId} onChange={(event) => handleOperatorChange(event.target.value)} aria-label="Transport operator">
                {operators.map((item) => <option key={item.id} value={item.id}>{item.operator}</option>)}
              </select>
            </label>
          </div>
          <div className="transit-mode-tabs" role="group" aria-label="Transport type">
            {TRANSIT_MODES.map((item) => {
              const disabled = !matchingModes.includes(item.id);
              return (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={mode === item.id}
                  disabled={disabled}
                  onClick={() => handleModeChange(item.id)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </section>

        {selectedRecord ? (
          <section className="transit-panel" aria-live="polite" aria-labelledby="concession-details-heading">
            <div className="transit-panel-heading">
              <div>
                <span className="transit-status">
                  {canShowRules ? 'VERIFIED OFFICIAL RULE' : recordIsStale && selectedRecord.status === 'verified' ? 'STALE · RE-VERIFICATION NEEDED' : 'UNVERIFIED · RULES UNAVAILABLE'}
                </span>
                <h2 id="concession-details-heading">{selectedRecord.operator}</h2>
                <p>{selectedRecord.jurisdiction.city}, {selectedRecord.jurisdiction.state} · {TRANSIT_MODES.find((item) => item.id === mode)?.label}</p>
              </div>
              {canShowRules ? <ShieldCheck aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
            </div>
            {!canShowRules ? (
              <p className="transit-unavailable" role="status">
                {recordIsStale && selectedRecord.status === 'verified'
                  ? 'The last verified rule is more than 180 days old. Its requirements are hidden until an administrator rechecks a dated official source.'
                  : 'We do not yet have a reviewed, dated official concession rule for this operator. Eligibility, fees, validity, routes, application, renewal, and lost-pass procedures are unavailable; no requirements have been assumed.'}
              </p>
            ) : (
              <>
                <dl className="transit-provenance transit-policy-facts">
                  {TRANSIT_POLICY_FIELDS.filter(([key]) => selectedRecord[key] !== null && selectedRecord[key] !== undefined).map(([key, label]) => (
                    <div key={key}><dt>{label}</dt><dd>{formatTransitPolicyValue(selectedRecord[key])}</dd></div>
                  ))}
                </dl>
                <section className="transit-instructions" aria-labelledby="official-instructions-heading">
                  <h3 id="official-instructions-heading">Official instructions</h3>
                  <p>{selectedRecord.officialInstructions.title}</p>
                  <p>{selectedRecord.officialInstructions.content}</p>
                </section>
                {selectedRecord.editorialExplanation && (
                  <section className="transit-instructions" aria-labelledby="editorial-explanation-heading">
                    <h3 id="editorial-explanation-heading">Editorial explanation</h3>
                    <p>{selectedRecord.editorialExplanation}</p>
                  </section>
                )}
                {selectedRecord.generatedSummary && (
                  <section className="transit-instructions" aria-labelledby="generated-summary-heading">
                    <h3 id="generated-summary-heading">Generated summary</h3>
                    <p>{selectedRecord.generatedSummary}</p>
                  </section>
                )}
              </>
            )}
            <dl className="transit-provenance">
              <div><dt>Authority</dt><dd>{selectedRecord.authority}</dd></div>
              <div><dt>Official source</dt><dd><a href={selectedRecord.sourceUrl} target="_blank" rel="noreferrer">Open official source <ExternalLink size={14} aria-hidden="true" /></a></dd></div>
              <div><dt>Rule source date</dt><dd>{selectedRecord.sourceDate || 'Unavailable — no rule source has been verified'}</dd></div>
              <div><dt>Effective date</dt><dd>{selectedRecord.effectiveDate || 'Unknown'}</dd></div>
              <div><dt>Last verification</dt><dd>{selectedRecord.verifiedAt || 'Not verified'}</dd></div>
            </dl>
            {!canShowRules && <p className="transit-source-caveat">The linked page is an operator reference, not evidence of a concession. Official instructions, editorial guidance, and generated summaries are kept separate and are not shown until supported by a dated official source.</p>}
          </section>
        ) : (
          <p className="transit-empty" role="status">No operator is listed for this jurisdiction yet.</p>
        )}

        <section className="transit-panel" aria-labelledby="checklist-heading">
          <div className="transit-panel-heading">
            <div>
              <h2 id="checklist-heading">My renewal checklist</h2>
              <p>Saved only on this device; reopen this page to continue editing.</p>
            </div>
            <CalendarDays aria-hidden="true" />
          </div>
          {checklistsLoading && <p role="status">Loading your saved checklist…</p>}
          {!selectedRecord ? <p>Select an operator to create a checklist.</p> : (
            <>
              <label className="transit-renewal-date">
                Pass renewal date (optional)
                <input type="date" disabled={checklistsLoading} value={currentChecklist.renewalDate} onChange={(event) => updateChecklist({ renewalDate: event.target.value })} />
              </label>
              <div className="transit-checklist">
                {CHECKLIST_ITEMS.map(([id, text]) => (
                  <label key={id}>
                    <input
                      type="checkbox"
                      disabled={checklistsLoading}
                      checked={currentChecklist.completed[id] === true}
                      onChange={(event) => updateChecklist({ completed: { ...currentChecklist.completed, [id]: event.target.checked } })}
                    />
                    {text}
                  </label>
                ))}
              </div>
              <label className="transit-notes">
                Private notes (do not include personal identifiers)
                <textarea disabled={checklistsLoading} maxLength={1000} value={currentChecklist.notes} onChange={(event) => updateChecklist({ notes: event.target.value })} />
              </label>
              <button type="button" className="transit-delete-button" disabled={checklistsLoading} onClick={handleDeleteChecklist}>
                <Trash2 size={16} aria-hidden="true" /> Delete this saved checklist
              </button>
            </>
          )}
          {storageError && <p className="transit-error" role="alert">{storageError}</p>}
        </section>

        <section className="transit-panel" aria-labelledby="correction-heading">
          <h2 id="correction-heading">Suggest a source-backed correction</h2>
          <p>Submissions are validated on the server and reviewed by an administrator. Do not include personal or pass identifiers.</p>
          <form onSubmit={handleSubmitCorrection}>
            <label>
              Correction (no personal details)
              <textarea required minLength={10} maxLength={1200} value={correction.proposedChange} onChange={(event) => setCorrection({ ...correction, proposedChange: event.target.value })} />
            </label>
            <div className="transit-select-grid">
              <label>
                Official source URL
                <input type="url" required value={correction.officialSourceUrl} onChange={(event) => setCorrection({ ...correction, officialSourceUrl: event.target.value })} />
              </label>
              <label>
                Source publication date
                <input type="date" required value={correction.sourceDate} onChange={(event) => setCorrection({ ...correction, sourceDate: event.target.value })} />
              </label>
              <label>
                Effective date (if stated)
                <input type="date" value={correction.effectiveDate} onChange={(event) => setCorrection({ ...correction, effectiveDate: event.target.value })} />
              </label>
            </div>
            <label className="transit-honeypot" aria-hidden="true">
              Leave this field empty
              <input tabIndex="-1" autoComplete="off" value={correction.website_trap} onChange={(event) => setCorrection({ ...correction, website_trap: event.target.value })} />
            </label>
            <button type="submit" disabled={submissionStatus.loading || !selectedRecord}>
              {submissionStatus.loading ? 'Submitting…' : 'Submit for review'}
            </button>
            {submissionStatus.message && <p role="status">{submissionStatus.message}</p>}
            {submissionStatus.error && <p className="transit-error" role="alert">{submissionStatus.error}</p>}
          </form>
        </section>
      </div>
    </div>
  );
}
