import { ExternalLink } from 'lucide-react';
import { safeHttpUrl } from '../../utils/safeContent';

/**
 * A capability or contact claim must point at the record that supports it.
 * When no URL is recorded the component says so instead of inventing one.
 */
const ComparisonSourceLink = ({ source, label = 'Source', className = '' }) => {
  const url = safeHttpUrl(source?.url);

  if (!url) {
    return (
      <span className={`comparison-source comparison-source--missing ${className}`.trim()}>
        {label}: not recorded
      </span>
    );
  }

  const sourceName = source?.name || 'official source';
  const verification = source?.verified
    ? source?.verifiedOn
      ? `, verified ${source.verifiedOn}`
      : ', verified'
    : ', mapping unverified';

  return (
    <a
      className={`comparison-source ${className}`.trim()}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label}: ${sourceName}${verification} (opens in a new tab)`}
    >
      <ExternalLink size={12} aria-hidden="true" />
      <span>
        {label}: {sourceName}
        {verification}
      </span>
    </a>
  );
};

export default ComparisonSourceLink;
