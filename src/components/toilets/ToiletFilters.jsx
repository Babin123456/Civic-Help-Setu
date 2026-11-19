import { Search, RotateCcw, Filter } from 'lucide-react';
import { CATEGORY_LABELS } from '../../data/publicToiletContract';

export default function ToiletFilters({
  filters,
  onChange,
  onReset,
}) {
  const handleInputChange = (field, value) => {
    onChange({ ...filters, [field]: value });
  };

  const handleCheckboxToggle = (field) => {
    onChange({ ...filters, [field]: !filters[field] });
  };

  return (
    <section
      aria-label="Filter Public Sanitation Facilities"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-main)',
        borderRadius: '1rem',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <Filter size={16} style={{ color: 'var(--primary-main)' }} />
          Search & Facility Filters
        </h2>
        <button
          type="button"
          onClick={onReset}
          className="btn btn-outline"
          style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        {/* Keyword Search */}
        <div>
          <label htmlFor="toilet-search-input" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
            Search by Name, Ward or Landmark
          </label>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              id="toilet-search-input"
              type="search"
              value={filters.searchQuery || ''}
              onChange={(e) => handleInputChange('searchQuery', e.target.value)}
              placeholder="e.g. Koramangala, Metro, Ward 150..."
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem 0.55rem 2.2rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-main)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
              }}
            />
          </div>
        </div>

        {/* State Filter */}
        <div>
          <label htmlFor="toilet-state-select" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
            State / Union Territory
          </label>
          <select
            id="toilet-state-select"
            value={filters.state || ''}
            onChange={(e) => handleInputChange('state', e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-main)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          >
            <option value="">All States</option>
            <option value="Karnataka">Karnataka</option>
            <option value="Delhi">Delhi</option>
            <option value="Maharashtra">Maharashtra</option>
            <option value="Telangana">Telangana</option>
          </select>
        </div>

        {/* Facility Category Filter */}
        <div>
          <label htmlFor="toilet-category-select" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
            Facility Category
          </label>
          <select
            id="toilet-category-select"
            value={filters.category || 'all'}
            onChange={(e) => handleInputChange('category', e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-main)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          >
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        {/* Fee Filter */}
        <div>
          <label htmlFor="toilet-fee-select" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
            Fee Structure
          </label>
          <select
            id="toilet-fee-select"
            value={filters.feeType || 'all'}
            onChange={(e) => handleInputChange('feeType', e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-main)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          >
            <option value="all">All Fee Types</option>
            <option value="free">Free Public Facilities Only</option>
            <option value="pay_and_use">Pay & Use Complexes</option>
          </select>
        </div>
      </div>

      {/* Feature Toggles */}
      <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
        <legend style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
          Accessibility & Essential Amenities
        </legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(filters.openNowOnly)}
              onChange={() => handleCheckboxToggle('openNowOnly')}
            />
            Open Now
          </label>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(filters.wheelchairOnly)}
              onChange={() => handleCheckboxToggle('wheelchairOnly')}
            />
            Wheelchair Ramp & Grab Bars
          </label>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(filters.genderNeutralOnly)}
              onChange={() => handleCheckboxToggle('genderNeutralOnly')}
            />
            Gender-Neutral / Third-Gender
          </label>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(filters.babyCareOnly)}
              onChange={() => handleCheckboxToggle('babyCareOnly')}
            />
            Baby Diaper Station
          </label>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(filters.sanitaryNapkinOnly)}
              onChange={() => handleCheckboxToggle('sanitaryNapkinOnly')}
            />
            Sanitary Napkin Dispenser
          </label>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(filters.runningWaterOnly)}
              onChange={() => handleCheckboxToggle('runningWaterOnly')}
            />
            Running Water Confirmed
          </label>
        </div>
      </fieldset>
    </section>
  );
}

