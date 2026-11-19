import { useState } from 'react';
import {
  VolumeX,
  MapPin,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function SilenceZoneBoundaryChecker() {
  const [institutionName, setInstitutionName] = useState('St. Martha Super Specialty Hospital & ICU');
  const [institutionType, setInstitutionType] = useState('HOSPITAL');
  const [distanceMeters, setDistanceMeters] = useState(45);
  const [hasHonkingBannedSign, setHasHonkingBannedSign] = useState(true);
  const [hasSoundLimiterInstalled, setHasSoundLimiterInstalled] = useState(false);

  const isWithinSilenceZone = distanceMeters <= 100;

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
            background: 'rgba(16, 185, 129, 0.15)',
            borderRadius: '0.75rem',
            color: '#10b981',
          }}
        >
          <VolumeX size={22} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Statutory Silence Zone (100m Perimeter) Compliance Checker
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Special legal protections around hospitals, educational institutions, and courts under Rule 3(2)
          </p>
        </div>
      </div>

      {/* 100m Perimeter Rule Banner */}
      <div
        style={{
          background: 'rgba(16, 185, 129, 0.08)',
          borderLeft: '4px solid #10b981',
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <MapPin size={18} color="#10b981" />
          <strong style={{ fontSize: '0.95rem', color: '#10b981' }}>
            100-METER SILENCE ZONE PERIMETER (RULE 3(2) &amp; SCHEDULE D)
          </strong>
        </div>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          An area comprising not less than <strong>100 meters around hospitals, educational institutions, and courts</strong> is declared as a Silence Zone.
          Statutory standards are <strong>50 dB(A) Day / 40 dB(A) Night</strong>. Vehicular honking, firecrackers, and unpermitted loudspeakers
          are strictly prohibited 24 hours a day within this perimeter.
        </p>
      </div>

      {/* Form Inputs: Institution Name, Type, Distance */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Protected Sensitive Facility Name
          </label>
          <input
            type="text"
            value={institutionName}
            onChange={(e) => setInstitutionName(e.target.value)}
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
            Facility Category
          </label>
          <select
            value={institutionType}
            onChange={(e) => setInstitutionType(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light, #334155)',
              background: 'var(--bg-input, #0f172a)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="HOSPITAL">Hospital / Nursing Home / ICU</option>
            <option value="SCHOOL">School / College / University</option>
            <option value="COURT">District Court / High Court Complex</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Distance to Offending Noise Source: <strong>{distanceMeters} meters</strong>
          </label>
          <input
            type="range"
            min="5"
            max="300"
            step="5"
            value={distanceMeters}
            onChange={(e) => setDistanceMeters(Number(e.target.value))}
            style={{ width: '100%', marginBottom: '0.35rem' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            <span>5m (Immediate Boundary)</span>
            <span style={{ color: '#10b981', fontWeight: 700 }}>100m (Silence Limit)</span>
            <span>300m (External)</span>
          </div>
        </div>
      </div>

      {/* Boundary Status Banner */}
      <div
        style={{
          background: isWithinSilenceZone ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
          border: `1px solid ${isWithinSilenceZone ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
          borderRadius: '0.75rem',
          padding: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          {isWithinSilenceZone ? <AlertCircle size={18} color="#ef4444" /> : <CheckCircle2 size={18} color="#22c55e" />}
          <strong style={{ fontSize: '0.95rem', color: isWithinSilenceZone ? '#ef4444' : '#22c55e' }}>
            {isWithinSilenceZone
              ? `WITHIN 100M SILENCE ZONE (${distanceMeters}m from ${institutionName})`
              : `BEYOND 100M SILENCE ZONE BOUNDARY (${distanceMeters}m)`}
          </strong>
        </div>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {isWithinSilenceZone
            ? 'The offending noise source is operating inside the statutory 100m silence zone perimeter. Permissible standards are strictly lowered to 50 dB(A) Day and 40 dB(A) Night. Horns and loudspeakers are actionable with immediate police intervention.'
            : 'The noise source is outside the 100m silence zone boundary. Ambient standards for the underlying residential or commercial zone apply.'}
        </p>
      </div>

      {/* Sensitive Receptor Safeguards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
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
            checked={hasHonkingBannedSign}
            onChange={(e) => setHasHonkingBannedSign(e.target.checked)}
          />
          <span>&quot;Silence Zone - No Honking&quot; Municipal Signboard Installed</span>
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
            checked={hasSoundLimiterInstalled}
            onChange={(e) => setHasSoundLimiterInstalled(e.target.checked)}
          />
          <span>Sound Limiter Mandate Enforced on Nearby Commercial Venues</span>
        </label>
      </div>
    </div>
  );
}
