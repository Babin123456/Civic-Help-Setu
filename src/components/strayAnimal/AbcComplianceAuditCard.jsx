import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Scale,
  Activity,
  PawPrint,
} from 'lucide-react';
import {
  ABC_WARD_CHECKPOINTS,
  evaluateWardAbcCompliance,
} from '../../services/strayAnimalAbcService.js';

export default function AbcComplianceAuditCard() {
  const [wardNumber, setWardNumber] = useState('Ward 42 (Indiranagar)');
  const [estimatedDogCount, setEstimatedDogCount] = useState(120);
  const [sterilizedDogCount, setSterilizedDogCount] = useState(55);
  const [monitoringCommitteeExists, setMonitoringCommitteeExists] = useState(false);
  const [relocationComplaints, setRelocationComplaints] = useState(true);
  const [designatedFeedingSpotsSetup, setDesignatedFeedingSpotsSetup] = useState(false);

  const auditResult = useMemo(() => {
    return evaluateWardAbcCompliance({
      wardNumber,
      estimatedDogCount,
      sterilizedDogCount,
      monitoringCommitteeExists,
      relocationComplaints,
      designatedFeedingSpotsSetup,
    });
  }, [
    wardNumber,
    estimatedDogCount,
    sterilizedDogCount,
    monitoringCommitteeExists,
    relocationComplaints,
    designatedFeedingSpotsSetup,
  ]);

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
            background: 'rgba(59, 130, 246, 0.15)',
            borderRadius: '0.75rem',
            color: '#3b82f6',
          }}
        >
          <PawPrint size={22} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Animal Birth Control (ABC) Rules, 2023 Ward Auditor
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Statutory municipal sterilization coverage, ear-notching verification, and anti-relocation enforcement
          </p>
        </div>
      </div>

      {/* Prominent Anti-Relocation Prohibitory Injunction Warning */}
      <div
        style={{
          background: 'rgba(239, 68, 68, 0.1)',
          borderLeft: '4px solid #ef4444',
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <Scale size={18} color="#ef4444" />
          <strong style={{ fontSize: '0.95rem', color: '#ef4444' }}>
            STATUTORY INJUNCTION: ILLEGAL DOG RELOCATION IS A PENAL OFFENSE
          </strong>
        </div>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          Under Rule 11(16) of the Animal Birth Control Rules, 2023 and landmark Supreme Court mandates (<em>AWBI v. A. Nagaraja</em>),
          street dogs <strong>must be released back into the exact same locality</strong> from which they were captured. Relocating dogs to highways,
          forests, or other colonies causes fatal territorial vacuums, increases dog bite aggression, and invites criminal prosecution under
          Section 11 of the Prevention of Cruelty to Animals Act, 1960.
        </p>
      </div>

      {/* Inputs: Ward, Population, Sterilization Counts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Ward / Colony Name
          </label>
          <input
            type="text"
            value={wardNumber}
            onChange={(e) => setWardNumber(e.target.value)}
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
            Estimated Free-Roaming Dog Count
          </label>
          <input
            type="number"
            min="1"
            value={estimatedDogCount}
            onChange={(e) => setEstimatedDogCount(Math.max(1, Number(e.target.value) || 1))}
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
            Dogs with Visible Right Ear &quot;V-Notch&quot;
          </label>
          <input
            type="number"
            min="0"
            max={estimatedDogCount}
            value={sterilizedDogCount}
            onChange={(e) => setSterilizedDogCount(Math.min(estimatedDogCount, Math.max(0, Number(e.target.value) || 0)))}
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

      {/* Compliance Checkboxes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            background: 'var(--bg-card-secondary, #0f172a)',
            border: '1px solid var(--border-light, #334155)',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          <input
            type="checkbox"
            checked={monitoringCommitteeExists}
            onChange={(e) => setMonitoringCommitteeExists(e.target.checked)}
          />
          <span>Ward ABC Monitoring Committee Constituted (Rule 11)</span>
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            background: 'var(--bg-card-secondary, #0f172a)',
            border: '1px solid var(--border-light, #334155)',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          <input
            type="checkbox"
            checked={relocationComplaints}
            onChange={(e) => setRelocationComplaints(e.target.checked)}
          />
          <span>Illegal Relocation Attempts / Threats Reported</span>
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            background: 'var(--bg-card-secondary, #0f172a)',
            border: '1px solid var(--border-light, #334155)',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          <input
            type="checkbox"
            checked={designatedFeedingSpotsSetup}
            onChange={(e) => setDesignatedFeedingSpotsSetup(e.target.checked)}
          />
          <span>Designated Feeding Spots Set Up (Rule 20)</span>
        </label>
      </div>

      {/* Sterilization Coverage Progress Meter */}
      <div
        style={{
          background: 'var(--bg-card-secondary, #0f172a)',
          border: '1px solid var(--border-light, #334155)',
          borderRadius: '0.75rem',
          padding: '1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} color={auditResult.meetsHerdImmunityThreshold ? '#22c55e' : '#f59e0b'} />
            <strong style={{ fontSize: '0.95rem' }}>
              Ward Sterilization Coverage: {auditResult.sterilizationRatioPercent}%
            </strong>
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.2rem 0.6rem',
              borderRadius: '999px',
              background: auditResult.meetsHerdImmunityThreshold ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: auditResult.meetsHerdImmunityThreshold ? '#22c55e' : '#ef4444',
            }}
          >
            {auditResult.meetsHerdImmunityThreshold ? 'Herd Immunity Achieved (>= 70%)' : 'Deficient Coverage (< 70%)'}
          </span>
        </div>

        <div
          style={{
            width: '100%',
            height: '10px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '999px',
            overflow: 'hidden',
            marginBottom: '0.5rem',
          }}
        >
          <div
            style={{
              width: `${Math.min(100, auditResult.sterilizationRatioPercent)}%`,
              height: '100%',
              background: auditResult.meetsHerdImmunityThreshold ? '#22c55e' : '#ef4444',
              borderRadius: '999px',
              transition: 'width 0.4s ease',
            }}
          />
        </div>

        <small style={{ color: 'var(--text-secondary)', display: 'block' }}>
          Target: Minimum 70% of free-roaming dogs must be sterilized and anti-rabies vaccinated to halt population growth and eliminate human rabies transmission per WHO benchmarks.
        </small>
      </div>

      {/* Non-Compliance Action List */}
      <div>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {auditResult.isCompliant ? <CheckCircle2 size={18} color="#22c55e" /> : <AlertTriangle size={18} color="#ef4444" />}
          Statutory Compliance Findings ({auditResult.nonCompliances.length} Violations Detected)
        </h3>

        {auditResult.nonCompliances.length === 0 ? (
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
            Ward satisfies all Animal Birth Control (ABC) Rules 2023 statutory benchmarks.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {auditResult.nonCompliances.map((nc) => (
              <div
                key={nc.rule}
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                  <XCircle size={15} color="#ef4444" />
                  <strong style={{ fontSize: '0.85rem', color: '#ef4444' }}>{nc.rule}</strong>
                </div>
                <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                  {nc.issue}
                </p>
                <small style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  Mandatory Action: {nc.mandatoryAction}
                </small>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 7 ABC Checkpoints Summary */}
      <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-light, #334155)', paddingTop: '1rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
          ABC RULES 2023 MANDATORY SURGICAL &amp; TERRITORIAL SAFEGUARDS:
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
          {ABC_WARD_CHECKPOINTS.map((cp) => (
            <div
              key={cp.id}
              style={{
                fontSize: '0.78rem',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-light, #334155)',
                borderRadius: '0.35rem',
                padding: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
                <CheckCircle2 size={13} color="#3b82f6" />
                <strong style={{ color: 'var(--text-primary)' }}>{cp.title}</strong>
              </div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>{cp.ruleCitation}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
