import {
  Building2,
  FilterX,
  RotateCcw,
  SlidersHorizontal,
  Compass,
  MapPin,
  Search,
  CheckCircle2,
} from 'lucide-react';

/**
 * NearbyOfficesEmptyState Component
 *
 * Renders an accessible, instructive empty state explaining exactly which
 * filters contributed to 0 matching offices and actionable single-click
 * resolution paths (e.g. Expand Radius, Clear Channel, Reset All).
 */
const NearbyOfficesEmptyState = ({
  searchQuery,
  selectedState,
  selectedDistrict,
  selectedChannel,
  maxRadiusKm,
  onlyOpenNow,
  onlyWheelchair,
  selectedFacilities = [],
  selectedLanguages = [],
  serviceFilter,
  userCoords,
  onResetFilters,
  onExpandRadius,
  onClearSearch,
  onClearAccessibility,
}) => {
  // Collect active filter tags to present clearly to the user
  const activeCriteria = [];
  if (searchQuery) activeCriteria.push({ key: 'search', label: `Search: "${searchQuery}"`, onClear: onClearSearch });
  if (selectedState) activeCriteria.push({ key: 'state', label: `State: ${selectedState}` });
  if (selectedDistrict) activeCriteria.push({ key: 'district', label: `District: ${selectedDistrict}` });
  if (selectedChannel && selectedChannel !== 'all') activeCriteria.push({ key: 'channel', label: `Channel: ${selectedChannel}` });
  if (userCoords && maxRadiusKm) activeCriteria.push({ key: 'radius', label: `Radius: ${maxRadiusKm} km`, onExpand: onExpandRadius });
  if (onlyOpenNow) activeCriteria.push({ key: 'openNow', label: 'Only Open Now' });
  if (onlyWheelchair) activeCriteria.push({ key: 'wheelchair', label: 'Wheelchair Accessible Only' });
  if (serviceFilter) activeCriteria.push({ key: 'service', label: `Service: ${serviceFilter}` });
  if (selectedFacilities.length > 0) {
    activeCriteria.push({
      key: 'facilities',
      label: `${selectedFacilities.length} Accessibility Facilities`,
      onClear: onClearAccessibility,
    });
  }
  if (selectedLanguages.length > 0) {
    activeCriteria.push({
      key: 'languages',
      label: `${selectedLanguages.length} Spoken Languages`,
      onClear: onClearAccessibility,
    });
  }

  return (
    <div
      className="nearby-offices-empty-state glass-panel"
      role="region"
      aria-labelledby="nearby-offices-empty-title"
      style={{
        padding: '2.5rem 1.75rem',
        textAlign: 'center',
        borderRadius: '1.25rem',
        border: '1px dashed var(--border-light)',
        background: 'var(--glass-bg)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(56, 189, 248, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem',
          color: 'var(--accent-main)',
        }}
      >
        <Building2 size={32} aria-hidden="true" />
      </div>

      <h3
        id="nearby-offices-empty-title"
        style={{
          fontSize: '1.35rem',
          fontWeight: '800',
          marginBottom: '0.65rem',
          color: 'var(--text-primary)',
        }}
      >
        No Matching Civic Facilitation Centers
      </h3>

      <p
        style={{
          color: 'var(--text-secondary)',
          maxWidth: '540px',
          margin: '0 auto 1.5rem',
          fontSize: '0.94rem',
          lineHeight: '1.6',
        }}
      >
        {userCoords
          ? `We could not find any facilitation centers within ${maxRadiusKm} km matching your current criteria. Consider expanding your radius or removing restrictive filters.`
          : 'No centers match all active criteria. Without GPS location, results rely on state/district or keywords. Try relaxing one or more filter requirements.'}
      </p>

      {/* Breakdown of Active Restrictive Filters */}
      {activeCriteria.length > 0 && (
        <div
          style={{
            maxWidth: '560px',
            margin: '0 auto 1.5rem',
            padding: '1rem',
            background: 'var(--bg-main)',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light)',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--text-tertiary)',
              marginBottom: '0.65rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <SlidersHorizontal size={14} aria-hidden="true" />
            <span>Active filters narrowing these results:</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {activeCriteria.map((item) => (
              <span
                key={item.key}
                style={{
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '99px',
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actionable Suggestion Cards & Reset Buttons */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {userCoords && onExpandRadius && maxRadiusKm < 200 && (
          <button
            type="button"
            onClick={onExpandRadius}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.55rem 1.15rem',
              borderRadius: '99px',
              fontSize: '0.88rem',
              fontWeight: '600',
            }}
          >
            <Compass size={16} color="var(--accent-main)" aria-hidden="true" />
            <span>Expand search radius to {maxRadiusKm + 50} km</span>
          </button>
        )}

        {searchQuery && onClearSearch && (
          <button
            type="button"
            onClick={onClearSearch}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.55rem 1.15rem',
              borderRadius: '99px',
              fontSize: '0.88rem',
              fontWeight: '600',
            }}
          >
            <Search size={16} aria-hidden="true" />
            <span>Clear search text</span>
          </button>
        )}

        <button
          type="button"
          onClick={onResetFilters}
          className="btn btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0.55rem 1.25rem',
            borderRadius: '99px',
            fontSize: '0.88rem',
            fontWeight: '600',
          }}
        >
          <RotateCcw size={16} aria-hidden="true" />
          <span>Reset all filters</span>
        </button>
      </div>
    </div>
  );
};

export default NearbyOfficesEmptyState;
