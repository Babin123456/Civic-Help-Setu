import { useId } from 'react';
import { AlertCircle, Inbox, LoaderCircle, MapPinOff, RotateCcw } from 'lucide-react';

/**
 * Accessible state panel for the comparison workspace (#824).
 * Loading uses aria-live="polite"; errors use role="alert". Every state has a
 * readable text alternative and an explicit next action where one exists.
 */
const ComparisonStatePanel = ({
  status = 'loading',
  title,
  message,
  onRetry,
  onReset,
  onRequestLocation,
  requestLocationDisabled = false,
}) => {
  const titleId = useId();
  const config = {
    loading: {
      icon: LoaderCircle,
      title: title || 'Loading office records',
      message:
        message ||
        'Reading the local office registry and checking service-capability evidence. No personal data is requested.',
      tone: 'info',
    },
    error: {
      icon: AlertCircle,
      title: title || 'The office records could not be loaded',
      message:
        message ||
        'Try again. If the problem continues, open the Nearby Offices directory and choose an office manually.',
      tone: 'danger',
    },
    empty: {
      icon: Inbox,
      title: title || 'No offices match these filters',
      message:
        message ||
        'Remove a state or district filter, clear the locality search, or choose a different service.',
      tone: 'neutral',
    },
    'permission-denied': {
      icon: MapPinOff,
      title: title || 'Location access is blocked',
      message:
        message ||
        'GPS is optional. You can still compare offices by choosing a state, district, or locality manually.',
      tone: 'warning',
    },
  }[status] || null;

  if (!config) return null;
  const Icon = config.icon;

  return (
    <section
      className={`comparison-state comparison-state--${config.tone}`}
      role={status === 'error' ? 'alert' : 'status'}
      aria-live={status === 'error' ? 'assertive' : 'polite'}
      aria-labelledby={titleId}
    >
      <Icon
        size={28}
        aria-hidden="true"
        className={status === 'loading' ? 'comparison-state__spinner' : ''}
      />
      <div>
        <h2 id={titleId}>{config.title}</h2>
        <p>{config.message}</p>
        <div className="comparison-state__actions">
          {status === 'error' && onRetry && (
            <button type="button" className="btn btn-primary" onClick={onRetry}>
              <RotateCcw size={16} aria-hidden="true" /> Try again
            </button>
          )}
          {status === 'empty' && onReset && (
            <button type="button" className="btn btn-secondary" onClick={onReset}>
              <RotateCcw size={16} aria-hidden="true" /> Reset filters
            </button>
          )}
          {status === 'permission-denied' && onRequestLocation && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onRequestLocation}
              disabled={requestLocationDisabled}
            >
              <RotateCcw size={16} aria-hidden="true" /> Try location again
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default ComparisonStatePanel;
