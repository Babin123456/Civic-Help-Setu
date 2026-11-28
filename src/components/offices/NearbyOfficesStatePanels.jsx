import React from 'react';
import {
  MapPin,
  MapPinOff,
  Search,
  SlidersHorizontal,
  Compass,
  AlertCircle,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import './NearbyOfficesStatePanels.css';

export function LocationPermissionPanel({
  onRequestLocation,
  onSwitchToManual,
  isDenied = false,
  isPrompting = false
}) {
  return (
    <section
      className={`nosp-card ${isDenied ? 'nosp-card-denied' : 'nosp-card-prompt'}`}
      role="region"
      aria-label="Location services configuration"
    >
      <div className="nosp-icon-wrapper" aria-hidden="true">
        {isDenied ? <MapPinOff size={28} /> : <Compass size={28} />}
      </div>

      <div className="nosp-content">
        <h3 className="nosp-title">
          {isDenied
            ? 'Location Access Unavailable'
            : 'Find Government Centres Near You'}
        </h3>
        <p className="nosp-description">
          {isDenied
            ? 'Browser location permissions are turned off or denied. Don’t worry! You can still explore the entire directory using manual district and state filters.'
            : 'Sharing your approximate coordinates allows us to sort Seva Kendras, SDM offices, and municipal zones by straight-line distance.'}
        </p>

        <div className="nosp-actions">
          {!isDenied && (
            <button
              type="button"
              className="nosp-btn nosp-btn-primary"
              onClick={onRequestLocation}
              disabled={isPrompting}
            >
              <MapPin size={16} aria-hidden="true" />
              <span>{isPrompting ? 'Requesting...' : 'Use Current Location'}</span>
            </button>
          )}

          <button
            type="button"
            className={`nosp-btn ${isDenied ? 'nosp-btn-primary' : 'nosp-btn-secondary'}`}
            onClick={onSwitchToManual}
          >
            <Search size={16} aria-hidden="true" />
            <span>Search by State &amp; District</span>
          </button>
        </div>

        <div className="nosp-privacy-note">
          <HelpCircle size={14} aria-hidden="true" />
          <span>Your coordinates remain strictly inside your browser and are never stored on external servers.</span>
        </div>
      </div>
    </section>
  );
}

export function NoOfficesResultsPanel({
  activeFilters = { state: '', district: '', officeType: '' },
  onResetFilters,
  onBroadenRadius
}) {
  return (
    <section className="nosp-card nosp-card-empty" role="status" aria-label="No matching offices found">
      <div className="nosp-icon-wrapper nosp-empty-icon" aria-hidden="true">
        <Search size={28} />
      </div>

      <div className="nosp-content">
        <h3 className="nosp-title">No Matching Civic Offices Found</h3>
        <p className="nosp-description">
          We couldn’t find any verified government offices or seva centres matching your active filter combination.
        </p>

        <div className="nosp-active-filters-box">
          <span className="nosp-filters-header">Current Search Filters:</span>
          <div className="nosp-filter-tags">
            {activeFilters.state && <span className="nosp-tag">State: {activeFilters.state}</span>}
            {activeFilters.district && <span className="nosp-tag">District: {activeFilters.district}</span>}
            {activeFilters.officeType && <span className="nosp-tag">Type: {activeFilters.officeType}</span>}
            {!activeFilters.state && !activeFilters.district && !activeFilters.officeType && (
              <span className="nosp-tag-none">Radius Search with no records in range</span>
            )}
          </div>
        </div>

        <div className="nosp-actions">
          <button type="button" className="nosp-btn nosp-btn-primary" onClick={onResetFilters}>
            <SlidersHorizontal size={16} aria-hidden="true" />
            <span>Reset All Filters</span>
          </button>
          {onBroadenRadius && (
            <button type="button" className="nosp-btn nosp-btn-secondary" onClick={onBroadenRadius}>
              <span>Expand Search Radius (25km)</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
