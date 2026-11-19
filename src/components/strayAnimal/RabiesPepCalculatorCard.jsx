import { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Calendar,
  Syringe,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  RABIES_EXPOSURE_CATEGORIES,
  ARV_REGIMENS,
  RIG_TYPES,
  calculateVaccinationSchedule,
  calculateRigDosage,
} from '../../services/strayAnimalAbcService.js';

export default function RabiesPepCalculatorCard({ onCalculationChange }) {
  const [selectedCategory, setSelectedCategory] = useState('CATEGORY_III');
  const [exposureDate, setExposureDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [regimenKey, setRegimenKey] = useState('ESSEN_IM');
  const [weightKg, setWeightKg] = useState(60);
  const [rigType, setRigType] = useState('HRIG');
  const [animalStatus, setAnimalStatus] = useState('STRAY_UNKNOWN');

  const catObj = RABIES_EXPOSURE_CATEGORIES[selectedCategory] || RABIES_EXPOSURE_CATEGORIES.CATEGORY_III;

  const schedule = useMemo(() => {
    try {
      return calculateVaccinationSchedule(exposureDate, regimenKey);
    } catch {
      return [];
    }
  }, [exposureDate, regimenKey]);

  const rigCalculation = useMemo(() => {
    if (!catObj.rigRequired) return null;
    return calculateRigDosage({ weightKg, rigType });
  }, [catObj.rigRequired, weightKg, rigType]);

  // Notify parent of state changes
  useMemo(() => {
    if (onCalculationChange) {
      onCalculationChange({
        selectedCategory,
        exposureDate,
        regimenKey,
        weightKg,
        rigType,
        animalStatus,
        schedule,
        rigCalculation,
      });
    }
  }, [selectedCategory, exposureDate, regimenKey, weightKg, rigType, animalStatus, schedule, rigCalculation, onCalculationChange]);

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
          <ShieldAlert size={22} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Rabies Post-Exposure Prophylaxis (PEP) Protocol Engine
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Clinical exposure categorization and personalized vaccination timeline under WHO &amp; NRCP India Guidelines
          </p>
        </div>
      </div>

      {/* Immediate 15-Minute Wound Washing Alert */}
      <div
        style={{
          background: 'rgba(245, 158, 11, 0.1)',
          borderLeft: '4px solid #f59e0b',
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <Clock size={18} color="#f59e0b" />
          <strong style={{ fontSize: '0.95rem', color: '#f59e0b' }}>
            CRITICAL FIRST-AID RULE: 15-MINUTE SOAP &amp; RUNNING WATER WASH
          </strong>
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Thoroughly wash all bite wounds, scratches, or contact areas with soap and copious running water for at least 15 minutes immediately.
          Apply povidone-iodine antiseptic. <strong>DO NOT suture immediately</strong> and avoid irritating domestic substances (chili, turmeric, kerosene).
        </p>
      </div>

      {/* Exposure Category Selection */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          1. Select Animal Contact Severity (WHO / NRCP Category)
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
          {Object.values(RABIES_EXPOSURE_CATEGORIES).map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  textAlign: 'left',
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid #3b82f6' : '1px solid var(--border-light, #334155)',
                  background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card-secondary, #0f172a)',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <strong style={{ fontSize: '0.95rem', color: isSelected ? '#3b82f6' : 'var(--text-primary)' }}>
                    {cat.label}
                  </strong>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      background: cat.riskLevel === 'High / Critical' ? 'rgba(239, 68, 68, 0.2)' : cat.riskLevel === 'Moderate' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                      color: cat.riskLevel === 'High / Critical' ? '#ef4444' : cat.riskLevel === 'Moderate' ? '#f59e0b' : '#22c55e',
                    }}
                  >
                    {cat.riskLevel}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {cat.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Input Parameters: Exposure Date, Body Weight, Regimen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Bite / Exposure Date
          </label>
          <input
            type="date"
            value={exposureDate}
            onChange={(e) => setExposureDate(e.target.value)}
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
            Vaccine Administration Regimen
          </label>
          <select
            value={regimenKey}
            onChange={(e) => setRegimenKey(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light, #334155)',
              background: 'var(--bg-input, #0f172a)',
              color: 'var(--text-primary)',
            }}
          >
            {Object.values(ARV_REGIMENS).map((reg) => (
              <option key={reg.id} value={reg.id}>
                {reg.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Patient Body Weight (kg)
          </label>
          <input
            type="number"
            min="1"
            max="180"
            value={weightKg}
            onChange={(e) => setWeightKg(Math.max(1, Number(e.target.value) || 1))}
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
            Biting Animal Status
          </label>
          <select
            value={animalStatus}
            onChange={(e) => setAnimalStatus(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light, #334155)',
              background: 'var(--bg-input, #0f172a)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="STRAY_UNKNOWN">Stray / Wild / Untraceable Animal</option>
            <option value="PET_VERIFIED">Pet with Valid Vaccination Record</option>
            <option value="OBSERVABLE_COMMUNITY">Accessible Community Dog (Under 10-day Observation)</option>
          </select>
        </div>
      </div>

      {/* Category III RIG Dosage Card */}
      {catObj.rigRequired && rigCalculation && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Syringe size={20} color="#ef4444" />
              <strong style={{ fontSize: '1rem', color: '#ef4444' }}>
                MANDATORY RABIES IMMUNOGLOBULIN (RIG) DOSAGE (CATEGORY III)
              </strong>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {Object.values(RIG_TYPES).map((rig) => (
                <button
                  key={rig.id}
                  type="button"
                  onClick={() => setRigType(rig.id)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    border: rigType === rig.id ? '2px solid #ef4444' : '1px solid var(--border-light, #334155)',
                    background: rigType === rig.id ? '#ef4444' : 'transparent',
                    color: rigType === rig.id ? '#ffffff' : 'var(--text-secondary)',
                  }}
                >
                  {rig.id} ({rig.dosePerKgIu} IU/kg)
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '0.75rem' }}>
            <div style={{ background: 'var(--bg-card, #1e293b)', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <small style={{ color: 'var(--text-secondary)', display: 'block' }}>Total Units Required</small>
              <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                {rigCalculation.totalIuRequired.toLocaleString()} IU
              </strong>
            </div>

            <div style={{ background: 'var(--bg-card, #1e293b)', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <small style={{ color: 'var(--text-secondary)', display: 'block' }}>Calculated Volume</small>
              <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                ~{rigCalculation.volumeMlRequired} mL
              </strong>
            </div>

            <div style={{ background: 'var(--bg-card, #1e293b)', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <small style={{ color: 'var(--text-secondary)', display: 'block' }}>Potency Formulation</small>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                {rigCalculation.potencyIuPerMl} IU / mL
              </strong>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            <strong>Local Infiltration Instruction:</strong> {rigCalculation.clinicalInfiltrationRule}
          </p>
        </div>
      )}

      {/* Vaccination Schedule Timeline */}
      {catObj.pepRequired ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Calendar size={18} color="#3b82f6" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
              Calculated Anti-Rabies Vaccination (ARV) Calendar
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
            {schedule.map((dose, idx) => (
              <div
                key={dose.dayOffset}
                style={{
                  background: 'var(--bg-card-secondary, #0f172a)',
                  border: '1px solid var(--border-light, #334155)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6' }}>
                    DOSE {idx + 1}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    Day {dose.dayOffset}
                  </span>
                </div>
                <strong style={{ fontSize: '0.95rem', display: 'block', marginBottom: '0.25rem' }}>
                  {dose.displayDate}
                </strong>
                <small style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {dose.route} ({dose.anatomicalSite})
                </small>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '0.5rem',
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={18} color="#22c55e" />
            <strong style={{ color: '#22c55e', fontSize: '0.95rem' }}>
              No Active Vaccination or RIG Required for Category I
            </strong>
          </div>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Licking on intact skin or touching an animal does not transmit the rabies virus. Thoroughly wash the contacted skin surfaces with soap and water.
          </p>
        </div>
      )}

      {/* 10-Day Observation Note */}
      <div
        style={{
          marginTop: '1.25rem',
          padding: '0.75rem',
          borderRadius: '0.5rem',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-light, #334155)',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'flex-start',
        }}
      >
        <AlertTriangle size={16} color="#3b82f6" style={{ marginTop: '0.2rem', flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          <strong>10-Day Observation Rule:</strong> If the dog/cat is known and can be placed under confinement and observed for 10 days, do NOT delay starting PEP. Start Day 0 and Day 3 immediately. If the animal remains completely healthy after 10 full days, consult your physician on stopping remaining doses.
        </p>
      </div>
    </div>
  );
}
