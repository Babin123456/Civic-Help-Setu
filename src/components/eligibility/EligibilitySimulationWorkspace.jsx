import { useState, useMemo } from 'react';
import {
  Sliders,
  RotateCcw,
  CheckCircle,
} from 'lucide-react';
import {
  simulateEligibility,
  listRegisteredGraphs,
} from '../../services/eligibilitySimulationService.js';
import ConditionAuditTree from './ConditionAuditTree.jsx';
import CounterfactualPathCard from './CounterfactualPathCard.jsx';
import OfficialGuidanceDisclaimer from './OfficialGuidanceDisclaimer.jsx';

const DEFAULT_SIMULATION_PROFILE = {
  age: 35,
  annualIncome: 280000,
  employment: 'farmer',
  category: 'OBC',
  state: 'Maharashtra',
  ownsAgriculturalLand: true,
  ownsPuccaHouse: false,
  hasBplCard: false,
  hasAadhaar: true,
  hasHospitalBirthSlip: true,
  birthRegistrationDays: 14,
};

export default function EligibilitySimulationWorkspace({ initialProfile = null }) {
  const schemes = useMemo(() => listRegisteredGraphs(), []);
  const [selectedSchemeId, setSelectedSchemeId] = useState(schemes[0]?.id || 'pm-kisan');

  const [profile, setProfile] = useState(() => ({
    ...DEFAULT_SIMULATION_PROFILE,
    ...(initialProfile || {}),
  }));

  // Re-run simulation on state change
  const simulationResult = useMemo(() => {
    return simulateEligibility(selectedSchemeId, profile, { includeCounterfactuals: true });
  }, [selectedSchemeId, profile]);

  const handleFieldChange = (field, value) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleReset = () => {
    setProfile({
      ...DEFAULT_SIMULATION_PROFILE,
      ...(initialProfile || {}),
    });
  };

  const handleApplyCounterfactual = (cf) => {
    if (!cf || !Array.isArray(cf.changes)) return;
    setProfile((prev) => {
      const updated = { ...prev };
      for (const change of cf.changes) {
        updated[change.field] = change.to;
      }
      return updated;
    });
  };

  const selectedSchemeMeta = schemes.find((s) => s.id === selectedSchemeId);

  return (
    <div
      role="region"
      aria-label="Explainable Eligibility Simulation Workspace"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
      }}
    >
      {/* Statutory Guidance Disclaimer Banner */}
      <OfficialGuidanceDisclaimer />

      {/* Top Controls: Scheme Selector */}
      <div
        style={{
          padding: '1.25rem',
          borderRadius: '0.75rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <label
              htmlFor="sim-scheme-selector"
              style={{ display: 'block', fontWeight: '700', fontSize: '0.9rem', marginBottom: '0.25rem' }}
            >
              Select Statutory Scheme / Civic Rule Graph to Simulate
            </label>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {selectedSchemeMeta?.benefitSummary || 'Versioned statutory eligibility rule graph.'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleReset}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light)',
              background: 'var(--glass-bg)',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <RotateCcw size={14} aria-hidden="true" />
            Reset Parameters
          </button>
        </div>

        <select
          id="sim-scheme-selector"
          value={selectedSchemeId}
          onChange={(e) => setSelectedSchemeId(e.target.value)}
          style={{
            padding: '0.6rem 0.8rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-light)',
            background: 'var(--bg-main)',
            color: 'var(--text-primary)',
            fontWeight: '600',
            fontSize: '0.92rem',
          }}
        >
          {schemes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} ({s.category}) — v{s.version}
            </option>
          ))}
        </select>
      </div>

      {/* Main Grid: Interactive What-If Controls (Left) & Real-time Evaluation (Right) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {/* Interactive What-If Parameter Controls */}
        <section
          aria-labelledby="sim-controls-heading"
          style={{
            padding: '1.5rem',
            borderRadius: '0.75rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
            <Sliders size={18} style={{ color: 'var(--accent-main)' }} aria-hidden="true" />
            <h2 id="sim-controls-heading" style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0 }}>
              Hypothetical What-If Inputs
            </h2>
          </div>

          {/* Annual Income Input */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <label htmlFor="sim-input-income" style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                Annual Family Income (₹)
              </label>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--accent-main)' }}>
                ₹{Number(profile.annualIncome || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <input
              id="sim-input-income"
              type="range"
              min="0"
              max="1000000"
              step="10000"
              value={profile.annualIncome ?? 0}
              onChange={(e) => handleFieldChange('annualIncome', Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-main)' }}
            />
          </div>

          {/* Scheme-Specific Inputs: Landholding & Occupation for Agriculture */}
          {selectedSchemeId === 'pm-kisan' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(profile.ownsAgriculturalLand)}
                  onChange={(e) => handleFieldChange('ownsAgriculturalLand', e.target.checked)}
                />
                Owns Cultivable Agricultural Land
              </label>

              <div>
                <label htmlFor="sim-input-employment" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                  Occupation
                </label>
                <select
                  id="sim-input-employment"
                  value={profile.employment || 'farmer'}
                  onChange={(e) => handleFieldChange('employment', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="farmer">Farmer / Agricultural Cultivator</option>
                  <option value="salaried">Salaried Employee</option>
                  <option value="self-employed">Self-Employed / Business</option>
                  <option value="unemployed">Unemployed</option>
                </select>
              </div>
            </div>
          )}

          {/* Scheme-Specific Inputs: PMAY Housing */}
          {selectedSchemeId === 'pmay-u' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(profile.ownsPuccaHouse)}
                  onChange={(e) => handleFieldChange('ownsPuccaHouse', e.target.checked)}
                />
                Family already owns an all-weather Pucca Dwelling
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(profile.hasBplCard)}
                  onChange={(e) => handleFieldChange('hasBplCard', e.target.checked)}
                />
                Possesses Active BPL Ration Card
              </label>
            </div>
          )}

          {/* Scheme-Specific Inputs: Birth Registration */}
          {selectedSchemeId === 'birth-certificate-delayed' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <label htmlFor="sim-input-birth-days" style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                    Days Elapsed Since Birth Event
                  </label>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', color: profile.birthRegistrationDays > 21 ? '#dc2626' : '#16a34a' }}>
                    {profile.birthRegistrationDays} Days
                  </span>
                </div>
                <input
                  id="sim-input-birth-days"
                  type="range"
                  min="1"
                  max="400"
                  value={profile.birthRegistrationDays ?? 1}
                  onChange={(e) => handleFieldChange('birthRegistrationDays', Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-main)' }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(profile.hasHospitalBirthSlip)}
                  onChange={(e) => handleFieldChange('hasHospitalBirthSlip', e.target.checked)}
                />
                Possesses Official Hospital Discharge Slip (Form-1)
              </label>
            </div>
          )}

          {/* General Common Prerequisites */}
          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
            <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>
              Common Identity Prerequisite
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={Boolean(profile.hasAadhaar)}
                onChange={(e) => handleFieldChange('hasAadhaar', e.target.checked)}
              />
              Aadhaar Card Linked & Verified (e-KYC / DBT)
            </label>
          </div>
        </section>

        {/* Real-Time Outcome & Diagnostic Breakdown */}
        <section
          aria-labelledby="sim-outcome-heading"
          style={{
            padding: '1.5rem',
            borderRadius: '0.75rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
            <h2 id="sim-outcome-heading" style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0 }}>
              Simulation Outcome
            </h2>

            {/* Status Badge */}
            <span
              style={{
                fontSize: '0.82rem',
                fontWeight: '800',
                textTransform: 'uppercase',
                padding: '0.3rem 0.8rem',
                borderRadius: '99px',
                color:
                  simulationResult.status === 'ELIGIBLE'
                    ? '#16a34a'
                    : simulationResult.status === 'CONDITIONAL'
                    ? '#2563eb'
                    : simulationResult.status === 'INELIGIBLE'
                    ? '#dc2626'
                    : '#ca8a04',
                background:
                  simulationResult.status === 'ELIGIBLE'
                    ? 'rgba(22, 163, 74, 0.12)'
                    : simulationResult.status === 'CONDITIONAL'
                    ? 'rgba(37, 99, 235, 0.12)'
                    : simulationResult.status === 'INELIGIBLE'
                    ? 'rgba(220, 38, 38, 0.12)'
                    : 'rgba(202, 138, 4, 0.12)',
              }}
            >
              {simulationResult.status}
            </span>
          </div>

          {/* Boundary warnings if any */}
          {simulationResult.boundaryWarnings?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {simulationResult.boundaryWarnings.map((bw) => (
                <div
                  key={bw.id}
                  style={{
                    padding: '0.6rem 0.8rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(234, 179, 8, 0.15)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    color: '#ca8a04',
                    fontSize: '0.82rem',
                    fontWeight: '600',
                  }}
                >
                  ⚠️ <strong>{bw.label}:</strong> {bw.notice}
                </div>
              ))}
            </div>
          )}

          {/* Conflicts if any */}
          {simulationResult.conflicts?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {simulationResult.conflicts.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: '0.6rem 0.8rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(234, 88, 12, 0.15)',
                    border: '1px solid rgba(234, 88, 12, 0.3)',
                    color: '#ea580c',
                    fontSize: '0.82rem',
                    fontWeight: '600',
                  }}
                >
                  ⚡ <strong>{c.label}:</strong> {c.conflict.message}
                </div>
              ))}
            </div>
          )}

          {/* Counterfactual Guidance Section */}
          {simulationResult.counterfactuals?.length > 0 ? (
            <div>
              <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                Actionable What-If Scenarios (Minimal Changes to Qualify)
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {simulationResult.counterfactuals.map((cf) => (
                  <CounterfactualPathCard
                    key={cf.id}
                    counterfactual={cf}
                    onApply={handleApplyCounterfactual}
                  />
                ))}
              </div>
            </div>
          ) : simulationResult.status === 'ELIGIBLE' ? (
            <div
              style={{
                padding: '1rem',
                borderRadius: '0.5rem',
                background: 'rgba(22, 163, 74, 0.08)',
                border: '1px solid rgba(22, 163, 74, 0.25)',
                color: '#16a34a',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <CheckCircle size={18} aria-hidden="true" />
              <span>All statutory criteria are satisfied based on hypothetical inputs!</span>
            </div>
          ) : null}

          {/* Condition Audit Tree */}
          <div>
            <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Detailed Condition Audit Trace
            </span>
            <ConditionAuditTree criteria={simulationResult.criteria} />
          </div>
        </section>
      </div>
    </div>
  );
}
