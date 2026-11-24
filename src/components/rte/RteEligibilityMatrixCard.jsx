import { useState, useMemo } from 'react';
import {
  GraduationCap,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import {
  STATE_EWS_THRESHOLDS,
  RTE_CATEGORIES,
  evaluateRteEligibility,
} from '../../services/rteAdmissionService.js';

export default function RteEligibilityMatrixCard({ onEligibilityChange }) {
  const [stateKey, setStateKey] = useState('DELHI');
  const [categoryKey, setCategoryKey] = useState('EWS');
  const [annualIncomeInr, setAnnualIncomeInr] = useState(85000);
  const [distanceKm, setDistanceKm] = useState(0.8);
  const [childAgeYears, setChildAgeYears] = useState(6);
  const [targetGrade, setTargetGrade] = useState('class_1');
  const [documents, setDocuments] = useState({
    proofOfResidence: true,
    proofOfAge: true,
    incomeCertificate: true,
    categoryCertificate: false,
  });

  const handleDocToggle = (key) => {
    setDocuments((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const eligibility = useMemo(() => {
    return evaluateRteEligibility({
      stateKey,
      categoryKey,
      annualIncomeInr: Number(annualIncomeInr) || 0,
      distanceKm: Number(distanceKm) || 0,
      childAgeYears: Number(childAgeYears) || 6,
      targetGrade,
      documents,
    });
  }, [stateKey, categoryKey, annualIncomeInr, distanceKm, childAgeYears, targetGrade, documents]);

  useMemo(() => {
    if (onEligibilityChange) {
      onEligibilityChange(eligibility);
    }
  }, [eligibility, onEligibilityChange]);

  const categoryRequiresIncome = RTE_CATEGORIES[categoryKey]?.requiresIncomeProof;

  return (
    <div
      style={{
        background: 'var(--bg-card, #1e293b)',
        borderRadius: '1rem',
        padding: '1.5rem',
        border: '1px solid var(--border-light, #334155)',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <GraduationCap style={{ width: 28, height: 28, color: '#38bdf8' }} />
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
            Section 12(1)(c) EWS / DG Quota Eligibility &amp; Catchment Matrix
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Statutory 25% free admission quota evaluation under Right to Education Act, 2009
          </span>
        </div>
      </div>

      {/* Grid Inputs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            State / Jurisdiction
          </label>
          <select
            value={stateKey}
            onChange={(e) => setStateKey(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          >
            {Object.entries(STATE_EWS_THRESHOLDS).map(([key, val]) => (
              <option key={key} value={key}>
                {val.state} (Threshold: ₹{val.thresholdInr.toLocaleString('en-IN')})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Statutory Category
          </label>
          <select
            value={categoryKey}
            onChange={(e) => setCategoryKey(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          >
            {Object.entries(RTE_CATEGORIES).map(([key, val]) => (
              <option key={key} value={key}>
                {val.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Annual Family Income (INR)
          </label>
          <input
            type="number"
            min="0"
            step="5000"
            value={annualIncomeInr}
            onChange={(e) => setAnnualIncomeInr(e.target.value)}
            disabled={!categoryRequiresIncome}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: categoryRequiresIncome ? 'var(--bg-dark, #0f172a)' : '#334155',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            {categoryRequiresIncome ? `Max limit: ₹${eligibility.stateThresholdInr.toLocaleString('en-IN')}` : 'No income cap for this category'}
          </span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Residence-to-School Distance (km)
          </label>
          <input
            type="number"
            min="0"
            max="20"
            step="0.1"
            value={distanceKm}
            onChange={(e) => setDistanceKm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
          <span style={{ fontSize: '0.72rem', color: '#38bdf8' }}>
            {eligibility.catchment.label} ({eligibility.catchment.text})
          </span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Target Admission Grade
          </label>
          <select
            value={targetGrade}
            onChange={(e) => setTargetGrade(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          >
            <option value="nursery">Pre-School / Nursery (Age 3-5)</option>
            <option value="lkg">LKG / Lower Kindergarten (Age 4-6)</option>
            <option value="ukg">UKG / Upper Kindergarten (Age 5-7)</option>
            <option value="class_1">Class 1 / Grade 1 (Age 5.5-7.5)</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Child Age (Years)
          </label>
          <input
            type="number"
            min="2.5"
            max="12"
            step="0.5"
            value={childAgeYears}
            onChange={(e) => setChildAgeYears(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
          <span style={{ fontSize: '0.72rem', color: eligibility.isAgeEligible ? '#4ade80' : '#f87171' }}>
            {eligibility.isAgeEligible ? 'Age criteria satisfied' : `Requires ${eligibility.ageRequirementText}`}
          </span>
        </div>
      </div>

      {/* Document Checklist */}
      <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.75rem', border: '1px solid var(--border-light, #334155)' }}>
        <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)', marginBottom: '0.65rem' }}>
          Statutory Verification Document Readiness
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={documents.proofOfResidence}
              onChange={() => handleDocToggle('proofOfResidence')}
            />
            Residence Proof (Aadhaar / Voter ID / Ration Card)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={documents.proofOfAge}
              onChange={() => handleDocToggle('proofOfAge')}
            />
            Age Proof (Hospital / Anganwadi or Sec 14 Affidavit)
          </label>
          {categoryRequiresIncome ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={documents.incomeCertificate}
                onChange={() => handleDocToggle('incomeCertificate')}
              />
              Revenue Officer EWS Income Certificate
            </label>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={documents.categoryCertificate}
                onChange={() => handleDocToggle('categoryCertificate')}
              />
              Statutory Category / Caste / Disability Certificate
            </label>
          )}
        </div>
      </div>

      {/* Outcome Banner */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '1rem',
          borderRadius: '0.75rem',
          background: eligibility.isEligible ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          border: `1px solid ${eligibility.isEligible ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {eligibility.isEligible ? (
            <CheckCircle2 style={{ width: 28, height: 28, color: '#4ade80' }} />
          ) : (
            <XCircle style={{ width: 28, height: 28, color: '#f87171' }} />
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: eligibility.isEligible ? '#4ade80' : '#f87171' }}>
              {eligibility.isEligible ? 'STATUTORILY ELIGIBLE FOR 25% RTE QUOTA' : 'NON-COMPLIANT / INELIGIBLE FOR 25% QUOTA'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
              Catchment: {eligibility.catchment.label} | Income Status: {eligibility.isIncomeEligible ? 'Within Ceiling' : 'Exceeds Ceiling'}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>Statutory Readiness Score</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: eligibility.statutoryScore >= 75 ? '#4ade80' : '#facc15' }}>
            {eligibility.statutoryScore} / 100
          </div>
        </div>
      </div>

      {eligibility.missingDocs.length > 0 && (
        <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <AlertCircle style={{ width: 18, height: 18, color: '#facc15', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: '0.8rem', color: 'var(--text-primary, #f8fafc)' }}>
            <strong>Pending Documents / Verification Notice:</strong>
            <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.2rem' }}>
              {eligibility.missingDocs.map((doc, idx) => (
                <li key={idx}>{doc}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
