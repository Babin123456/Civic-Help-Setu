import React from 'react';
import {
  Search,
  Filter,
  MapPin,
  Wifi,
  FileText,
  Accessibility,
  Droplets,
  HeartPulse,
  Sun,
  ShieldCheck,
} from 'lucide-react';
import {
  RELIEF_FACILITY_TYPES,
  RELIEF_FACILITY_TYPE_LABELS,
  UP_PILOT_DISTRICTS,
} from '../../data/upHeatwaveReliefContract';

export default function HeatwaveReliefFilters({
  filters,
  onChangeFilters,
  onResetFilters,
  isLowBandwidth,
  onToggleLowBandwidth,
  isTextOnlyView,
  onToggleTextOnlyView,
  locationConsentGranted,
  onRequestLocationConsent,
  onRevokeLocationConsent,
  isLocating,
  locationError,
}) {
  const handleTextChange = (field, value) => {
    onChangeFilters({ ...filters, [field]: value });
  };

  const handleToggle = (field) => {
    onChangeFilters({ ...filters, [field]: !filters[field] });
  };

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Top Bar: District & Ward Search + Low Bandwidth & View Toggles */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', flex: 1, minWidth: '280px' }}>
          {/* District Selector */}
          <div style={{ minWidth: '180px' }}>
            <label
              htmlFor="heat-district-select"
              style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}
            >
              UP Pilot District
            </label>
            <select
              id="heat-district-select"
              value={filters.district || 'Lucknow'}
              onChange={(e) => handleTextChange('district', e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              {UP_PILOT_DISTRICTS.map((dist) => (
                <option key={dist} value={dist}>
                  {dist} {dist === 'Lucknow' ? '(Primary Pilot)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Ward / Village or Keyword Search */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label
              htmlFor="heat-search-input"
              style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}
            >
              Ward / Village / Landmark Search
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="heat-search-input"
                type="text"
                value={filters.searchQuery || ''}
                onChange={(e) => handleTextChange('searchQuery', e.target.value)}
                placeholder="e.g. Hazratganj, Charbagh, Chowk, PHC..."
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem 0.5rem 2rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              />
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '0.65rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)',
                  pointerEvents: 'none',
                }}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        {/* View & Bandwidth Control Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Low Bandwidth Toggle */}
          <button
            type="button"
            onClick={onToggleLowBandwidth}
            aria-pressed={isLowBandwidth}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '0.5rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
              border: isLowBandwidth ? '1.5px solid var(--accent-main)' : '1px solid var(--border-light)',
              background: isLowBandwidth ? 'var(--accent-subtle, rgba(59, 130, 246, 0.15))' : 'var(--bg-main)',
              color: isLowBandwidth ? 'var(--accent-main)' : 'var(--text-secondary)',
            }}
            title="Disable heavy graphics and map tiles for 2G / weak mobile signals"
          >
            <Wifi size={14} aria-hidden="true" />
            Low-Bandwidth Mode {isLowBandwidth ? '(Active)' : ''}
          </button>

          {/* Text-Only Accessible View Toggle */}
          <button
            type="button"
            onClick={onToggleTextOnlyView}
            aria-pressed={isTextOnlyView}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '0.5rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
              border: isTextOnlyView ? '1.5px solid var(--accent-main)' : '1px solid var(--border-light)',
              background: isTextOnlyView ? 'var(--accent-subtle, rgba(59, 130, 246, 0.15))' : 'var(--bg-main)',
              color: isTextOnlyView ? 'var(--accent-main)' : 'var(--text-secondary)',
            }}
            title="Accessible text-only list alternative"
          >
            <FileText size={14} aria-hidden="true" />
            Text-Only List
          </button>
        </div>
      </div>

      {/* Facility Type Filter Chips */}
      <div>
        <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
          Relief Facility Type
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          <button
            type="button"
            onClick={() => handleTextChange('facilityType', 'all')}
            style={{
              padding: '0.35rem 0.7rem',
              borderRadius: '999px',
              fontSize: '0.78rem',
              cursor: 'pointer',
              border: (filters.facilityType || 'all') === 'all' ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
              background: (filters.facilityType || 'all') === 'all' ? 'var(--accent-main)' : 'var(--bg-main)',
              color: (filters.facilityType || 'all') === 'all' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            All Verified Facilities
          </button>

          {Object.entries(RELIEF_FACILITY_TYPES).map(([key, val]) => {
            const isSelected = filters.facilityType === val;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleTextChange('facilityType', val)}
                style={{
                  padding: '0.35rem 0.7rem',
                  borderRadius: '999px',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  border: isSelected ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
                  background: isSelected ? 'var(--accent-main)' : 'var(--bg-main)',
                  color: isSelected ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {RELIEF_FACILITY_TYPE_LABELS[val]?.split('(')[0]?.trim()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Amenities & Accessibility Toggles + Location Consent */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid var(--border-light)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
            <input
              type="checkbox"
              checked={Boolean(filters.onlyOpen)}
              onChange={() => handleToggle('onlyOpen')}
            />
            Currently Open & Active
          </label>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
            <input
              type="checkbox"
              checked={Boolean(filters.onlyWheelchair)}
              onChange={() => handleToggle('onlyWheelchair')}
            />
            <Accessibility size={13} aria-hidden="true" />
            Wheelchair Accessible
          </label>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
            <input
              type="checkbox"
              checked={Boolean(filters.onlyOrsAvailable)}
              onChange={() => handleToggle('onlyOrsAvailable')}
            />
            <HeartPulse size={13} aria-hidden="true" />
            ORS Packets Available
          </label>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
            <input
              type="checkbox"
              checked={Boolean(filters.onlyDrinkingWater)}
              onChange={() => handleToggle('onlyDrinkingWater')}
            />
            <Droplets size={13} aria-hidden="true" />
            Drinking Water
          </label>
        </div>

        {/* User Location Consent Gate (Acceptance Criteria #5) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {!locationConsentGranted ? (
            <button
              type="button"
              onClick={onRequestLocationConsent}
              disabled={isLocating}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.78rem',
                padding: '0.35rem 0.65rem',
                borderRadius: '0.4rem',
                background: 'var(--bg-main)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              title="Request browser location to show distance to nearest facilities. No precise location is stored without your explicit consent."
            >
              <MapPin size={13} aria-hidden="true" />
              {isLocating ? 'Locating...' : 'Sort by Nearest (Requires Consent)'}
            </button>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#16a34a' }}>
              <ShieldCheck size={14} aria-hidden="true" />
              <span>Location active (in-memory only)</span>
              <button
                type="button"
                onClick={onRevokeLocationConsent}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: 0,
                  marginLeft: '0.2rem',
                }}
              >
                Revoke
              </button>
            </div>
          )}

          {locationError && (
            <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{locationError}</span>
          )}

          <button
            type="button"
            onClick={onResetFilters}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              fontSize: '0.78rem',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '0.2rem',
            }}
          >
            Reset Filters
          </button>
        </div>
      </div>
    </div>
  );
}
