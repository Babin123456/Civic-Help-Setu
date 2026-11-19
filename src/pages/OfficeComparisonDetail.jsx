import { useEffect, useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  Accessibility,
  ArrowLeft,
  Clock,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import ComparisonStatePanel from '../components/location/ComparisonStatePanel';
import ComparisonSourceLink from '../components/location/ComparisonSourceLink';
import OfficeReportForm from '../components/location/OfficeReportForm';
import { getServiceById } from '../services/serviceCatalog';
import {
  ACCESSIBILITY_KEYS,
  COMPARISON_MATCH_STATUS,
  getOfficeComparisonRecord,
} from '../services/officeComparisonService';
import './ComparisonWorkspace.css';

const accessibilityLabel = (value) => {
  if (value === true) return 'Available';
  if (value === false) return 'Not available';
  return 'Unknown';
};

const matchIcon = (status) => {
  if (status === COMPARISON_MATCH_STATUS.VERIFIED_MATCH) return <ShieldCheck size={17} aria-hidden="true" />;
  return <Sparkles size={17} aria-hidden="true" />;
};

const OfficeComparisonDetail = () => {
  const { officeId } = useParams();
  const routerLocation = useLocation();
  const serviceId = useMemo(
    () => new URLSearchParams(routerLocation.search).get('service') || '',
    [routerLocation.search]
  );
  const service = useMemo(() => (serviceId ? getServiceById(serviceId) : null), [serviceId]);
  const record = useMemo(
    () => getOfficeComparisonRecord(officeId, service),
    [officeId, service]
  );
  const reportRequested = useMemo(
    () => new URLSearchParams(routerLocation.search).get('report') === '1',
    [routerLocation.search]
  );

  // The comparison table's "Report outdated" action links here with ?report=1.
  // Move focus to the report form so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (!reportRequested) return;
    const target = document.getElementById('office-report');
    if (!target) return;
    const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    target.scrollIntoView?.({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
    target.focus?.({ preventScroll: true });
  }, [reportRequested]);

  const backHref = serviceId
    ? `/comparison?service=${encodeURIComponent(serviceId)}`
    : '/comparison';

  if (!record) {
    return (
      <div className="section comparison-page">
        <div className="container comparison-page__container">
          <ComparisonStatePanel
            status="empty"
            title="Office record not found"
            message="The office ID is unknown or the record was removed from the local registry."
          />
          <Link className="btn btn-secondary" to={backHref}>
            <ArrowLeft size={15} aria-hidden="true" /> Back to comparison
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="section comparison-page">
      <div className="container comparison-page__container comparison-detail">
        <nav aria-label="Breadcrumb" className="comparison-detail__breadcrumb">
          <Link to={backHref}>
            <ArrowLeft size={15} aria-hidden="true" /> Back to comparison
          </Link>
        </nav>

        <header className="comparison-detail__header">
          <span className="comparison-card__eyebrow">{record.type}</span>
          <h1>{record.name}</h1>
          <p>
            <MapPin size={15} aria-hidden="true" /> {record.address}
            {record.district !== 'Unknown' ? `, ${record.district}` : ''}
            {record.state !== 'Unknown' ? `, ${record.state}` : ''}
            {record.pincode !== 'Unknown' ? ` – ${record.pincode}` : ''}
          </p>
          <p className="comparison-detail__draft-note">
            This page shows the local office record. It is not a government application status, receipt or approval.
          </p>
        </header>

        <section className={`comparison-card__match comparison-card__match--${record.match.tone}`} aria-labelledby="detail-match-heading">
          <h2 id="detail-match-heading">
            {matchIcon(record.match.status)} {record.match.label}
          </h2>
          <span className="comparison-card__suggestion">
            <Sparkles size={12} aria-hidden="true" /> Suggestion, not an official decision
          </span>
          <p>{record.match.explanation}</p>
          <ul>
            {record.match.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p className="comparison-card__data-version">
            Rule-based explanation · data version {record.match.dataVersion}
          </p>
          <ComparisonSourceLink source={record.match.catalogSource} label="Service catalogue source" />
        </section>

        <div className="comparison-detail__grid">
          <section className="glass-panel comparison-detail__panel" aria-labelledby="detail-documents-heading">
            <h2 id="detail-documents-heading">Documents the service guide lists</h2>
            {service && Array.isArray(service.documents) && service.documents.length > 0 ? (
              <>
                <ul className="comparison-document-list">
                  {service.documents.map((document) => (
                    <li key={document}>{document}</li>
                  ))}
                </ul>
                <p className="comparison-unknown">
                  This is the service guide checklist, not a guarantee. The office may ask for additional proof or a
                  different format; confirm before travelling.
                </p>
                <ComparisonSourceLink source={record.match.catalogSource} label="Service guide source" />
              </>
            ) : (
              <p className="comparison-unknown">
                Unknown — the selected service guide has no document checklist, or no service is selected.
              </p>
            )}
          </section>

          <section className="glass-panel comparison-detail__panel" aria-labelledby="detail-services-heading">
            <h2 id="detail-services-heading">Recorded service capabilities</h2>
            {record.capabilities.length > 0 ? (
              <ul className="comparison-capability-list">
                {record.capabilities.map((capability) => (
                  <li key={capability.id}>
                    <span className={`comparison-chip ${capability.requested ? 'is-requested' : ''}`}>
                      {capability.name}
                      {!capability.known && <span className="comparison-chip__note">catalogue link unknown</span>}
                    </span>
                    <ComparisonSourceLink source={capability.source} label="Capability source" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="comparison-unknown">Unknown — no service IDs are recorded for this office.</p>
            )}
          </section>

          <section className="glass-panel comparison-detail__panel" aria-labelledby="detail-contact-heading">
            <h2 id="detail-contact-heading">
              <Phone size={17} aria-hidden="true" /> Official contact channels
            </h2>
            {record.contact.channels.length > 0 ? (
              <ul className="comparison-detail-list">
                {record.contact.channels.map((channel) => (
                  <li key={channel.kind}>
                    <strong>{channel.label}</strong>
                    <a href={channel.href} target={channel.kind === 'portal' ? '_blank' : undefined} rel="noopener noreferrer">
                      {channel.value}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="comparison-unknown">Unknown — no contact channel is recorded.</p>
            )}
            <p className={`comparison-verification comparison-verification--${record.contact.verificationStatus}`}>
              {record.contact.verified
                ? `Contact recorded in a verified source (${record.verification.reviewDate})`
                : 'Contact verification unknown'}
            </p>
            <ComparisonSourceLink source={record.contact.source} label="Contact source" />
          </section>

          <section className="glass-panel comparison-detail__panel" aria-labelledby="detail-access-heading">
            <h2 id="detail-access-heading">
              <Accessibility size={17} aria-hidden="true" /> Accessibility evidence
            </h2>
            <ul className="comparison-detail-list">
              {ACCESSIBILITY_KEYS.map(([key, label]) => (
                <li key={key}>
                  <span>{label}</span>
                  <strong>{accessibilityLabel(record.accessibility.values[key])}</strong>
                </li>
              ))}
            </ul>
            {record.accessibility.verificationStatus === 'unknown' ? (
              <p className="comparison-unknown">
                No dated accessibility evidence is recorded. Do not assume a facility is available.
              </p>
            ) : (
              <ComparisonSourceLink source={record.accessibility.source} label="Accessibility source" />
            )}
          </section>

          <section className="glass-panel comparison-detail__panel" aria-labelledby="detail-verification-heading">
            <h2 id="detail-verification-heading">Verification and jurisdiction</h2>
            <dl className="comparison-detail__facts">
              <div>
                <dt>Last verified</dt>
                <dd>{record.verification.reviewDate || 'Unknown'}</dd>
              </div>
              <div>
                <dt>Verification status</dt>
                <dd>{record.verification.label}</dd>
              </div>
              <div>
                <dt>Office jurisdiction</dt>
                <dd>{record.jurisdiction.officeLabel}</dd>
              </div>
              <div>
                <dt>Service guide jurisdiction</dt>
                <dd>{record.jurisdiction.serviceLabel}</dd>
              </div>
              <div>
                <dt>Map pin</dt>
                <dd>{record.coordinates.verified ? 'Verified coordinates' : 'Not shown — coordinates are not verified'}</dd>
              </div>
              <div>
                <dt>Record source</dt>
                <dd>{record.source?.name || 'Unknown'}</dd>
              </div>
            </dl>
            <ComparisonSourceLink source={record.verification.source} label="Verification source" />
          </section>

          <section className="glass-panel comparison-detail__panel" aria-labelledby="detail-hours-heading">
            <h2 id="detail-hours-heading">
              <Clock size={17} aria-hidden="true" /> Recorded hours
            </h2>
            {record.raw.officeHours?.hours ? (
              <>
                <p>
                  <strong>{record.raw.officeHours.days || 'Days unknown'}:</strong>{' '}
                  {record.raw.officeHours.hours}
                </p>
                <p className="comparison-unknown">
                  These are recorded hours, not a live open/closed status. Call the office or check the official portal
                  before travelling.
                </p>
              </>
            ) : (
              <p className="comparison-unknown">Unknown — no office hours are recorded.</p>
            )}
          </section>
        </div>

        <OfficeReportForm office={record} cancelHref={backHref} />
      </div>
    </div>
  );
};

export default OfficeComparisonDetail;
