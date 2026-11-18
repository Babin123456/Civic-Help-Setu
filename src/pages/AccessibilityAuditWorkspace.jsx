import { useState, useMemo } from 'react';
import {
  Printer,
} from 'lucide-react';
import {
  CHECKS,
  evaluateAudit,
  evaluateMeasuredAudit,
  generateRemediationPlan,
  estimatePenalty,
  draftAccessibilityPetition,
  PRELIMINARY_SCREENING_DISCLAIMER,
} from '../services/accessibilityAuditService.js';
import {
  listAudits,
  saveAudit,
  deleteAudit,
  verifyAudit,
} from '../services/accessibilityAuditStorage.js';
import MeasuredAuditTable from '../components/accessibilityAudit/MeasuredAuditTable.jsx';
import RemediationPlanCard from '../components/accessibilityAudit/RemediationPlanCard.jsx';
import ReassessmentTimelineCard from '../components/accessibilityAudit/ReassessmentTimelineCard.jsx';
import PrintableAccessibilityReportModal from '../components/accessibilityAudit/PrintableAccessibilityReportModal.jsx';
import './DarkPatternsWorkspace.css';

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AccessibilityAuditWorkspace() {
  const [answers, setAnswers] = useState({});
  const [measurements, setMeasurements] = useState({});
  const [remediationPlan, setRemediationPlan] = useState([]);
  const [reassessments, setReassessments] = useState([]);
  const [activeRecordId, setActiveRecordId] = useState(null);
  const [offence, setOffence] = useState('unknown');
  const [authority, setAuthority] = useState('state');
  const [facility, setFacility] = useState('');
  const [district, setDistrict] = useState('');
  const [facts, setFacts] = useState('');
  const [records, setRecords] = useState(() => {
    try {
      return listAudits();
    } catch {
      return [];
    }
  });
  const [status, setStatus] = useState('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Legacy evaluation
  const audit = evaluateAudit(answers);

  // Measured audit evaluation
  const measuredEvaluation = useMemo(() => {
    return evaluateMeasuredAudit(measurements, answers);
  }, [measurements, answers]);

  // Combined failures list for petition drafting
  const combinedAudit = useMemo(() => {
    const measuredFailures = measuredEvaluation.items
      .filter(i => i.status === 'NON_COMPLIANT')
      .map(i => `${i.label} (Gap: ${i.gap} ${i.unit})`);
    const allFailures = Array.from(new Set([...audit.failures, ...measuredFailures]));
    return {
      ...audit,
      failures: allFailures,
    };
  }, [audit, measuredEvaluation]);

  const petition = draftAccessibilityPetition({
    authority,
    facility,
    district,
    facts,
    audit: combinedAudit,
  });

  const handleMeasurementChange = (key, val) => {
    const updatedMeasurements = { ...measurements, [key]: val };
    setMeasurements(updatedMeasurements);

    // Auto-update remediation plan for non-compliant items
    const newEval = evaluateMeasuredAudit(updatedMeasurements, answers);
    const newPlan = generateRemediationPlan(newEval, {
      responsibleParty: `${facility || 'Facility'} Maintenance Team`,
    });
    setRemediationPlan(newPlan);
  };

  const handleLoadRecord = (r) => {
    setActiveRecordId(r.id);
    setAnswers(r.answers || {});
    setMeasurements(r.measurements || {});
    setRemediationPlan(r.remediationPlan || []);
    setReassessments(r.reassessments || []);
    if (r.facilityName) setFacility(r.facilityName);
    if (r.district) setDistrict(r.district);
    setStatus(`Loaded audit for "${r.facilityName || r.id}".`);
  };

  async function save() {
    try {
      const payload = {
        id: activeRecordId || undefined,
        facilityName: facility,
        district,
        answers,
        measurements,
        remediationPlan,
        reassessments,
      };
      const saved = await saveAudit(payload);
      setActiveRecordId(saved.id);
      setRecords(listAudits());
      setStatus('Structured audit saved locally with SHA-256 seal.');
    } catch (e) {
      setStatus(`Could not save: ${e.message}`);
    }
  }

  async function verify(record) {
    try {
      setStatus((await verifyAudit(record)) ? 'Seal matches.' : 'Seal mismatch.');
    } catch (e) {
      setStatus(e.message);
    }
  }

  function remove(id) {
    try {
      deleteAudit(id);
      setRecords(listAudits());
      if (activeRecordId === id) setActiveRecordId(null);
      setStatus('Deleted.');
    } catch (e) {
      setStatus(e.message);
    }
  }

  const currentAuditRecord = {
    id: activeRecordId,
    facilityName: facility,
    district,
    createdAt: new Date().toISOString(),
    reassessments,
  };

  return (
    <main className="dark-workspace">
      <h1>Universal Accessibility Audit Workspace</h1>
      <p>
        Screen buildings and transit facilities against selected 2021 Harmonised Guidelines benchmarks and prepare a representation under the Rights of Persons with Disabilities Act, 2016. This is a screening tool, not a legal or professional accessibility audit.
      </p>

      {/* Preliminary Screening Disclaimer Notice */}
      <div
        style={{
          background: '#fef3c7',
          border: '1px solid #fde68a',
          borderRadius: '8px',
          padding: '0.85rem 1rem',
          marginBottom: '1.25rem',
          fontSize: '0.82rem',
          color: '#92400e',
        }}
      >
        <strong>Statutory Notice:</strong> {PRELIMINARY_SCREENING_DISCLAIMER}
      </div>

      {/* Facility Details Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          background: 'var(--surface-color, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '10px',
          padding: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: '0.25rem' }}>
            Facility / Building Name
          </label>
          <input
            type="text"
            placeholder="e.g. Sub-Divisional Hospital OPD Block"
            value={facility}
            onChange={(e) => setFacility(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #cbd5e1)',
              fontSize: '0.88rem',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: '0.25rem' }}>
            District &amp; State
          </label>
          <input
            type="text"
            placeholder="e.g. Pune, Maharashtra"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #cbd5e1)',
              fontSize: '0.88rem',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 1rem',
              borderRadius: '6px',
              border: '1px solid #0284c7',
              background: '#e0f2fe',
              color: '#0369a1',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Printer size={16} />
            Generate Printable Report
          </button>
        </div>
      </div>

      {/* 1. Measured Benchmarks Audit Table */}
      <MeasuredAuditTable
        measurements={measurements}
        onMeasurementChange={handleMeasurementChange}
      />

      {/* 2. Remediation Planning */}
      <RemediationPlanCard
        plan={remediationPlan}
        onPlanChange={setRemediationPlan}
      />

      {/* 3. Reassessment History Tracker */}
      <ReassessmentTimelineCard
        auditRecord={currentAuditRecord}
        currentMeasurements={measurements}
        currentAnswers={answers}
        onReassessmentAdded={(updated) => {
          setReassessments(updated.reassessments || []);
          setStatus('Reassessment snapshot recorded.');
        }}
      />

      {/* Legacy Screening Checklist (Preserved for compatibility) */}
      <section>
        <h2>Accessibility checklist</h2>
        <p>
          Inspect and measure the facility. Select unknown when not assessed, or not applicable where the feature is absent and not required. Seek specialist guidance on applicability.
        </p>
        {CHECKS.map(c => (
          <label key={c.key}>
            {c.label}
            <select
              value={answers[c.key] || 'unknown'}
              onChange={e => setAnswers({ ...answers, [c.key]: e.target.value })}
            >
              <option value="unknown">Unknown / not assessed</option>
              <option value="yes">Meets benchmark</option>
              <option value="no">Does not meet benchmark</option>
              <option value="na">Not applicable</option>
            </select>
          </label>
        ))}
        <p>
          Screening score: {audit.score === null ? 'Not available' : `${audit.score}%`} ({audit.assessed} of {CHECKS.length} checks assessed). Unknown and not-applicable checks are excluded; a high score does not establish compliance.
        </p>
        <p>
          Priority safety barriers: {audit.hazards.join('; ') || 'None reported among assessed critical checks.'}
        </p>
        <p>
          Reported failures: {audit.failures.join('; ') || 'None reported.'} This screening does not determine compliance with Rajive Raturi or court orders.
        </p>
      </section>

      {/* Section 89 penalty guidance */}
      <section>
        <h2>Section 89 penalty guidance</h2>
        <label>
          Contravention history
          <select value={offence} onChange={e => setOffence(e.target.value)}>
            <option value="unknown">Unknown</option>
            <option value="first">First</option>
            <option value="subsequent">Subsequent</option>
          </select>
        </label>
        <p>
          {estimatePenalty(offence)} Section 90 concerns offences by companies. Liability and enforcement depend on facts and competent authorities.
        </p>
      </section>

      {/* Commissioner petition */}
      <section>
        <h2>Commissioner petition</h2>
        <label>
          Authority
          <select value={authority} onChange={e => setAuthority(e.target.value)}>
            <option value="state">State Commissioner</option>
            <option value="chief">Chief Commissioner</option>
          </select>
        </label>
        <label>
          Facility name
          <input value={facility} onChange={e => setFacility(e.target.value)} />
        </label>
        <label>
          District and state
          <input value={district} onChange={e => setDistrict(e.target.value)} />
        </label>
        <label>
          Facts and dates
          <textarea rows="4" value={facts} onChange={e => setFacts(e.target.value)} />
        </label>
        <pre>{petition}</pre>
        <button type="button" onClick={() => download('accessibility-petition.txt', petition, 'text/plain')}>
          Download petition
        </button>
        <p>
          Review and add contact information before filing; this tool does not submit petitions. Petition text is not stored in the vault.
        </p>
      </section>

      {/* Local audit vault */}
      <section>
        <h2>Local audit vault</h2>
        <p>
          Only structured checklist and measurement selections are stored; names, contact details, and private coordinates are excluded. Storage is unencrypted; the hash detects changes but does not establish authenticity.
        </p>
        <button type="button" onClick={save}>
          Save structured audit
        </button>{' '}
        <span role="status">{status}</span>
        {records.map(r => (
          <article key={r.id}>
            <h3>Audit {r.facilityName ? `${r.facilityName} • ` : ''}{r.createdAt}</h3>
            <pre>{JSON.stringify(r, null, 2)}</pre>
            <button type="button" onClick={() => handleLoadRecord(r)}>
              Load into Workspace
            </button>{' '}
            <button type="button" onClick={() => verify(r)}>
              Verify seal
            </button>{' '}
            <button
              type="button"
              onClick={() => download('accessibility-audit.json', JSON.stringify(r, null, 2), 'application/json')}
            >
              Export JSON
            </button>{' '}
            <button
              type="button"
              onClick={() => download('accessibility-audit.txt', `Accessibility audit\n${JSON.stringify(r, null, 2)}`, 'text/plain')}
            >
              Export text
            </button>{' '}
            <button type="button" onClick={() => remove(r.id)}>
              Delete
            </button>
          </article>
        ))}
      </section>

      {/* Printable Report Modal */}
      <PrintableAccessibilityReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        auditRecord={currentAuditRecord}
        evaluatedAudit={measuredEvaluation}
        remediationPlan={remediationPlan}
      />
    </main>
  );
}
