import { MapPin } from 'lucide-react';
import { getApplicabilityLabel, getApplicabilityLevel } from '../../services/jurisdictionService';

// Shows where a service applies. Unknown scope is labelled as unverified, never as nationwide.
const ApplicabilityBadge = ({ service }) => {
  const level = getApplicabilityLevel(service);
  return (
    <span className={`applicability-badge applicability-badge--${level}`}>
      <MapPin size={12} aria-hidden="true" />
      <span className="sr-only">Applies to: </span>
      {getApplicabilityLabel(service)}
    </span>
  );
};

export default ApplicabilityBadge;
