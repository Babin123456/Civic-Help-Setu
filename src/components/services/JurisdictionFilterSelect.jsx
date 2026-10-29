import { MapPin } from 'lucide-react';
import { INDIAN_STATES_AND_UTS } from '../../data/jurisdictions';

// Filter by the place a service applies to. Services with an unverified scope are hidden once a
// state is chosen, because "not specified" does not mean "available everywhere".
const JurisdictionFilterSelect = ({
  state = 'All',
  district = 'All',
  districtOptions = [],
  onStateChange = () => {},
  onDistrictChange = () => {},
}) => (
  <div className="jurisdiction-filter">
    <MapPin size={16} color="var(--text-tertiary)" aria-hidden="true" />
    <select
      value={state}
      onChange={(e) => onStateChange(e.target.value)}
      aria-label="Filter by state or Union Territory"
      className="input-field jurisdiction-filter__select"
    >
      <option value="All">All places</option>
      {INDIAN_STATES_AND_UTS.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
    {districtOptions.length > 0 && (
      <select
        value={district}
        onChange={(e) => onDistrictChange(e.target.value)}
        aria-label="Filter by district"
        className="input-field jurisdiction-filter__select"
      >
        <option value="All">All districts</option>
        {districtOptions.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
    )}
  </div>
);

export default JurisdictionFilterSelect;
