import { CalendarRange } from 'lucide-react';
import { safeHttpUrl } from '../../utils/safeContent';
import { findOverlaps, getWindowViews, todayIso } from '../../services/applicationWindowService';

// Application intake windows for the service details page (#256). Renders nothing when the
// record has no intake-window data, so existing pages are unchanged.
const IntakeWindowPanel = ({ service, today = todayIso() }) => {
  const views = getWindowViews(service, today);
  if (views.length === 0) return null;
  const overlaps = findOverlaps(service.intakeWindows);

  return (
    <section className="intake-panel" aria-labelledby="intake-heading">
      <h2 id="intake-heading" className="intake-panel__title">
        <CalendarRange size={18} aria-hidden="true" /> Application intake windows
      </h2>
      <p className="intake-panel__intro">
        When applications are accepted. This is not an office appointment, an application deadline or a personal reminder.
      </p>
      {overlaps.length > 0 && (
        <p className="intake-panel__warning" role="note">
          Some of these rounds overlap. Check the official notice for which one applies to you.
        </p>
      )}
      <ul className="intake-panel__list">
        {views.map((v, i) => (
          <li key={i} className={`intake-window intake-window--${v.state}`}>
            <p className="intake-window__head">
              {v.label && <span className="intake-window__name">{v.label}</span>}
              <span className="intake-window__state">{v.stateLabel}</span>
              {!v.confirmed && <span className="intake-window__unconfirmed">Not confirmed</span>}
            </p>
            <p className="intake-window__range">{v.rangeText}</p>
            <p className="intake-window__meta">
              Source:{' '}
              {safeHttpUrl(v.notice.url) ? (
                <a href={safeHttpUrl(v.notice.url)} target="_blank" rel="noopener noreferrer">
                  {v.notice.title || v.notice.url}
                </a>
              ) : (
                v.notice.title || 'not provided'
              )}
            </p>
            <p className="intake-window__meta">{v.reviewNote}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default IntakeWindowPanel;
