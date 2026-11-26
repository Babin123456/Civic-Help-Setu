import { useState, useMemo } from 'react';
import {
  Volume2,
  Clock,
  Zap,
  Activity,
  Layers,
} from 'lucide-react';
import {
  NOISE_ZONES,
  NOISE_SOURCES,
  evaluateSoundReading,
} from '../../services/noisePollutionService.js';

export default function DecibelLoggerCard({ onEvaluationChange }) {
  const [observedDbA, setObservedDbA] = useState(68);
  const [zoneKey, setZoneKey] = useState('RESIDENTIAL_AREA');
  const [hourOfDay, setHourOfDay] = useState(() => new Date().getHours());
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [sourceType, setSourceType] = useState('LOUDSPEAKER_OR_PA_SYSTEM');
  const [isEnclosedDg, setIsEnclosedDg] = useState(false);

  const evaluation = useMemo(() => {
    return evaluateSoundReading({
      observedDbA,
      zoneKey,
      hourOfDay,
      durationMinutes,
      sourceType,
      isEnclosedDg,
    });
  }, [observedDbA, zoneKey, hourOfDay, durationMinutes, sourceType, isEnclosedDg]);

  useMemo(() => {
    if (onEvaluationChange) {
      onEvaluationChange(evaluation);
    }
  }, [evaluation, onEvaluationChange]);

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
          <Volume2 size={22} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Ambient Noise Pollution Decibel Logger &amp; Compliance Auditor
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Evaluates sound pressure levels against Schedule limits under Noise Pollution Rules, 2000
          </p>
        </div>
      </div>

      {/* Primary Metrics: Observed Level, Permissible Limit, Exceedance */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div
          style={{
            background: 'var(--bg-card-secondary, #0f172a)',
            padding: '1rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light, #334155)',
          }}
        >
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
            Recorded Sound Level (LAeq)
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: evaluation.severityColor }}>
              {evaluation.observedDbA}
            </span>
            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>dB(A)</span>
          </div>
          <small style={{ color: 'var(--text-secondary)' }}>Sound Level Meter Reading</small>
        </div>

        <div
          style={{
            background: 'var(--bg-card-secondary, #0f172a)',
            padding: '1rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light, #334155)',
          }}
        >
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
            Statutory Zone Limit ({evaluation.timePeriodLabel})
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#3b82f6' }}>
              {evaluation.permissibleLimitDbA}
            </span>
            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>dB(A)</span>
          </div>
          <small style={{ color: 'var(--text-secondary)' }}>
            {evaluation.zoneLabel} Standard
          </small>
        </div>

        <div
          style={{
            background: evaluation.isViolation ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
            padding: '1rem',
            borderRadius: '0.75rem',
            border: `1px solid ${evaluation.isViolation ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
          }}
        >
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
            Net Decibel Exceedance (ΔdB)
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span
              style={{
                fontSize: '2rem',
                fontWeight: 800,
                color: evaluation.isViolation ? '#ef4444' : '#22c55e',
              }}
            >
              {evaluation.isViolation ? `+${evaluation.exceedanceDbA}` : '0.0'}
            </span>
            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>dB(A)</span>
          </div>
          <small style={{ color: evaluation.isViolation ? '#ef4444' : '#22c55e', fontWeight: 700 }}>
            {evaluation.severityLabel}
          </small>
        </div>
      </div>

      {/* Physical Acoustic Impact Cards */}
      {evaluation.isViolation && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '0.75rem',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <Zap size={18} color="#f59e0b" />
            <strong style={{ fontSize: '0.92rem', color: '#f59e0b' }}>
              ACOUSTIC ENERGY &amp; PERCEIVED LOUDNESS IMPACT (LOGARITHMIC SCALE)
            </strong>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div style={{ background: 'var(--bg-card, #1e293b)', padding: '0.6rem 0.8rem', borderRadius: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Physical Sound Energy</span>
              <strong style={{ fontSize: '1.1rem', color: '#f59e0b' }}>
                {evaluation.soundEnergyMultiplier}x Multiple
              </strong>
              <small style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>
                Sound energy doubles every +3 dB
              </small>
            </div>

            <div style={{ background: 'var(--bg-card, #1e293b)', padding: '0.6rem 0.8rem', borderRadius: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Human Perceived Loudness</span>
              <strong style={{ fontSize: '1.1rem', color: '#f59e0b' }}>
                ~{evaluation.perceivedLoudnessMultiplier}x Louder
              </strong>
              <small style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>
                Subjective loudness doubles every +10 dB
              </small>
            </div>
          </div>
        </div>
      )}

      {/* Inputs: Decibel Slider, Zone, Time Period, Source Type */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Measured Sound Level: <strong>{observedDbA} dB(A)</strong>
          </label>
          <input
            type="range"
            min="35"
            max="120"
            step="0.5"
            value={observedDbA}
            onChange={(e) => setObservedDbA(parseFloat(e.target.value))}
            style={{ width: '100%', marginBottom: '0.35rem' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            <span>35 dB (Quiet Room)</span>
            <span>75 dB (Loud Traffic)</span>
            <span>120 dB (Siren/Hazard)</span>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Statutory Noise Zone
          </label>
          <select
            value={zoneKey}
            onChange={(e) => setZoneKey(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light, #334155)',
              background: 'var(--bg-input, #0f172a)',
              color: 'var(--text-primary)',
            }}
          >
            {Object.values(NOISE_ZONES).map((z) => (
              <option key={z.id} value={z.id}>
                {z.label} (Day: {z.dayLimitDbA} dB / Night: {z.nightLimitDbA} dB)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Time of Incident (Hour 0 - 23)
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="number"
              min="0"
              max="23"
              value={hourOfDay}
              onChange={(e) => setHourOfDay(Math.min(23, Math.max(0, Number(e.target.value) || 0)))}
              style={{
                width: '80px',
                padding: '0.6rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light, #334155)',
                background: 'var(--bg-input, #0f172a)',
                color: 'var(--text-primary)',
              }}
            />
            <span
              style={{
                fontSize: '0.78rem',
                padding: '0.3rem 0.6rem',
                borderRadius: '0.5rem',
                background: evaluation.isNightTime ? 'rgba(99, 102, 241, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                color: evaluation.isNightTime ? '#818cf8' : '#eab308',
                fontWeight: 600,
              }}
            >
              <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
              {evaluation.isNightTime ? 'Night Curfew (10 PM - 6 AM)' : 'Day Period (6 AM - 10 PM)'}
            </span>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Offending Noise Source
          </label>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
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
      </div>

      {/* DG Set Specific Checkbox */}
      {sourceType === 'DIESEL_GENERATOR_SET' && (
        <div style={{ marginBottom: '1.25rem' }}>
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
              checked={isEnclosedDg}
              onChange={(e) => setIsEnclosedDg(e.target.checked)}
            />
            <span>Generator is fitted with CPCB-compliant acoustic enclosure (min 25 dB(A) insertion loss)</span>
          </label>
        </div>
      )}

      {/* Continuous Duration */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Activity size={18} color="#3b82f6" />
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Continuous Duration:</span>
        <input
          type="number"
          min="1"
          max="720"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(Math.max(1, Number(e.target.value) || 1))}
          style={{
            width: '90px',
            padding: '0.4rem',
            borderRadius: '0.4rem',
            border: '1px solid var(--border-light, #334155)',
            background: 'var(--bg-input, #0f172a)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
          }}
        />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>minutes</span>
      </div>

      {/* 4 Zone Comparison Table */}
      <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-light, #334155)', paddingTop: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
          <Layers size={16} color="var(--text-secondary)" />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            STATUTORY SCHEDULE COMPARISON (NOISE POLLUTION RULES, 2000):
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
          {Object.values(NOISE_ZONES).map((z) => {
            const isCurrent = zoneKey === z.id;
            return (
              <div
                key={z.id}
                style={{
                  fontSize: '0.78rem',
                  padding: '0.5rem',
                  borderRadius: '0.4rem',
                  background: isCurrent ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                  border: isCurrent ? '1px solid #3b82f6' : '1px solid var(--border-light, #334155)',
                }}
              >
                <strong style={{ color: isCurrent ? '#3b82f6' : 'var(--text-primary)', display: 'block' }}>
                  {z.label}
                </strong>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                  Day: {z.dayLimitDbA} dB | Night: {z.nightLimitDbA} dB
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
