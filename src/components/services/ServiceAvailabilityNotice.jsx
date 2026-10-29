import { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import {
  getActiveNoticesForService,
  formatNoticeTime,
  NOTICE_TIME_ZONE_LABEL,
} from '../../services/serviceAvailabilityNoticeService';
import { safeHttpUrl } from '../../utils/safeContent';

/**
 * One availability notice as citizens (and the admin preview) see it. Pure markup, no state.
 * "Confirmed" appears only when the notice is backed by an official announcement link.
 */
export const AvailabilityNoticeCard = ({ notice, serviceName = '', headingLevel = 'h2' }) => {
  const Heading = headingLevel;
  const href = safeHttpUrl(notice.sourceUrl);
  const confirmed = notice.confirmed === true && Boolean(href);
  const startText = formatNoticeTime(notice.startsAt);
  const endText = notice.ongoing ? '' : formatNoticeTime(notice.endsAt);

  return (
    <aside className="avail-notice" aria-labelledby={`avail-${notice.id}`}>
      <div className="avail-notice__head">
        <AlertTriangle size={18} aria-hidden="true" />
        <Heading id={`avail-${notice.id}`} className="avail-notice__title">
          {serviceName ? `${serviceName}: possible disruption` : 'Possible disruption'}
        </Heading>
        <span className={`avail-notice__tag${confirmed ? ' avail-notice__tag--confirmed' : ''}`}>
          {confirmed ? 'Confirmed by official announcement' : 'Not yet confirmed'}
        </span>
      </div>
      <p className="avail-notice__message">{notice.message}</p>
      <dl className="avail-notice__meta">
        <div>
          <dt>From</dt>
          <dd>{startText}</dd>
        </div>
        <div>
          <dt>Until</dt>
          <dd>{notice.ongoing ? 'Ongoing, no end time announced' : endText}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {notice.sourceName}
                <ExternalLink size={12} aria-hidden="true" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              notice.sourceName
            )}
          </dd>
        </div>
        <div>
          <dt>Last updated</dt>
          <dd>{formatNoticeTime(notice.updatedAt)}</dd>
        </div>
      </dl>
      <p className="avail-notice__foot">
        Added by hand by the site team, not checked automatically. All times are in {NOTICE_TIME_ZONE_LABEL}.
        Check the official source before you rely on it.
      </p>
    </aside>
  );
};

/** Shows every notice that is active right now for a service, and drops them when they expire. */
const ServiceAvailabilityNotice = ({ serviceId, serviceName }) => {
  const [notices, setNotices] = useState(() => getActiveNoticesForService(serviceId));

  useEffect(() => {
    const refresh = () => setNotices(getActiveNoticesForService(serviceId));
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => clearInterval(timer);
  }, [serviceId]);

  if (notices.length === 0) return null;
  return (
    <div className="avail-notice-list">
      {notices.map((notice) => (
        <AvailabilityNoticeCard key={notice.id} notice={notice} serviceName={serviceName} />
      ))}
    </div>
  );
};

export default ServiceAvailabilityNotice;
