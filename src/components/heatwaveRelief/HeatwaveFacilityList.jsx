import React from 'react';
import {
  Building2,
  Droplets,
  HeartPulse,
  Sun,
  ShieldCheck,
  Clock,
  ExternalLink,
  AlertTriangle,
  Accessibility,
  CheckCircle2,
  XCircle,
  HelpCircle,
  MapPin,
} from 'lucide-react';
import {
  RELIEF_FACILITY_TYPE_LABELS,
  OPERATIONAL_STATUS,
  CAPACITY_STATUS,
} from '../../data/upHeatwaveReliefContract';

export default function HeatwaveFacilityList({
  facilities,
  selectedFacility,
  onSelectFacility,
  onOpenObservationModal,
}) {
  if (!facilities || facilities.length === 0) {
    return (
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: '0.75rem',
          padding: '2.5rem 1rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        <Sun size={36} style={{ color: 'var(--text-tertiary)', margin: '0 auto 0.75rem' }} aria-hidden="true" />
        <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.35rem' }}>
          No Matching Heat-Relief Facilities Found
        </h4>
        <p style={{ fontSize: '0.85rem', maxWidth: '420px', margin: '0 auto' }}>
          Try adjusting your district, ward search, or clearing active filters to view all verified cooling locations.
        </p>
      </div>
    );
  }

  return (
    <div
      role="feed"
      aria-label="Verified Heat-Relief Facilities List"
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      {facilities.map((facility) => {
        const isSelected = selectedFacility?.id === facility.id;
        const isOpen = facility.effectiveOperationalStatus === OPERATIONAL_STATUS.OPEN;
        const isDisputed = facility.isDisputed;
        const isStale = facility.isStale;
        const isSeasonActive = facility.isSeasonActive;

        return (
          <article
            key={facility.id}
            tabIndex={0}
            onClick={() => onSelectFacility(facility)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectFacility(facility);
              }
            }}
            style={{
              background: 'var(--bg-card)',
              border: isSelected ? '2px solid var(--accent-main)' : '1px solid var(--border-light)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.9rem',
              transition: 'border-color 0.15s ease',
              outline: 'none',
              cursor: 'pointer',
            }}
            aria-labelledby={`fac-title-${facility.id}`}
          >
            {/* Header: Title, Facility Type Badge, and Live Status Badge */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '999px',
                      background: 'var(--accent-subtle, rgba(59, 130, 246, 0.12))',
                      color: 'var(--accent-main)',
                    }}
                  >
                    {RELIEF_FACILITY_TYPE_LABELS[facility.facilityType] || facility.facilityType}
                  </span>

                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.18rem 0.48rem',
                      borderRadius: '999px',
                      background: 'rgba(16, 185, 129, 0.12)',
                      color: '#047857',
                    }}
                  >
                    Official Verified Source
                  </span>

                  {facility.isTemporary && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '0.18rem 0.48rem',
                        borderRadius: '999px',
                        background: facility.isExpired ? 'rgba(220, 38, 38, 0.12)' : 'rgba(245, 158, 11, 0.15)',
                        color: facility.isExpired ? '#dc2626' : '#b45309',
                      }}
                    >
                      {facility.isExpired ? 'Expired Temporary Facility' : 'Temporary Cooling / Water Point'}
                    </span>
                  )}

                  {facility.distanceKm !== null && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-main)' }}>
                      📍 {facility.distanceKm} km away
                    </span>
                  )}
                </div>

                <h3
                  id={`fac-title-${facility.id}`}
                  style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0.2rem 0', color: 'var(--text-primary)' }}
                >
                  {facility.name}
                </h3>

                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                  📍 {facility.address} • <strong>{facility.wardOrVillage}</strong> ({facility.district})
                </p>
              </div>

              {/* Dynamic Availability Status Badge */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.65rem',
                    borderRadius: '999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: isDisputed
                      ? 'rgba(234, 88, 12, 0.15)'
                      : isOpen
                      ? 'rgba(22, 163, 74, 0.15)'
                      : 'rgba(220, 38, 38, 0.15)',
                    color: isDisputed ? '#ea580c' : isOpen ? '#16a34a' : '#dc2626',
                  }}
                >
                  {isDisputed ? (
                    <>
                      <AlertTriangle size={13} aria-hidden="true" />
                      Status Disputed
                    </>
                  ) : isOpen ? (
                    <>
                      <CheckCircle2 size={13} aria-hidden="true" />
                      Open & Available
                    </>
                  ) : (
                    <>
                      <XCircle size={13} aria-hidden="true" />
                      Temporarily Closed
                    </>
                  )}
                </span>

                {/* Stale or Seasonal Notice */}
                {!isSeasonActive && (
                  <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>
                    ❄️ Seasonal Inactive (Closed in Winter)
                  </span>
                )}
                {isStale && isSeasonActive && (
                  <span style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 600 }}>
                    ⚠️ Verification Stale (Needs update)
                  </span>
                )}
              </div>
            </div>

            {/* Temporary Condition Notice (Distinguished from Permanent Infrastructure) */}
            {(facility.temporaryClosureReason || isDisputed || facility.effectiveCapacityStatus !== CAPACITY_STATUS.AVAILABLE) && (
              <div
                style={{
                  background: isDisputed
                    ? 'rgba(234, 88, 12, 0.08)'
                    : 'var(--bg-main)',
                  border: `1px dashed ${isDisputed ? 'rgba(234, 88, 12, 0.3)' : 'var(--border-light)'}`,
                  borderRadius: '0.5rem',
                  padding: '0.65rem 0.85rem',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                  🕒 Live Temporary Condition:
                </div>
                {facility.temporaryClosureReason && (
                  <p style={{ margin: '0 0 0.2rem', color: '#dc2626' }}>
                    <strong>Closure Note:</strong> {facility.temporaryClosureReason}
                  </p>
                )}
                {isDisputed && facility.disputeDetails && (
                  <p style={{ margin: 0, color: '#ea580c' }}>
                    <strong>Conflicting Observation:</strong> {facility.disputeDetails.contradictoryCount} recent resident reports indicate facility is closed or water tap dry.
                  </p>
                )}
                {facility.effectiveCapacityStatus === CAPACITY_STATUS.CROWDED && (
                  <p style={{ margin: 0, color: '#d97706' }}>
                    <strong>Capacity Note:</strong> High demand observed; seating may be limited.
                  </p>
                )}
              </div>
            )}

            {/* Permanent Facility Attributes Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '0.6rem',
                padding: '0.65rem',
                background: 'var(--bg-main)',
                borderRadius: '0.5rem',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
              }}
            >
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Operating Hours:</strong>{' '}
                {facility.operatingHours}
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Cooling Mechanism:</strong>{' '}
                {facility.accessibility?.coolingType || 'Natural Shade / Ventilation'}
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Capacity:</strong>{' '}
                {facility.nominalCapacity ? `~${facility.nominalCapacity} persons` : 'Public Walk-in'}
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Seasonal Window:</strong> March - July (Active)
              </div>
            </div>

            {/* Amenities Checklist */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
              <span style={{ color: facility.accessibility?.wheelchairAccessible ? '#16a34a' : 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <Accessibility size={14} aria-hidden="true" />
                {facility.accessibility?.wheelchairAccessible ? 'Wheelchair Accessible' : 'Step Access'}
              </span>

              <span style={{ color: facility.accessibility?.drinkingWaterAvailable ? '#16a34a' : 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <Droplets size={14} aria-hidden="true" />
                {facility.accessibility?.drinkingWaterAvailable ? 'Potable Water' : 'No Water'}
              </span>

              <span style={{ color: facility.accessibility?.orsAvailable ? '#16a34a' : 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <HeartPulse size={14} aria-hidden="true" />
                {facility.accessibility?.orsAvailable ? 'ORS Packets Available' : 'No ORS'}
              </span>
            </div>

            {/* Provenance Footer: Authority, Source URL, Last-Verified Date */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                paddingTop: '0.6rem',
                borderTop: '1px solid var(--border-light)',
                fontSize: '0.76rem',
                color: 'var(--text-secondary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span>
                  <strong style={{ color: 'var(--text-primary)' }}>Authority:</strong> {facility.responsibleAuthority}
                </span>

                <span>
                  <strong style={{ color: 'var(--text-primary)' }}>Verified:</strong>{' '}
                  {facility.verifiedAt ? new Date(facility.verifiedAt).toLocaleDateString() : 'Pending'}
                </span>

                {facility.sourceUrl && (
                  <a
                    href={facility.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      color: 'var(--accent-main)',
                      textDecoration: 'none',
                    }}
                    aria-label={`Official gazette notice source for ${facility.name}`}
                  >
                    Official Source <ExternalLink size={12} aria-hidden="true" />
                  </a>
                )}
              </div>

              {/* Action: Community Observation & Update */}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenObservationModal(facility);
                }}
                style={{
                  fontSize: '0.78rem',
                  padding: '0.35rem 0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
                aria-label={`Report or update status for ${facility.name}`}
              >
                <Clock size={13} aria-hidden="true" />
                Submit Status Correction
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
