import { useState, useMemo } from 'react';
import {
  HeartHandshake,
  ShieldCheck,
  Clock,
  MapPin,
} from 'lucide-react';
import { generateFeederCharter } from '../../services/strayAnimalAbcService.js';

export default function CommunityFeederCharterCard() {
  const [colonyName, setColonyName] = useState('Greenwood Heights RWA');
  const [feedingHours, setFeedingHours] = useState('5:30 AM - 7:00 AM & 10:30 PM - 11:30 PM');
  const [spot1, setSpot1] = useState('Open perimeter corner away from main entry gate');
  const [spot2, setSpot2] = useState('Service lane cul-de-sac behind transformer yard');

  const charter = useMemo(() => {
    return generateFeederCharter({
      colonyName,
      feedingHours,
      spots: [spot1, spot2].filter(Boolean),
    });
  }, [colonyName, feedingHours, spot1, spot2]);

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
          <HeartHandshake size={22} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Community Animal &amp; Street Feeder Regulatory Charter
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Designated feeding spot resolution and RWA anti-harassment protections under Rule 20 of ABC Rules 2023
          </p>
        </div>
      </div>

      {/* RWA Anti-Harassment Safeguard Banner */}
      <div
        style={{
          background: 'rgba(16, 185, 129, 0.1)',
          borderLeft: '4px solid #10b981',
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <ShieldCheck size={18} color="#10b981" />
          <strong style={{ fontSize: '0.95rem', color: '#10b981' }}>
            CONSTITUTIONAL PROTECTION FOR ANIMAL CARETAKERS (ARTICLE 51A(g))
          </strong>
        </div>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          Under Rule 20 of the Animal Birth Control Rules, 2023 and binding Delhi High Court directives, resident welfare associations
          or managing committees <strong>have no authority to ban feeding, levy illegal fines, or harass animal feeders</strong>.
          Compassion towards living creatures is a fundamental civic duty enshrined under Article 51A(g) of the Constitution of India.
        </p>
      </div>

      {/* Form Inputs: Society, Feeding Hours, Demarcated Spots */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Society / Colony Name
          </label>
          <input
            type="text"
            value={colonyName}
            onChange={(e) => setColonyName(e.target.value)}
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
            Agreed Low-Pedestrian Feeding Hours
          </label>
          <input
            type="text"
            value={feedingHours}
            onChange={(e) => setFeedingHours(e.target.value)}
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

      {/* Designated Spots Configuration */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          Designated Non-Confrontational Feeding Spots (Rule 20 Requirements)
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
              <MapPin size={15} color="#3b82f6" />
              <small style={{ fontWeight: 600 }}>Spot 1 (Boundary Perimeter):</small>
            </div>
            <input
              type="text"
              value={spot1}
              onChange={(e) => setSpot1(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light, #334155)',
                background: 'var(--bg-input, #0f172a)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
              <MapPin size={15} color="#3b82f6" />
              <small style={{ fontWeight: 600 }}>Spot 2 (Peripheral Service Lane):</small>
            </div>
            <input
              type="text"
              value={spot2}
              onChange={(e) => setSpot2(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light, #334155)',
                background: 'var(--bg-input, #0f172a)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            />
          </div>
        </div>
      </div>

      {/* Two Column Rights vs Responsibilities Charter */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        <div
          style={{
            background: 'var(--bg-card-secondary, #0f172a)',
            border: '1px solid var(--border-light, #334155)',
            borderRadius: '0.75rem',
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
            <ShieldCheck size={18} color="#10b981" />
            <strong style={{ fontSize: '0.9rem', color: '#10b981' }}>Caretaker Rights (Rule 20 Protected)</strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {charter.caretakerRights.map((right, idx) => (
              <li key={idx} style={{ marginBottom: '0.4rem' }}>{right}</li>
            ))}
          </ul>
        </div>

        <div
          style={{
            background: 'var(--bg-card-secondary, #0f172a)',
            border: '1px solid var(--border-light, #334155)',
            borderRadius: '0.75rem',
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
            <Clock size={18} color="#3b82f6" />
            <strong style={{ fontSize: '0.9rem', color: '#3b82f6' }}>Civic Responsibilities &amp; Cleanliness</strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {charter.caretakerResponsibilities.map((resp, idx) => (
              <li key={idx} style={{ marginBottom: '0.4rem' }}>{resp}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
