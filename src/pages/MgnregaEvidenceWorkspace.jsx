import { useState, useEffect } from 'react';
import {
  createEvidenceCase,
  recordWorkAllocation,
  addMusterRollAndWageEvidence,
  exportPrivacySafeComplaintDossier,
  NO_FABRICATED_ENTITLEMENT_DISCLAIMER,
  PUBLISHED_MGNREGA_PROCESS_REFERENCES,
} from '../services/mgnregaEvidenceBuilderService.js';

export default function MgnregaEvidenceWorkspace({ workerId = 'worker-demo' }) {
  const [evidenceCase, setEvidenceCase] = useState(null);
  const [dossier, setDossier] = useState(null);
  const [error, setError] = useState('');
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine === false : false
  );

  // Step 1: Demand Receipt
  const [demandReceiptRef, setDemandReceiptRef] = useState('');
  const [demandDate, setDemandDate] = useState('');
  const [daysDemanded, setDaysDemanded] = useState('14');
  const [panchayat, setPanchayat] = useState('');

  // Step 2: Work Allocation
  const [allocationStatus, setAllocationStatus] = useState('allocated');
  const [workAllocationDate, setWorkAllocationDate] = useState('');
  const [worksiteName, setWorksiteName] = useState('');

  // Step 3: Muster Roll & Wage Credit
  const [musterRollRef, setMusterRollRef] = useState('');
  const [daysWorkedClaimed, setDaysWorkedClaimed] = useState('14');
  const [daysRecordedOnMusterRoll, setDaysRecordedOnMusterRoll] = useState('14');
  const [wageCreditStatus, setWageCreditStatus] = useState('unpaid');
  const [unpaidPeriodNote, setUnpaidPeriodNote] = useState('');

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

  const handleCreateCase = (e) => {
    e.preventDefault();
    setError('');
    const res = createEvidenceCase({
      workerId,
      panchayat,
      demandReceiptRef,
      demandDate,
      daysDemanded,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEvidenceCase(res.evidenceCase);
  };

  const handleAllocation = (e) => {
    e.preventDefault();
    if (!evidenceCase) return;
    setError('');
    const res = recordWorkAllocation({
      caseId: evidenceCase.caseId,
      actorId: workerId,
      allocationStatus,
      workAllocationDate,
      worksiteName,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEvidenceCase({ ...res.evidenceCase });
  };

  const handleMusterRoll = (e) => {
    e.preventDefault();
    if (!evidenceCase) return;
    setError('');
    const res = addMusterRollAndWageEvidence({
      caseId: evidenceCase.caseId,
      actorId: workerId,
      musterRollRef,
      daysWorkedClaimed,
      daysRecordedOnMusterRoll,
      wageCreditStatus,
      unpaidPeriodNote,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEvidenceCase({ ...res.evidenceCase });
    setMusterRollRef('');
    setUnpaidPeriodNote('');
  };

  const handleExport = () => {
    if (!evidenceCase) return;
    setError('');
    const res = exportPrivacySafeComplaintDossier({
      caseId: evidenceCase.caseId,
      actorId: workerId,
      saveToGrievanceDrafts: true,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDossier(res.dossier);
  };

  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: '1.5rem' }} aria-label="MGNREGA Work-Demand and Wage Delay Evidence Builder">
      <header style={{ marginBottom: '1.5rem' }}>
        <h1>MGNREGA Work-Demand &amp; Wage Delay Evidence Builder</h1>
        <p>
          Step-by-step worker-controlled timeline for demand receipts, work allocation dates, muster-roll discrepancies,
          and unpaid wage periods. Do NOT enter Aadhaar numbers, bank accounts, OTPs, or passwords.
        </p>
        <div role="note" style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '0.75rem', borderRadius: 6 }}>
          <strong>Important Notice:</strong> {NO_FABRICATED_ENTITLEMENT_DISCLAIMER}
        </div>
      </header>

      {isOffline && (
        <div role="status" aria-live="polite" style={{ padding: '0.75rem', background: '#fef3c7', border: '1px solid #f59e0b', marginBottom: '1rem' }}>
          Offline mode: your evidence timeline is saved locally on this device.
        </div>
      )}

      {error && (
        <div role="alert" style={{ padding: '0.75rem', background: '#fee2e2', border: '1px solid #ef4444', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <section aria-label="Published MGNREGA Official Process References" style={{ marginBottom: '1.5rem' }}>
        <h2>Published MGNREGA Process References (Official Record)</h2>
        <ul>
          {PUBLISHED_MGNREGA_PROCESS_REFERENCES.map((ref) => (
            <li key={ref.ruleId}>
              <strong>{ref.title}</strong> — {ref.jurisdiction} (Effective: {ref.effectiveDate}, Verified: {ref.lastVerifiedAt})
            </li>
          ))}
        </ul>
      </section>

      {!evidenceCase ? (
        <section aria-label="Step 1: Demand Receipt">
          <h2>Step 1: Record Your Work Demand Receipt (Citizen-Entered Fact)</h2>
          <form onSubmit={handleCreateCase} style={{ display: 'grid', gap: '0.75rem', maxWidth: 480 }}>
            <label>
              Work Demand Receipt Number
              <input
                type="text"
                value={demandReceiptRef}
                onChange={(e) => setDemandReceiptRef(e.target.value)}
                placeholder="e.g., DR-2026-041"
                required
              />
            </label>
            <label>
              Demand Date
              <input
                type="date"
                value={demandDate}
                onChange={(e) => setDemandDate(e.target.value)}
                required
              />
            </label>
            <label>
              Days of Work Demanded
              <input
                type="number"
                min={1}
                max={100}
                value={daysDemanded}
                onChange={(e) => setDaysDemanded(e.target.value)}
              />
            </label>
            <label>
              Gram Panchayat Name
              <input
                type="text"
                value={panchayat}
                onChange={(e) => setPanchayat(e.target.value)}
                placeholder="Optional Panchayat name"
              />
            </label>
            <button type="submit">Start Evidence Timeline</button>
          </form>
        </section>
      ) : (
        <>
          <section aria-label="Step 2: Work Allocation" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginBottom: '1rem' }}>
            <h2>Step 2: Work Allocation Date &amp; Worksite</h2>
            <form onSubmit={handleAllocation} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select aria-label="Allocation Status" value={allocationStatus} onChange={(e) => setAllocationStatus(e.target.value)}>
                <option value="allocated">Work Allocated</option>
                <option value="pending">Pending Allocation</option>
                <option value="not_allocated">Not Allocated</option>
              </select>
              <input aria-label="Allocation Date" type="date" value={workAllocationDate} onChange={(e) => setWorkAllocationDate(e.target.value)} />
              <input aria-label="Worksite Name" type="text" value={worksiteName} onChange={(e) => setWorksiteName(e.target.value)} placeholder="Worksite name" />
              <button type="submit">Save Allocation</button>
            </form>
          </section>

          <section aria-label="Step 3: Muster Roll and Wage Evidence" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginBottom: '1rem' }}>
            <h2>Step 3: Muster-Roll &amp; Unpaid Wage Evidence</h2>
            <form onSubmit={handleMusterRoll} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input aria-label="Muster Roll Number" type="text" value={musterRollRef} onChange={(e) => setMusterRollRef(e.target.value)} placeholder="Muster Roll Ref" required />
              <input aria-label="Days Worked Claimed" type="number" value={daysWorkedClaimed} onChange={(e) => setDaysWorkedClaimed(e.target.value)} placeholder="Days claimed" />
              <input aria-label="Days Recorded on Muster Roll" type="number" value={daysRecordedOnMusterRoll} onChange={(e) => setDaysRecordedOnMusterRoll(e.target.value)} placeholder="Days on muster roll" />
              <select aria-label="Wage Credit Status" value={wageCreditStatus} onChange={(e) => setWageCreditStatus(e.target.value)}>
                <option value="unpaid">Unpaid</option>
                <option value="delayed">Delayed</option>
                <option value="paid">Paid</option>
              </select>
              <input aria-label="Unpaid Period Note" type="text" value={unpaidPeriodNote} onChange={(e) => setUnpaidPeriodNote(e.target.value)} placeholder="Note (no Aadhaar/bank)" />
              <button type="submit">Add Muster-Roll Evidence</button>
            </form>
          </section>

          <section aria-label="Step 4: Evidence Timeline and Export" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
            <h2>Step 4: Worker Evidence Timeline &amp; Privacy-Safe Export</h2>
            <p>
              Local Rule Verification Status: <strong>{evidenceCase.officialRuleMetadata.localRule.verificationStatus}</strong>
            </p>
            <ul>
              {evidenceCase.timeline.map((evt) => (
                <li key={evt.eventId}>
                  <code>{evt.date}</code> — {evt.summary} <span>[{evt.provenance}]</span>
                </li>
              ))}
            </ul>
            <button type="button" onClick={handleExport}>Export Privacy-Safe Complaint Dossier</button>
            {dossier && (
              <pre aria-label="Privacy-Safe Complaint Dossier" style={{ background: '#f8fafc', padding: '0.75rem', marginTop: '0.75rem', overflowX: 'auto' }}>
                {JSON.stringify(dossier, null, 2)}
              </pre>
            )}
          </section>
        </>
      )}
    </main>
  );
}
