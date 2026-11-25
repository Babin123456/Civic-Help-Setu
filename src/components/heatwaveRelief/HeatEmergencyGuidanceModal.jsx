import React from 'react';
import {
  X,
  HeartPulse,
  Droplets,
  AlertTriangle,
  Phone,
  ShieldAlert,
  ThermometerSun,
} from 'lucide-react';

export default function HeatEmergencyGuidanceModal({ onClose }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="heat-guide-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1060,
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: '0.75rem',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ThermometerSun size={20} style={{ color: '#ef4444' }} aria-hidden="true" />
            <h3 id="heat-guide-title" style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
              Offline Heatwave Emergency & First-Aid Guide
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close guide"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              padding: '0.35rem',
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Medical Disclaimer */}
          <div
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: '0.5rem',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              fontSize: '0.78rem',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.4rem',
            }}
          >
            <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '0.1rem' }} aria-hidden="true" />
            <span>
              <strong>Emergency Notice:</strong> This guidance is for immediate civic first-aid and hydration support. It does not replace emergency medical care or hospital triage. Call <strong>108</strong> immediately for unconsciousness or severe heat stroke.
            </span>
          </div>

          {/* Heat Exhaustion vs Heat Stroke */}
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
              Recognizing Symptoms: Heat Exhaustion vs Heat Stroke
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(234, 179, 8, 0.08)',
                  border: '1px solid rgba(234, 179, 8, 0.25)',
                  fontSize: '0.78rem',
                }}
              >
                <strong style={{ color: '#d97706', display: 'block', marginBottom: '0.25rem' }}>
                  Heat Exhaustion
                </strong>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--text-secondary)' }}>
                  <li>Heavy sweating & cold, pale skin</li>
                  <li>Dizziness, nausea, headache</li>
                  <li>Fast, weak pulse</li>
                  <li>Muscle cramps</li>
                </ul>
                <div style={{ marginTop: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Action: Move to shade, drink ORS/water, loosen clothing.
                </div>
              </div>

              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  fontSize: '0.78rem',
                }}
              >
                <strong style={{ color: '#ef4444', display: 'block', marginBottom: '0.25rem' }}>
                  Heat Stroke (CRITICAL)
                </strong>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--text-secondary)' }}>
                  <li>High body temp (&gt; 40°C / 103°F)</li>
                  <li>Hot, red, dry skin (no sweating)</li>
                  <li>Confusion, slurred speech</li>
                  <li>Loss of consciousness / fainting</li>
                </ul>
                <div style={{ marginTop: '0.5rem', fontWeight: 700, color: '#ef4444' }}>
                  Action: Call 108 immediately. Cool victim with wet sheets/ice.
                </div>
              </div>
            </div>
          </div>

          {/* Homemade ORS Formula */}
          <div
            style={{
              padding: '0.85rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-main)',
              border: '1px solid var(--border-light)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
              <Droplets size={16} style={{ color: 'var(--accent-main)' }} aria-hidden="true" />
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                Standard Homemade ORS (Oral Rehydration Salts) Formula
              </strong>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>
              If commercial WHO-ORS packets are not immediately accessible, prepare this rapid life-saving hydration mix:
            </p>
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                flexWrap: 'wrap',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              <div style={{ padding: '0.4rem 0.6rem', borderRadius: '0.4rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                1 Liter Clean Water
              </div>
              <div style={{ padding: '0.4rem 0.6rem', borderRadius: '0.4rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                + 6 Teaspoons Sugar
              </div>
              <div style={{ padding: '0.4rem 0.6rem', borderRadius: '0.4rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                + 1/2 Teaspoon Salt
              </div>
            </div>
          </div>

          {/* Emergency Telephone Directory */}
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.4rem' }}>
              Emergency Dial Lines (Works 24x7 from any mobile phone)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
              <div style={{ padding: '0.6rem', borderRadius: '0.4rem', background: 'var(--bg-main)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>Emergency Ambulance</span>
                <strong style={{ fontSize: '1.1rem', color: '#ef4444' }}>108</strong>
              </div>
              <div style={{ padding: '0.6rem', borderRadius: '0.4rem', background: 'var(--bg-main)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>District Disaster Control</span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--accent-main)' }}>1077</strong>
              </div>
              <div style={{ padding: '0.6rem', borderRadius: '0.4rem', background: 'var(--bg-main)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>State Disaster Management</span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>1070</strong>
              </div>
              <div style={{ padding: '0.6rem', borderRadius: '0.4rem', background: 'var(--bg-main)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>All-in-One Helpline</span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>112</strong>
              </div>
            </div>
          </div>

          {/* Close button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
            <button type="button" className="btn btn-primary" onClick={onClose} style={{ fontSize: '0.85rem' }}>
              Understood / Close Guide
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
