import { useState } from 'react';
import {
  Moon,
  AlertTriangle,
  Scale,
  ShieldAlert,
  Gavel,
} from 'lucide-react';
import { NOISE_SOURCES } from '../../services/noisePollutionService.js';

export default function NoiseCurfewAuditorCard() {
  const [selectedSource, setSelectedSource] = useState('LOUDSPEAKER_OR_PA_SYSTEM');
  const [hasDmWrittenPermit, setHasDmWrittenPermit] = useState(false);
  const [isAcousticEnclosed, setIsAcousticEnclosed] = useState(false);
  const [dgCapacityKva, setDgCapacityKva] = useState(125);
  const [isAfterTenPm, setIsAfterTenPm] = useState(true);

  const source = NOISE_SOURCES[selectedSource] || NOISE_SOURCES.LOUDSPEAKER_OR_PA_SYSTEM;

  // Curfew violation logic
  const isCurfewBreach = isAfterTenPm && source.nightCurfewMandatory && !hasDmWrittenPermit;

  // DG set fine calculation: ₹10k for < 100 kVA, ₹25k for 100-500 kVA, ₹1,00,000 for > 500 kVA
  let calculatedFine = source.compoundingPenaltyInr;
  if (selectedSource === 'DIESEL_GENERATOR_SET') {
    if (dgCapacityKva > 500) {
      calculatedFine = 100000;
    } else if (dgCapacityKva > 100) {
      calculatedFine = 25000;
    } else {
      calculatedFine = 10000;
    }
  }

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
            background: 'rgba(99, 102, 241, 0.15)',
            borderRadius: '0.75rem',
            color: '#818cf8',
          }}
        >
          <Moon size={22} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Rule 5 Night-Time Curfew &amp; Equipment Auditor
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Statutory 10:00 PM – 6:00 AM curfew enforcement and CPCB equipment seizure liability
          </p>
        </div>
      </div>

      {/* Statutory Curfew Banner */}
      <div
        style={{
          background: 'rgba(99, 102, 241, 0.1)',
          borderLeft: '4px solid #818cf8',
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <Scale size={18} color="#818cf8" />
          <strong style={{ fontSize: '0.95rem', color: '#818cf8' }}>
            RULE 5(1) NOISE RULES, 2000: STATUTORY NIGHT NOISE PROHIBITION
          </strong>
        </div>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          No loudspeaker, public address system, or nocturnal construction machinery shall be used at night (between 10:00 PM and 6:00 AM)
          except in closed premises (such as auditoriums or conference rooms). State Governments may grant exemptions for cultural/religious
          festivals not exceeding 15 days in a calendar year, restricted to midnight (12:00 AM) only.
        </p>
      </div>

      {/* Equipment Selector & Parameters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Equipment / Noise Type
          </label>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light, #334155)',
              background: 'var(--bg-input, #0f172a)',
              color: 'var(--text-primary)',
            }}
          >
            {Object.values(NOISE_SOURCES).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Operating Time Period
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setIsAfterTenPm(false)}
              style={{
                flex: 1,
                padding: '0.55rem',
                borderRadius: '0.5rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: !isAfterTenPm ? '2px solid #eab308' : '1px solid var(--border-light, #334155)',
                background: !isAfterTenPm ? 'rgba(234, 179, 8, 0.15)' : 'transparent',
                color: !isAfterTenPm ? '#eab308' : 'var(--text-secondary)',
              }}
            >
              Day (6 AM - 10 PM)
            </button>
            <button
              type="button"
              onClick={() => setIsAfterTenPm(true)}
              style={{
                flex: 1,
                padding: '0.55rem',
                borderRadius: '0.5rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: isAfterTenPm ? '2px solid #818cf8' : '1px solid var(--border-light, #334155)',
                background: isAfterTenPm ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: isAfterTenPm ? '#818cf8' : 'var(--text-secondary)',
              }}
            >
              Night (10 PM - 6 AM)
            </button>
          </div>
        </div>

        {selectedSource === 'DIESEL_GENERATOR_SET' && (
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
              DG Set Rating (kVA)
            </label>
            <input
              type="number"
              min="5"
              max="2000"
              value={dgCapacityKva}
              onChange={(e) => setDgCapacityKva(Math.max(5, Number(e.target.value) || 5))}
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
        )}
      </div>

      {/* Checkboxes: DM Written Permit & Acoustic Enclosure */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
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
            fontSize: '0.85rem',
          }}
        >
          <input
            type="checkbox"
            checked={hasDmWrittenPermit}
            onChange={(e) => setHasDmWrittenPermit(e.target.checked)}
          />
          <span>Possesses Written Exemption from District Magistrate (DM)</span>
        </label>

        {selectedSource === 'DIESEL_GENERATOR_SET' && (
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
              fontSize: '0.85rem',
            }}
          >
            <input
              type="checkbox"
              checked={isAcousticEnclosed}
              onChange={(e) => setIsAcousticEnclosed(e.target.checked)}
            />
            <span>Acoustic Enclosure Installed (min 25 dB(A) insertion loss)</span>
          </label>
        )}
      </div>

      {/* Enforcement & Fine Card */}
      <div
        style={{
          background: isCurfewBreach ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
          border: `1px solid ${isCurfewBreach ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
          borderRadius: '0.75rem',
          padding: '1.25rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isCurfewBreach ? <ShieldAlert size={20} color="#ef4444" /> : <Gavel size={20} color="#22c55e" />}
            <strong style={{ fontSize: '1rem', color: isCurfewBreach ? '#ef4444' : '#22c55e' }}>
              {isCurfewBreach ? 'COGNIZABLE CURFEW INFRACTION (RULE 5 BREACH)' : 'CURFEW COMPLIANT STATUS'}
            </strong>
          </div>
          <span
            style={{
              fontSize: '0.85rem',
              fontWeight: 800,
              padding: '0.2rem 0.6rem',
              borderRadius: '0.5rem',
              background: isCurfewBreach ? '#ef4444' : '#22c55e',
              color: '#ffffff',
            }}
          >
            Estimated Compounding Fine: ₹{calculatedFine.toLocaleString('en-IN')}
          </span>
        </div>

        <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {isCurfewBreach
            ? 'Operating this equipment during the night curfew period without valid DM exemption violates Rule 5(1). The Designated Authority is empowered under Rule 5(2) to immediately seize and confiscate the sound equipment.'
            : 'Operation is within daylight limits or authorized closed-premise parameters. Ensure sound does not exceed 10 dB(A) above background ambient levels at property periphery.'}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
          <AlertTriangle size={15} color={isCurfewBreach ? '#ef4444' : '#22c55e'} />
          <strong>Statutory Enforcement Action:</strong> {source.statutoryRemedy}
        </div>
      </div>
    </div>
  );
}
