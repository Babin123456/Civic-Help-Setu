import React from 'react';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Globe2,
  Calendar,
  ShieldCheck,
  Languages,
  Accessibility as AccessibilityIcon,
  Filter,
} from 'lucide-react';
import {
  ACCESSIBILITY_FACILITIES,
  FACILITY_LABELS,
  COMMON_OFFICE_LANGUAGES,
  getAttributeStatus,
  normalizeAccessibilityRecord,
} from '../../services/accessibilityMapService';

/**
 * Renders verified facility accessibility status badge:
 * - Available (green checkmark)
 * - Unavailable (red/muted cross)
 * - Unknown (amber question mark - strictly preserved, never coerced to available or unavailable)
 */
export const FacilityStatusBadge = ({ facilityKey, value }) => {
  const status = getAttributeStatus(value);
  const label = FACILITY_LABELS[facilityKey] || facilityKey;

  if (status === 'available') {
    return (
      <span
        className="facility-badge facility-badge--available"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.25rem 0.6rem',
          borderRadius: '9999px',
          fontSize: '0.78rem',
          fontWeight: 500,
          background: 'rgba(16, 185, 129, 0.12)',
          color: '#10b981',
          border: '1px solid rgba(16, 185, 129, 0.3)',
        }}
        title={`${label}: Verified Available`}
        aria-label={`${label}: Verified Available`}
      >
        <CheckCircle2 size={13} aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }

  if (status === 'unavailable') {
    return (
      <span
        className="facility-badge facility-badge--unavailable"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.25rem 0.6rem',
          borderRadius: '9999px',
          fontSize: '0.78rem',
          fontWeight: 500,
          background: 'rgba(239, 68, 68, 0.08)',
          color: 'var(--text-tertiary, #94a3b8)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          textDecoration: 'line-through',
        }}
        title={`${label}: Verified Not Available`}
        aria-label={`${label}: Not Available`}
      >
        <XCircle size={13} aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }

  // Unknown / unverified status (CRITICAL acceptance criteria)
  return (
    <span
      className="facility-badge facility-badge--unknown"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.25rem 0.6rem',
        borderRadius: '9999px',
        fontSize: '0.78rem',
        fontWeight: 500,
        background: 'rgba(245, 158, 11, 0.1)',
        color: '#f59e0b',
        border: '1px dashed rgba(245, 158, 11, 0.4)',
      }}
      title={`${label}: Audit Pending / Status Unknown`}
      aria-label={`${label}: Status Unknown (Needs Audit)`}
    >
      <HelpCircle size={13} aria-hidden="true" />
      <span>{label} (Unknown)</span>
    </span>
  );
};

/**
 * Detailed accessibility & language audit panel for an office card or detail view
 */
