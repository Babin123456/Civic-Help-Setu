import { AlertTriangle, ShieldCheck, Activity, PlusCircle, BarChart3, AlertOctagon } from 'lucide-react';
import StandardPageHeader from '../common/StandardPageHeader';
import { ETHICAL_NON_FAULT_NOTICE } from '../../data/roadSafetyContract';
import { can } from '../../services/accessControl';

export default function RoadSafetyHeader({
  onOpenHazardModal,
  onOpenRiskRunModal,
  onOpenComparatorModal,
}) {
  const isAdmin = can('roadSafety.admin');

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <StandardPageHeader
        eyebrow="MoRTH & IRC SP:88 Compliant Analytics"
        eyebrowIcon={<AlertTriangle size={15} style={{ color: '#f59e0b' }} />}
        title="Road-Safety Blackspot Detection & Evidence Review Dashboard"
        subtitle="Empowering municipal planners, highway authorities, and safety auditors to identify recurring crash corridors, audit physical road features, document site inspections, and verify evidence-backed countermeasures."
        badgeText="Statutory Evidence Standard"
        badgeType="accent"
      />

      {/* Action Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '1.25rem',
          marginBottom: '1.5rem',
          padding: '0.75rem 1rem',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-main)',
          borderRadius: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={18} color="var(--accent-main)" />
          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
            Corridor Analytics & Remediation Hub
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onOpenHazardModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-main)',
              border: '1px solid var(--border-main)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            <PlusCircle size={15} color="#10b981" />
            Report Road Hazard
          </button>

          <button
            type="button"
            onClick={onOpenComparatorModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-main)',
              border: '1px solid var(--border-main)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            <BarChart3 size={15} color="var(--accent-main)" />
            Compare Periods
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={onOpenRiskRunModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '0.5rem',
                background: 'var(--accent-main)',
                border: '1px solid var(--accent-main)',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              <AlertOctagon size={15} />
              Run Risk Analysis
            </button>
          )}
        </div>
      </div>

      {/* Ethical Guardrail Notice */}
      <div
        role="note"
        aria-label="Statutory road safety analytics notice"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          padding: '0.9rem 1.15rem',
          borderRadius: '0.65rem',
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          fontSize: '0.82rem',
          lineHeight: '1.45',
          color: 'var(--text-secondary)',
        }}
      >
        <ShieldCheck size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>Non-Fault Attribution Mandate: </strong>
          {ETHICAL_NON_FAULT_NOTICE}
        </div>
      </div>
    </div>
  );
}
