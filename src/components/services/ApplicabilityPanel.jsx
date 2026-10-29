import { MapPin } from 'lucide-react';
import { getApplicabilityDetails } from '../../services/jurisdictionService';

// Applicability panel for the service details page (#260).
const ApplicabilityPanel = ({ service }) => {
  const details = getApplicabilityDetails(service);
  return (
    <section className={`applicability-panel applicability-panel--${details.level}`} aria-labelledby="applicability-heading">
      <h2 id="applicability-heading" className="applicability-panel__title">
        <MapPin size={18} aria-hidden="true" /> Where this service applies
      </h2>
      <p className="applicability-panel__level">
        <span className="applicability-panel__label">Scope</span> {details.levelLabel}
      </p>
      <p className="applicability-panel__summary">{details.summary}</p>
      {details.rows.length > 0 && (
        <dl className="applicability-panel__rows">
          {details.rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
};

export default ApplicabilityPanel;