export const OfficeAccessibilityDetails = ({ office }) => {
  if (!office) return null;
  const record = normalizeAccessibilityRecord(office);

  return (
    <div
      className="accessibility-details-panel"
      style={{
        marginTop: '0.75rem',
        padding: '0.85rem 1rem',
        background: 'var(--bg-card-hover, rgba(255, 255, 255, 0.03))',
        borderRadius: '0.75rem',
        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.6rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.88rem' }}>
          <AccessibilityIcon size={16} color="var(--accent-main, #38bdf8)" aria-hidden="true" />
          <span>Accessibility & Inclusion Facilities</span>
        </div>
        {record.auditMetadata.reviewDate && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.75rem',
              color: 'var(--text-tertiary, #94a3b8)',
            }}
            title={`Audit by ${record.auditMetadata.verifiedBy}`}
          >
            <Calendar size={12} aria-hidden="true" />
            Audit: {record.auditMetadata.reviewDate}
          </span>
        )}
      </div>

      {/* Facilities Grid */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.4rem',
          marginBottom: '0.75rem',
        }}
      >
        {Object.entries(ACCESSIBILITY_FACILITIES).map(([name, key]) => (
          <FacilityStatusBadge
            key={key}
            facilityKey={key}
            value={record.accessibility[key]}
          />
        ))}
      </div>

      {/* Language Coverage */}
      <div
        style={{
          borderTop: '1px dashed var(--border-light, rgba(255, 255, 255, 0.1))',
          paddingTop: '0.6rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
          fontSize: '0.82rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Languages size={14} color="var(--accent-main, #38bdf8)" aria-hidden="true" />
          <span style={{ fontWeight: 600 }}>Languages Supported:</span>
          <span style={{ color: 'var(--text-secondary, #cbd5e1)' }}>
            {(record.languageCoverage.supportedLanguages || []).join(', ') || 'English, Hindi'}
          </span>
        </div>
        {record.languageCoverage.helpdeskLanguages?.length > 0 && (
          <div style={{ paddingLeft: '1.25rem', color: 'var(--text-tertiary, #94a3b8)', fontSize: '0.78rem' }}>
            Helpdesk assistance: {record.languageCoverage.helpdeskLanguages.join(', ')}
          </div>
        )}
      </div>

      {/* Source verification footer */}
      {record.auditMetadata.sourceUrl && (
        <div
          style={{
            marginTop: '0.5rem',
            paddingTop: '0.4rem',
            borderTop: '1px solid var(--border-light, rgba(255, 255, 255, 0.05))',
            fontSize: '0.75rem',
            color: 'var(--text-tertiary, #94a3b8)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <ShieldCheck size={12} color="#10b981" aria-hidden="true" />
          <span>Source: {record.auditMetadata.verifiedBy}</span>
        </div>
      )}
    </div>
  );
};

/**
 * Filter bar for selecting required accessibility facilities and languages
 */
export const AccessibilityFilterBar = ({
  selectedFacilities = [],
  onToggleFacility = () => {},
  selectedLanguages = [],
  onToggleLanguage = () => {},
  onClearFilters = () => {},
}) => {
  return (
    <div
      className="accessibility-filter-bar card-glass"
      style={{
        padding: '1rem',
        borderRadius: '0.85rem',
        background: 'var(--bg-card, rgba(17, 24, 39, 0.7))',
        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
        marginBottom: '1rem',
      }}
      role="region"
      aria-label="Accessibility and language filters"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
          <Filter size={16} color="var(--accent-main, #38bdf8)" aria-hidden="true" />
          <span>Filter by Verified Accessibility & Language Support</span>
        </div>
        {(selectedFacilities.length > 0 || selectedLanguages.length > 0) && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClearFilters}
            style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.4rem' }}>
          Mandatory Physical & Digital Access Facilities (Verified Only):
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {Object.entries(ACCESSIBILITY_FACILITIES).map(([name, key]) => {
            const isSelected = selectedFacilities.includes(key);
            const label = FACILITY_LABELS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => onToggleFacility(key)}
                aria-pressed={isSelected}
                style={{
                  padding: '0.3rem 0.7rem',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  border: isSelected
                    ? '1px solid var(--accent-main, #38bdf8)'
                    : '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                  background: isSelected
                    ? 'rgba(56, 189, 248, 0.18)'
                    : 'var(--bg-card-hover, rgba(255, 255, 255, 0.04))',
                  color: isSelected ? 'var(--accent-main, #38bdf8)' : 'var(--text-primary, #f8fafc)',
                  fontWeight: isSelected ? 600 : 400,
                  transition: 'all 0.15s ease',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.4rem' }}>
          Languages Supported at Office / Counter:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {COMMON_OFFICE_LANGUAGES.map((lang) => {
            const isSelected = selectedLanguages.includes(lang);
            return (
              <button
                key={lang}
                type="button"
                onClick={() => onToggleLanguage(lang)}
                aria-pressed={isSelected}
                style={{
                  padding: '0.25rem 0.6rem',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  border: isSelected
                    ? '1px solid #10b981'
                    : '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                  background: isSelected
                    ? 'rgba(16, 185, 129, 0.18)'
                    : 'var(--bg-card-hover, rgba(255, 255, 255, 0.04))',
                  color: isSelected ? '#10b981' : 'var(--text-secondary, #cbd5e1)',
                  fontWeight: isSelected ? 600 : 400,
                  transition: 'all 0.15s ease',
                }}
              >
                {lang}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
