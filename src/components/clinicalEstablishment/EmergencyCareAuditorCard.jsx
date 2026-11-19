import { useState, useMemo } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  HeartPulse,
} from 'lucide-react';
import { evaluateEmergencyCareCompliance } from '../../services/clinicalEstablishmentService.js';

export default function EmergencyCareAuditorCard({ onComplianceChange }) {
  const [hospitalName, setHospitalName] = useState('Metro Superspecialty Hospital');
  const [emergencyType, setEmergencyType] = useState('Acute Myocardial Infarction / Cardiac Arrest');
  const [advanceDemandedInr, setAdvanceDemandedInr] = useState(100000);
  const [refusedTriageOrStabilization, setRefusedTriageOrStabilization] = useState(false);
  const [conditionalOnAdvanceDeposit, setConditionalOnAdvanceDeposit] = useState(true);
  const [detainedPatientOrMortalRemains, setDetainedPatientOrMortalRemains] = useState(false);
  const [withheldMedicalRecords, setWithheldMedicalRecords] = useState(true);
  const [deniedExternalPharmacy, setDeniedExternalPharmacy] = useState(false);

  const compliance = useMemo(() => {
    return evaluateEmergencyCareCompliance({
      hospitalName,
      emergencyType,
      advanceDemandedInr,
      refusedTriageOrStabilization,
      conditionalOnAdvanceDeposit,
      detainedPatientOrMortalRemains,
      withheldMedicalRecords,
      deniedExternalPharmacy,
    });
  }, [
    hospitalName,
    emergencyType,
    advanceDemandedInr,
    refusedTriageOrStabilization,
    conditionalOnAdvanceDeposit,
    detainedPatientOrMortalRemains,
    withheldMedicalRecords,
    deniedExternalPharmacy,
  ]);

  useMemo(() => {
    if (onComplianceChange) {
      onComplianceChange(compliance);
    }
  }, [compliance, onComplianceChange]);

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
        <div
          style={{
            padding: '0.6rem',
            background: 'rgba(239, 68, 68, 0.15)',
            borderRadius: '0.75rem',
            color: '#ef4444',
          }}
        >
          <HeartPulse size={22} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Emergency Care Non-Refusal &amp; Stabilization Auditor
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Evaluates statutory compliance under Section 56 of CEA 2010 and Supreme Court Parmanand Katara precedent
          </p>
        </div>
      </div>

      {/* Supreme Court Mandate Alert */}
      <div
        style={{
          background: 'rgba(239, 68, 68, 0.08)',
          borderLeft: '4px solid #ef4444',
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <ShieldAlert size={18} color="#ef4444" />
          <strong style={{ fontSize: '0.95rem', color: '#ef4444' }}>
            CONSTITUTIONAL MANDATE: IMMEDIATE STABILIZATION WITHOUT FINANCIAL CLEARANCE
          </strong>
        </div>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          Under Section 56 of the Clinical Establishments Act, 2010 and the landmark Supreme Court ruling in <em>Pt. Parmanand Katara v. Union of India</em>,
          every hospital (government or private) <strong>is duty-bound to extend immediate emergency medical care and stabilization</strong>.
          Conditioning emergency treatment on advance financial deposits or police formalities is a punishable criminal offense and grounds for cancellation of hospital registration under Section 41.
        </p>
      </div>

      {/* Inputs: Hospital Name, Emergency Type, Advance Deposit Demanded */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Clinical Establishment / Hospital Name
          </label>
          <input
            type="text"
            value={hospitalName}
            onChange={(e) => setHospitalName(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light, #334155)',
              background: 'var(--bg-input, #0f172a)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Emergency Condition / Diagnosis
          </label>
          <input
            type="text"
            value={emergencyType}
            onChange={(e) => setEmergencyType(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light, #334155)',
              background: 'var(--bg-input, #0f172a)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Advance Deposit Demanded Prior to Care (₹)
          </label>
          <input
            type="number"
            min="0"
            step="5000"
            value={advanceDemandedInr}
            onChange={(e) => setAdvanceDemandedInr(Math.max(0, Number(e.target.value) || 0))}
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light, #334155)',
              background: 'var(--bg-input, #0f172a)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {/* Statutory Violation Checkboxes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            background: 'var(--bg-card-secondary, #0f172a)',
            border: '1px solid var(--border-light, #334155)',
            cursor: 'pointer',
            fontSize: '0.82rem',
          }}
        >
          <input
            type="checkbox"
            checked={refusedTriageOrStabilization}
            onChange={(e) => setRefusedTriageOrStabilization(e.target.checked)}
          />
          <span>Hospital refused triage / initial emergency examination</span>
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            background: 'var(--bg-card-secondary, #0f172a)',
            border: '1px solid var(--border-light, #334155)',
            cursor: 'pointer',
            fontSize: '0.82rem',
          }}
        >
          <input
            type="checkbox"
            checked={conditionalOnAdvanceDeposit}
            onChange={(e) => setConditionalOnAdvanceDeposit(e.target.checked)}
          />
          <span>ICU admission / treatment conditioned on upfront cash deposit</span>
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            background: 'var(--bg-card-secondary, #0f172a)',
            border: '1px solid var(--border-light, #334155)',
            cursor: 'pointer',
            fontSize: '0.82rem',
          }}
        >
          <input
            type="checkbox"
            checked={detainedPatientOrMortalRemains}
            onChange={(e) => setDetainedPatientOrMortalRemains(e.target.checked)}
          />
          <span>Patient detained or deceased body withheld over billing dues</span>
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            background: 'var(--bg-card-secondary, #0f172a)',
            border: '1px solid var(--border-light, #334155)',
            cursor: 'pointer',
            fontSize: '0.82rem',
          }}
        >
          <input
            type="checkbox"
            checked={withheldMedicalRecords}
            onChange={(e) => setWithheldMedicalRecords(e.target.checked)}
          />
          <span>Hospital refused copies of ICU case sheets / doctor notes</span>
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            background: 'var(--bg-card-secondary, #0f172a)',
            border: '1px solid var(--border-light, #334155)',
            cursor: 'pointer',
            fontSize: '0.82rem',
          }}
        >
          <input
            type="checkbox"
            checked={deniedExternalPharmacy}
            onChange={(e) => setDeniedExternalPharmacy(e.target.checked)}
          />
          <span>Forced to purchase medicines exclusively from in-house pharmacy</span>
        </label>
      </div>

      {/* Compliance Severity Bar */}
      <div
        style={{
          background: 'var(--bg-card-secondary, #0f172a)',
          border: '1px solid var(--border-light, #334155)',
          borderRadius: '0.75rem',
          padding: '1.25rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} color={compliance.isCompliant ? '#22c55e' : '#ef4444'} />
            <strong style={{ fontSize: '0.95rem' }}>
              Statutory Infraction Severity Score: {compliance.severityScore} / 100
            </strong>
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.2rem 0.6rem',
              borderRadius: '999px',
              background: compliance.isCompliant ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: compliance.isCompliant ? '#22c55e' : '#ef4444',
            }}
          >
            {compliance.statutoryStatus}
          </span>
        </div>

        <div
          style={{
            width: '100%',
            height: '10px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '999px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${compliance.severityScore}%`,
              height: '100%',
              background: compliance.isCompliant ? '#22c55e' : '#ef4444',
              borderRadius: '999px',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>

      {/* Violations List */}
      <div>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {compliance.isCompliant ? <CheckCircle2 size={18} color="#22c55e" /> : <AlertTriangle size={18} color="#ef4444" />}
          Actionable Infractions ({compliance.violations.length} Breaches)
        </h3>

        {compliance.violations.length === 0 ? (
          <div
            style={{
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              fontSize: '0.85rem',
              color: '#22c55e',
            }}
          >
            No emergency triage refusal or illegal patient detainment recorded for this clinical establishment.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {compliance.violations.map((v, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                  <XCircle size={15} color="#ef4444" />
                  <strong style={{ fontSize: '0.85rem', color: '#ef4444' }}>{v.rule}</strong>
                </div>
                <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                  {v.violation}
                </p>
                <small style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  Statutory Consequence: {v.legalImpact}
                </small>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
