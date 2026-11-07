import { useState } from 'react';
import {
  MapPin,
  Search,
  Navigation,
  SlidersHorizontal,
  X,
  Compass,
  Building2,
  Globe,
  Phone,
  Check,
} from 'lucide-react';
import { getAvailableStates, getDistrictsByState } from '../../services/locationService';

const LocationFilterToolbar = ({
  searchQuery,
  onSearchChange,
  selectedState,
  onStateChange,
  selectedDistrict,
  onDistrictChange,
  selectedChannel,
  onChannelChange,
  maxRadiusKm,
  onRadiusChange,
  onlyOpenNow,
  onOpenNowChange,
  onlyWheelchair,
  onWheelchairChange,
  userCoords,
  onRequestLocation,
  onClearLocation,
  isLocating,
  onResetFilters,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const states = getAvailableStates();
  const districts = getDistrictsByState(selectedState);

  const channels = [
    { id: 'all', label: 'All Channels', icon: Building2 },
    { id: 'in-person', label: 'In-Person Centers', icon: Building2 },
    { id: 'online', label: 'Online Portals', icon: Globe },
    { id: 'phone', label: 'Phone Helplines', icon: Phone },
  ];

  return (
    <div
      className="glass-panel"
      style={{
        padding: '1.5rem',
        borderRadius: '1rem',
        marginBottom: '2rem',
        border: '1px solid var(--border-main)',
      }}
    >
      {/* Top Row: Search Input & Current Location Trigger */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
          gap: '1rem',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        {/* Full-text search */}
        <div style={{ position: 'relative' }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
            }}
          />
          <input
            type="text"
            id="office-locality-search"
            aria-label="Search offices by name, locality, city or PIN code"
            placeholder="Search by center name, landmark, area, or PIN..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="input-field"
            style={{
              paddingLeft: '2.75rem',
              paddingRight: searchQuery ? '2.5rem' : '1rem',
              width: '100%',
              borderRadius: '0.6rem',
              background: 'var(--bg-main)',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* GPS Location Button */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {userCoords ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.55rem 0.85rem',
                borderRadius: '0.6rem',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: 'var(--accent-main)',
                fontSize: '0.85rem',
                fontWeight: '600',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Navigation size={15} /> Location Active ({userCoords.lat.toFixed(2)}°, {userCoords.lng.toFixed(2)}°)
              </span>
              <button
                type="button"
                onClick={onClearLocation}
                title="Clear GPS location"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onRequestLocation}
              disabled={isLocating}
              className="btn btn-secondary"
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontSize: '0.9rem',
                padding: '0.65rem 1rem',
                borderRadius: '0.6rem',
              }}
            >
              <Navigation size={16} color="var(--accent-main)" />
              {isLocating ? 'Detecting Location...' : 'Use Current Location'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="btn"
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: '0.6rem',
              background: showAdvanced ? 'var(--accent-main)' : 'var(--glass-bg)',
              color: showAdvanced ? '#ffffff' : 'var(--text-primary)',
              border: '1px solid var(--border-light)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            <SlidersHorizontal size={16} /> Filters
          </button>
        </div>
      </div>

      {/* Channel Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          marginBottom: showAdvanced ? '1.25rem' : '0',
          paddingBottom: showAdvanced ? '1rem' : '0',
          borderBottom: showAdvanced ? '1px solid var(--border-light)' : 'none',
        }}
      >
        {channels.map((chan) => {
          const Icon = chan.icon;
          const isActive = selectedChannel === chan.id;
          return (
            <button
              key={chan.id}
              type="button"
              onClick={() => onChannelChange(chan.id)}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '99px',
                fontSize: '0.8rem',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: isActive ? 'var(--accent-main)' : 'var(--glass-bg)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                border: isActive ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
              }}
            >
              <Icon size={14} />
              {chan.label}
            </button>
          );
        })}
      </div>

      {/* Advanced Filter Collapsible Section */}
      {showAdvanced && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '1.25rem', paddingTop: '0.5rem' }}>
          {/* State Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              State / Region
            </label>
            <select
              id="office-state-select"
              aria-label="Filter offices by State or Region"
              value={selectedState}
              onChange={(e) => onStateChange(e.target.value)}
              className="input-field"
              style={{ width: '100%', borderRadius: '0.5rem', padding: '0.5rem', background: 'var(--bg-main)' }}
            >
              <option value="">All States (Pan-India)</option>
              {states.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* District Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              District
            </label>
            <select
              value={selectedDistrict}
              onChange={(e) => onDistrictChange(e.target.value)}
              disabled={!selectedState}
              className="input-field"
              style={{
                width: '100%',
                borderRadius: '0.5rem',
                padding: '0.5rem',
                background: 'var(--bg-main)',
                opacity: selectedState ? 1 : 0.6,
              }}
            >
              <option value="">All Districts</option>
              {districts.map((dst) => (
                <option key={dst} value={dst}>
                  {dst}
                </option>
              ))}
            </select>
          </div>

          {/* Radius Range Slider (when GPS or coords available) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Search Radius
              </label>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-main)' }}>
                Within {maxRadiusKm} km
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="150"
              step="5"
              value={maxRadiusKm}
              onChange={(e) => onRadiusChange(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-main)', cursor: 'pointer' }}
            />
          </div>

          {/* Feature Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={onlyOpenNow}
                onChange={(e) => onOpenNowChange(e.target.checked)}
                style={{ accentColor: 'var(--accent-main)' }}
              />
              Show Only Centers Open Now
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={onlyWheelchair}
                onChange={(e) => onWheelchairChange(e.target.checked)}
                style={{ accentColor: 'var(--accent-main)' }}
              />
              Wheelchair Accessible Only
            </label>
          </div>

          {/* Reset Filters */}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="button"
              onClick={onResetFilters}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-tertiary)',
                fontSize: '0.8rem',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: '0.5rem 0',
              }}
            >
              Reset All Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationFilterToolbar;
