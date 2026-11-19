import {
  MapPin,
  Clock,
  AlertTriangle,
  Wrench,
  CheckCircle2,
  Accessibility,
  Baby,
  Droplets,
  Sparkles,
  Info,
} from 'lucide-react';
import { calculateOperatingStatus, CATEGORY_LABELS } from '../../data/publicToiletContract';

const formatTimeAgo = (isoDate) => {
  if (!isoDate) return 'No audited cleaning recorded';
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diffMs / (60 * 1000));
  if (mins < 60) return `Cleaned ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Cleaned ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Cleaned ${days}d ago`;
};

export default function ToiletCard({
  facility,
  isOperator = false,
  onOpenDetails,
  onReportIssue,
  onLogCleaning,
  onOpenMaintenance,
}) {
  if (!facility) return null;

  const operatingStatus = calculateOperatingStatus(facility.operatingWindows, facility.temporaryClosure);
  const categoryLabel = CATEGORY_LABELS[facility.category] || 'Public Toilet';
  const feeLabel = facility.feeStructure?.feeType === 'free'
    ? 'Free Public Facility'
    : `Pay & Use (${facility.feeStructure?.amountInr ? `₹${facility.feeStructure.amountInr}` : 'Nominal'})`;

  // Status badge logic (accessible: color + distinct icon + text)
  let statusBadge = {
    label: operatingStatus.label,
    icon: Clock,
    bg: 'rgba(34, 197, 94, 0.12)',
    color: 'var(--success-main, #15803d)',
    border: 'rgba(34, 197, 94, 0.3)',
  };

  if (facility.status === 'temporarily_closed' || !operatingStatus.isOpen) {
    statusBadge = {
      label: operatingStatus.label || 'Closed',
      icon: AlertTriangle,
      bg: 'rgba(234, 179, 8, 0.12)',
      color: 'var(--warning-main, #b45309)',
      border: 'rgba(234, 179, 8, 0.3)',
    };
  }

  if (facility.status === 'under_maintenance') {
    statusBadge = {
      label: 'Under Maintenance',
      icon: Wrench,
      bg: 'rgba(239, 68, 68, 0.12)',
      color: 'var(--danger-main, #b91c1c)',
      border: 'rgba(239, 68, 68, 0.3)',
    };
  }

  const StatusIcon = statusBadge.icon;

  return (
    <article
      className="toilet-card"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-main)',
        borderRadius: '1rem',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
        position: 'relative',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      <div>
        {/* Top Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.25rem 0.65rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: statusBadge.bg,
              color: statusBadge.color,
              border: `1px solid ${statusBadge.border}`,
            }}
          >
            <StatusIcon size={12} /> {statusBadge.label}
          </span>

          <span
            style={{
              padding: '0.25rem 0.65rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 500,
              backgroundColor: 'var(--bg-muted, #f1f5f9)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
            }}
          >
            {categoryLabel}
          </span>

          <span
            style={{
              padding: '0.25rem 0.65rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 500,
              backgroundColor: facility.feeStructure?.feeType === 'free' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(107, 114, 128, 0.1)',
              color: facility.feeStructure?.feeType === 'free' ? 'var(--info-main, #2563eb)' : 'var(--text-secondary)',
            }}
          >
            {feeLabel}
          </span>
        </div>

        {/* Facility Name */}
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem', lineHeight: 1.3 }}>
          {facility.name}
        </h3>

        {/* Location & Ward */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          <MapPin size={15} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--text-muted)' }} />
          <span>
            {facility.location?.address}
            {facility.jurisdiction?.ward && (
              <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '0.8rem', marginTop: '2px' }}>
                Ward: {facility.jurisdiction.ward} ({facility.jurisdiction.district})
              </strong>
            )}
          </span>
        </div>

        {/* Accessibility & Features Icons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', margin: '0.75rem 0' }}>
          {facility.features?.wheelchairAccessible && (
            <span
              title="Wheelchair accessible ramp and wide cabin"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.75rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '0.35rem',
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                color: 'var(--primary-main, #1d4ed8)',
                border: '1px solid rgba(37, 99, 235, 0.2)',
              }}
            >
              <Accessibility size={12} /> Accessible Ramp
            </span>
          )}

          {facility.features?.genderNeutral && (
            <span
              title="Gender-neutral / All-gender facility"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.75rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '0.35rem',
                backgroundColor: 'rgba(147, 51, 234, 0.08)',
                color: '#7e22ce',
                border: '1px solid rgba(147, 51, 234, 0.2)',
              }}
            >
              All-Gender / Neutral
            </span>
          )}

          {facility.features?.babyCareStation && (
            <span
              title="Baby diaper changing station available"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.75rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '0.35rem',
                backgroundColor: 'rgba(236, 72, 153, 0.08)',
                color: '#be185d',
                border: '1px solid rgba(236, 72, 153, 0.2)',
              }}
            >
              <Baby size={12} /> Baby Care
            </span>
          )}

          {facility.features?.runningWater && (
            <span
              title="Running municipal water confirmed"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.75rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '0.35rem',
                backgroundColor: 'rgba(14, 165, 233, 0.08)',
                color: '#0284c7',
                border: '1px solid rgba(14, 165, 233, 0.2)',
              }}
            >
              <Droplets size={12} /> Running Water
            </span>
          )}
        </div>

        {/* Factual Cleaning Timestamp */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          <Sparkles size={13} style={{ color: 'var(--accent-main, #0284c7)' }} />
          <span>{formatTimeAgo(facility.lastCleanedAt)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => onOpenDetails?.(facility)}
            className="btn btn-secondary"
            style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '0.85rem', padding: '0.45rem' }}
          >
            <Info size={14} /> Details & Hours
          </button>

          <button
            type="button"
            onClick={() => onReportIssue?.(facility)}
            className="btn btn-outline"
            style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '0.85rem', padding: '0.45rem' }}
          >
            <AlertTriangle size={14} /> Report Issue
          </button>
        </div>

        {isOperator && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => onLogCleaning?.(facility)}
              className="btn btn-primary"
              style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.4rem' }}
            >
              <CheckCircle2 size={13} /> Log Cleaning
            </button>
            <button
              type="button"
              onClick={() => onOpenMaintenance?.(facility)}
              className="btn btn-secondary"
              style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.4rem' }}
            >
              <Wrench size={13} /> Maintenance
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

