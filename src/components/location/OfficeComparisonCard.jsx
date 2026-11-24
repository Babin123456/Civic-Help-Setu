import { Link } from 'react-router-dom';
import {
  Accessibility,
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  FileWarning,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import ComparisonSourceLink from './ComparisonSourceLink';
import { ACCESSIBILITY_KEYS, COMPARISON_MATCH_STATUS } from '../../services/officeComparisonService';

const statusIcon = (status) => {
  switch (status) {
    case COMPARISON_MATCH_STATUS.VERIFIED_MATCH:
      return <ShieldCheck size={16} aria-hidden="true" />;
    case COMPARISON_MATCH_STATUS.STALE_MATCH:
      return <AlertTriangle size={16} aria-hidden="true" />;
    case COMPARISON_MATCH_STATUS.REVIEW_REQUIRED:
    case COMPARISON_MATCH_STATUS.CAPABILITY_CONFLICT:
      return <FileWarning size={16} aria-hidden="true" />;
    case COMPARISON_MATCH_STATUS.JURISDICTION_ONLY:
      return <CheckCircle2 size={16} aria-hidden="true" />;
    case COMPARISON_MATCH_STATUS.NOT_MATCHED:
      return <XCircle size={16} aria-hidden="true" />;
    default:
      return <CircleHelp size={16} aria-hidden="true" />;
  }
};

const accessibilityLabel = (value) => {
  if (value === true) return 'Available';
  if (value === false) return 'Not available';
  return 'Unknown';
};

const accessibilityTone = (value) => {
  if (value === true) return 'success';
  if (value === false) return 'muted';
  return 'unknown';
};

/**
 * Responsive comparison card (#824).
 *
 * Essential information (services, jurisdiction, contact verification,
 * accessibility and last verification) is always visible. Nothing depends on
 * hover. The compare control is a native checkbox and every action is a native
 * link or button, so the whole card works from the keyboard.
 */
const OfficeComparisonCard = ({
  office,
  isSelected = false,
  onToggleCompare,
  compareDisabled = false,
  detailHref,
  reportHref,
}) => {
  if (!office) return null;

  const visibleCapabilities = office.capabilities.slice(0, 4);
  const hiddenCapabilityCount = Math.max(0, office.capabilities.length - visibleCapabilities.length);
  const detailLink = detailHref || `/office/${encodeURIComponent(office.id)}`;
  const reportLink =
    reportHref || `${detailLink}${detailLink.includes('?') ? '&' : '?'}report=1`;
  const keyAccessibility = [
    ACCESSIBILITY_KEYS[0],
    ACCESSIBILITY_KEYS[1],
    ACCESSIBILITY_KEYS[2],
    ACCESSIBILITY_KEYS[7],
  ];

  return (
    <article
      className={`comparison-card glass-panel ${isSelected ? 'comparison-card--selected' : ''}`}
      aria-labelledby={`comparison-card-title-${office.id}`}
    >
      <header className="comparison-card__header">
        <div>
          <span className="comparison-card__eyebrow">{office.type}</span>
          <h3 id={`comparison-card-title-${office.id}`}>{office.name}</h3>
          <p className="comparison-card__address">
            <MapPin size={14} aria-hidden="true" />
            <span>
              {office.address}
              {office.district !== 'Unknown' ? `, ${office.district}` : ''}
              {office.state !== 'Unknown' ? `, ${office.state}` : ''}
              {office.pincode !== 'Unknown' ? ` – ${office.pincode}` : ''}
            </span>
          </p>
        </div>

        <label className={`comparison-card__compare ${compareDisabled && !isSelected ? 'is-disabled' : ''}`}>
          <input
            type="checkbox"
            checked={isSelected}
            disabled={compareDisabled && !isSelected}
            onChange={() => onToggleCompare?.(office.id)}
          />
          <span>{isSelected ? 'Selected to compare' : 'Compare'}</span>
        </label>
      </header>

      <div className={`comparison-card__match comparison-card__match--${office.match.tone}`}>
        <strong>
          {statusIcon(office.match.status)}
          <span>{office.match.label}</span>
        </strong>
        <span className="comparison-card__suggestion">
          <Sparkles size={12} aria-hidden="true" /> Suggestion, not an official decision
        </span>
        <p>{office.match.explanation}</p>
        <p className="comparison-card__data-version">
          Rule-based ranking · data version {office.match.dataVersion}
        </p>
      </div>

      <section className="comparison-card__section" aria-labelledby={`services-${office.id}`}>
        <h4 id={`services-${office.id}`}>Service capabilities</h4>
        {visibleCapabilities.length > 0 ? (
          <ul className="comparison-capability-list">
            {visibleCapabilities.map((capability) => (
              <li key={capability.id}>
                <span className={`comparison-chip ${capability.requested ? 'is-requested' : ''}`}>
                  {capability.name}
                  {!capability.known && <span className="comparison-chip__note">catalogue link unknown</span>}
                </span>
                <ComparisonSourceLink source={capability.source} label="Capability source" />
              </li>
            ))}
            {hiddenCapabilityCount > 0 && (
              <li>
                <Link to={detailLink} className="comparison-more-link">
                  +{hiddenCapabilityCount} more recorded service{hiddenCapabilityCount === 1 ? '' : 's'}
                </Link>
              </li>
            )}
          </ul>
        ) : (
          <p className="comparison-unknown">Unknown — no service IDs are recorded for this office.</p>
        )}
      </section>

      <div className="comparison-card__grid">
        <section className="comparison-card__section" aria-labelledby={`jurisdiction-${office.id}`}>
          <h4 id={`jurisdiction-${office.id}`}>Jurisdiction</h4>
          <p className="comparison-badge">{office.jurisdiction.officeLabel}</p>
          <p className="comparison-card__hint">
            Service guide: {office.jurisdiction.serviceLabel}
          </p>
        </section>

        <section className="comparison-card__section" aria-labelledby={`contact-${office.id}`}>
          <h4 id={`contact-${office.id}`}>Official contact</h4>
          {office.contact.channels.length > 0 ? (
            <ul className="comparison-contact-list">
              {office.contact.channels.slice(0, 3).map((channel) => (
                <li key={channel.kind}>
                  <Phone size={13} aria-hidden="true" />
                  <span>{channel.label}:</span>{' '}
                  <a href={channel.href} target={channel.kind === 'portal' ? '_blank' : undefined} rel="noopener noreferrer">
                    {channel.value}
                    {channel.kind === 'portal' && <ExternalLink size={11} aria-hidden="true" />}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="comparison-unknown">Unknown — no contact channel is recorded.</p>
          )}
          <p className={`comparison-verification comparison-verification--${office.contact.verificationStatus}`}>
            {office.contact.verified
              ? `Contact recorded in a verified source (${office.verification.reviewDate})`
              : 'Contact verification unknown'}
          </p>
          <ComparisonSourceLink source={office.contact.source} label="Contact source" />
        </section>

        <section className="comparison-card__section" aria-labelledby={`access-${office.id}`}>
          <h4 id={`access-${office.id}`}>
            <Accessibility size={15} aria-hidden="true" /> Accessibility
          </h4>
          <ul className="comparison-access-list">
            {keyAccessibility.map(([key, label]) => (
              <li key={key} className={`comparison-access comparison-access--${accessibilityTone(office.accessibility.values[key])}`}>
                <span>{label}</span>
                <strong>{accessibilityLabel(office.accessibility.values[key])}</strong>
              </li>
            ))}
          </ul>
          {office.accessibility.verificationStatus === 'unknown' ? (
            <p className="comparison-unknown">
              Accessibility evidence is unknown. Do not assume a facility is available.
            </p>
          ) : (
            <ComparisonSourceLink source={office.accessibility.source} label="Accessibility source" />
          )}
        </section>

        <section className="comparison-card__section" aria-labelledby={`verified-${office.id}`}>
          <h4 id={`verified-${office.id}`}>Last verified</h4>
          <p className={`comparison-verification comparison-verification--${office.verification.status}`}>
            {office.verification.reviewDate || 'Unknown'}
          </p>
          <p className="comparison-card__hint">{office.verification.label}</p>
          <ComparisonSourceLink source={office.verification.source} label="Record source" />
        </section>
      </div>

      <footer className="comparison-card__footer">
        <Link className="btn btn-secondary" to={detailLink}>
          View full record
        </Link>
        <Link className="btn btn-secondary" to={reportLink}>
          <FileWarning size={14} aria-hidden="true" /> Report outdated
        </Link>
        {office.distanceKm != null && (
          <span className="comparison-card__distance">{office.distanceKm.toFixed(1)} km away</span>
        )}
      </footer>
    </article>
  );
};

export default OfficeComparisonCard;
