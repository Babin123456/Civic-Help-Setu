import { useState, useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  VENDOR_CATEGORIES,
  VENDING_ZONE_TYPES,
  evaluateEvictionImmunity,
} from '../../services/streetVendorService.js';

export default function EvictionImmunityCard({ onImmunityChange }) {
  const [vendingCategoryKey, setVendingCategoryKey] = useState('STATIONARY');
  const [tvcSurveyCompleted, setTvcSurveyCompleted] = useState(false);
  const [vendingCertificateIssued, setVendingCertificateIssued] = useState(false);
  const [hasSurveySlipOrReceipt, setHasSurveySlipOrReceipt] = useState(true);
  const [yearsVendingAtLocation, setYearsVendingAtLocation] = useState(5);
  const [zoneTypeKey, setZoneTypeKey] = useState('RESTRICTION_FREE');

  const immunityAnalysis = useMemo(() => {
    return evaluateEvictionImmunity({
      tvcSurveyCompleted,
      vendingCertificateIssued,
      hasSurveySlipOrReceipt,
      yearsVendingAtLocation: Number(yearsVendingAtLocation) || 0,
      zoneTypeKey,
    });
  }, [
    tvcSurveyCompleted,
    vendingCertificateIssued,
    hasSurveySlipOrReceipt,
    yearsVendingAtLocation,
    zoneTypeKey,
  ]);

  useMemo(() => {
    if (onImmunityChange) {
      onImmunityChange(immunityAnalysis);
    }
  }, [immunityAnalysis, onImmunityChange]);

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
        <ShieldCheck style={{ width: 28, height: 28, color: '#38bdf8' }} />
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
            Section 3(3) Absolute Statutory Eviction Immunity Auditor
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Statutory ban on eviction prior to TVC survey completion &amp; certificate issuance
          </span>
        </div>
      </div>

      {/* Inputs Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Vending Category
          </label>
          <select
            value={vendingCategoryKey}
            onChange={(e) => setVendingCategoryKey(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          >
            {Object.entries(VENDOR_CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Zoning Classification
          </label>
          <select
            value={zoneTypeKey}
            onChange={(e) => setZoneTypeKey(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          >
            {Object.entries(VENDING_ZONE_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Years Operating at Current Pitch
          </label>
          <input
            type="number"
            min="0"
            max="50"
            value={yearsVendingAtLocation}
            onChange={(e) => setYearsVendingAtLocation(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
        </div>
      </div>

      {/* Survey & Documentation Status */}
      <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.75rem', border: '1px solid var(--border-light, #334155)' }}>
        <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)', marginBottom: '0.65rem' }}>
          Statutory Survey &amp; Registration Verification
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={tvcSurveyCompleted}
              onChange={(e) => setTvcSurveyCompleted(e.target.checked)}
            />
            Town Vending Committee (TVC) survey formally completed in ward
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={vendingCertificateIssued}
              onChange={(e) => setVendingCertificateIssued(e.target.checked)}
            />
            Formal Vending Certificate (VCoV) issued under Section 4
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={hasSurveySlipOrReceipt}
              onChange={(e) => setHasSurveySlipOrReceipt(e.target.checked)}
            />
            Possesses TVC survey enrollment receipt, municipal tehbazari slip or fee challan
          </label>
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
          padding: '1.25rem',
          borderRadius: '0.75rem',
          background: immunityAnalysis.hasAbsoluteStatutoryImmunity ? 'rgba(34, 197, 94, 0.12)' : 'rgba(234, 179, 8, 0.12)',
          border: `1px solid ${immunityAnalysis.hasAbsoluteStatutoryImmunity ? 'rgba(34, 197, 94, 0.4)' : 'rgba(234, 179, 8, 0.4)'}`,
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {immunityAnalysis.hasAbsoluteStatutoryImmunity ? (
            <CheckCircle2 style={{ width: 32, height: 32, color: '#4ade80' }} />
          ) : (
            <AlertTriangle style={{ width: 32, height: 32, color: '#facc15' }} />
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: immunityAnalysis.hasAbsoluteStatutoryImmunity ? '#4ade80' : '#facc15' }}>
              {immunityAnalysis.hasAbsoluteStatutoryImmunity ? 'ABSOLUTE NON-EVICTION PROTECTION UNDER SECTION 3(3)' : 'CERTIFICATE REGULATED VENDOR'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
              {immunityAnalysis.statutoryAdvice}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>Immunity Status</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: immunityAnalysis.hasAbsoluteStatutoryImmunity ? '#4ade80' : '#38bdf8' }}>
            {immunityAnalysis.immunityStrength}
          </div>
        </div>
      </div>

      {immunityAnalysis.violationsIfEvicted.length > 0 && (
        <div>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)', marginBottom: '0.4rem', display: 'block' }}>
            Statutory Protections Triggered:
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {immunityAnalysis.violationsIfEvicted.map((v, i) => (
              <div
                key={i}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.4rem',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-light, #334155)',
                  fontSize: '0.8rem',
                }}
              >
                <strong style={{ color: '#38bdf8' }}>{v.section}:</strong> {v.name}
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '0.15rem' }}>
                  {v.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
