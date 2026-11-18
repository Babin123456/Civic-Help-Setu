import { Search, SlidersHorizontal } from 'lucide-react';
import {
  TREE_CONDITIONS,
  TREE_CONDITION_LABELS,
  TREE_STATUS,
  TREE_STATUS_LABELS,
} from '../../services/treeInventoryConstants';

const fieldsetStyle = {
  border: '1px solid var(--border-main)',
  borderRadius: '0.85rem',
  padding: '0.9rem 1rem 1rem',
  margin: 0,
  background: 'var(--surface-raised, var(--glass-bg))',
};

const labelStyle = { display: 'grid', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' };
const controlStyle = { width: '100%', minHeight: '2.5rem', fontSize: '0.9rem' };

/**
 * Shared, keyboard-friendly filter form. It only emits a new filter object; the
 * page passes it to the service layer.
 */
export default function TreeInventoryFilters({
  filters = {},
  onChange,
  onReset,
  jurisdictions = [],
  wards = [],
  species = [],
  mode = 'public',
  resultCount = null,
}) {
  const set = (field, value) => onChange?.({ ...filters, [field]: value, page: 1 });
  const isStaff = mode === 'staff';

  return (
    <fieldset style={fieldsetStyle}>
      <legend style={{ padding: '0 0.4rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <SlidersHorizontal size={16} aria-hidden="true" /> Filter the tree register
      </legend>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <label style={labelStyle}>
          Municipal jurisdiction
          <select
            className="form-input"
            style={controlStyle}
            value={filters.jurisdictionId || ''}
            onChange={(event) => set('jurisdictionId', event.target.value)}
          >
            <option value="">All supported jurisdictions</option>
            {jurisdictions.map((jurisdiction) => (
              <option key={jurisdiction.id} value={jurisdiction.id}>
                {jurisdiction.name} — {jurisdiction.state}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Ward
          <select className="form-input" style={controlStyle} value={filters.ward || ''} onChange={(event) => set('ward', event.target.value)}>
            <option value="">All wards</option>
            {wards.map((ward) => (
              <option key={ward} value={ward}>
                {ward}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Species
          <select className="form-input" style={controlStyle} value={filters.speciesId || ''} onChange={(event) => set('speciesId', event.target.value)}>
            <option value="">All species</option>
            {species.map((item) => (
              <option key={item.id} value={item.id}>
                {item.commonName} ({item.scientificName})
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Condition
          <select className="form-input" style={controlStyle} value={filters.condition || ''} onChange={(event) => set('condition', event.target.value)}>
            <option value="">All conditions</option>
            {Object.values(TREE_CONDITIONS).map((condition) => (
              <option key={condition} value={condition}>
                {TREE_CONDITION_LABELS[condition]}
              </option>
            ))}
          </select>
        </label>

        {isStaff && (
          <>
            <label style={labelStyle}>
              Lifecycle status
              <select className="form-input" style={controlStyle} value={filters.status || ''} onChange={(event) => set('status', event.target.value)}>
                <option value="">All statuses</option>
                {Object.values(TREE_STATUS).map((status) => (
                  <option key={status} value={status}>
                    {TREE_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Inspection due
              <select
                className="form-input"
                style={controlStyle}
                value={filters.inspectionDue || 'all'}
                onChange={(event) => set('inspectionDue', event.target.value)}
              >
                <option value="all">Any inspection date</option>
                <option value="overdue">Overdue only</option>
                <option value="due_7">Due within 7 days</option>
                <option value="due_30">Due within 30 days</option>
                <option value="unscheduled">No inspection date</option>
              </select>
            </label>
            <label style={labelStyle}>
              Sort by
              <select className="form-input" style={controlStyle} value={filters.sort || 'updated'} onChange={(event) => set('sort', event.target.value)}>
                <option value="updated">Recently updated</option>
                <option value="due">Inspection due date</option>
                <option value="condition">Worst condition first</option>
              </select>
            </label>
          </>
        )}

        <label style={{ ...labelStyle, gridColumn: 'span 2', minWidth: 0 }}>
          Search within approved fields
          <span style={{ position: 'relative', display: 'block' }}>
            <Search size={16} aria-hidden="true" style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              className="form-input"
              type="search"
              style={{ ...controlStyle, paddingLeft: '2rem' }}
              value={filters.search || ''}
              maxLength={120}
              placeholder="Public tree ID, ward, locality or species"
              onChange={(event) => set('search', event.target.value)}
              aria-describedby="tree-filter-search-help"
            />
          </span>
          <span id="tree-filter-search-help" style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>
            Public searches never include private notes or precise coordinates.
          </span>
        </label>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center', marginTop: '0.85rem' }}>
        <button type="button" className="btn btn-secondary" onClick={onReset}>
          Reset all filters
        </button>
        {resultCount !== null && (
          <p role="status" style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            {resultCount} record{resultCount === 1 ? '' : 's'} match.
          </p>
        )}
      </div>
    </fieldset>
  );
}
