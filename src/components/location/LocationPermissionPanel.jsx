import { useState } from 'react';
import {
  ShieldCheck,
  Info,
  Search,
  MapPin,
  Compass,
  AlertCircle,
  HelpCircle,
  Navigation,
} from 'lucide-react';
import {
  LOCATION_STATUS,
  canRequestLocation,
  getLocationFailureCopy,
  isFallbackStatus,
} from '../../utils/locationPermission';

export const LOCATION_REQUEST_BUTTON_ID = 'location-request-button';
export const LOCALITY_SEARCH_INPUT_ID = 'office-locality-search';
export const STATE_SELECT_INPUT_ID = 'office-state-select';

const LocationPermissionPanel = ({
  status,
  permissionState = 'unknown',
  onRequestLocation,
  onSelectStateDistrict,
}) => {
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);
  const failure = getLocationFailureCopy(status);
  const fallback = isFallbackStatus(status);
  const requesting = status === LOCATION_STATUS.REQUESTING;
  const canRequest = canRequestLocation({ status, permissionState });
  const isDenied = status === LOCATION_STATUS.DENIED || permissionState === 'denied';

  // Denied but the browser cannot confirm the setting: only offer a deliberate retry.
  const isRetry = fallback && status !== LOCATION_STATUS.UNSUPPORTED;
  const buttonLabel = requesting
    ? 'Detecting location...'
    : !canRequest
      ? 'Location is blocked in browser settings'
      : status === LOCATION_STATUS.DENIED
      ? 'I have allowed it in browser settings, try again'
      : isRetry
        ? 'Try location again'
        : 'Share my location';

  const focusSearch = () => {
    const input = document.getElementById(LOCALITY_SEARCH_INPUT_ID);
    if (input) {
      input.scrollIntoView?.({ block: 'center' });
      input.focus();
    }
  };

  const focusStateDistrict = () => {
    if (onSelectStateDistrict) {
      onSelectStateDistrict();
      return;
    }
    const stateInput = document.getElementById(STATE_SELECT_INPUT_ID);
    if (stateInput) {
      stateInput.scrollIntoView?.({ block: 'center' });
      stateInput.focus();
    } else {
      focusSearch();
    }
  };

  return (
    <section
      className="location-permission-panel location-permission glass-panel"
      aria-labelledby="location-permission-title"
      style={{
        borderRadius: '1rem',
        padding: '1.5rem',
        marginBottom: '1.75rem',
        border: isDenied ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-light)',
        background: isDenied
          ? 'linear-gradient(to right, rgba(245, 158, 11, 0.05), var(--glass-bg))'
          : 'var(--glass-bg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 500px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: isDenied ? '#d97706' : 'var(--accent-main)', fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            {isDenied ? <AlertCircle size={16} aria-hidden="true" /> : <Compass size={16} aria-hidden="true" />}
            <span>{isDenied ? 'Manual Search Active' : 'Automatic Office Proximity'}</span>
          </div>
          <h2
            id="location-permission-title"
            className="location-permission__title"
            style={{
              fontSize: '1.25rem',
              fontWeight: '700',
              margin: '0 0 0.5rem 0',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <ShieldCheck size={20} color="var(--accent-main)" aria-hidden="true" />
            {isDenied ? 'Location access was not granted — you can still find any office' : 'Find offices near you'}
          </h2>
          <p
            className="location-permission__text"
            style={{
              fontSize: '0.92rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.55',
              margin: '0 0 0.75rem 0',
              maxWidth: '720px',
            }}
          >
            {isDenied
              ? 'Permission was denied or blocked in your browser. No problem: Civic Help Setu never blocks you from using the directory. Simply select your State and District or search by landmark, area, or PIN code below.'
              : 'If you choose to share your location, we use it only in this browser to sort offices by distance. It is not sent anywhere and is forgotten when you close the tab. Sharing is optional: you can always search by city, area or PIN code instead.'}
          </p>

          <button
            type="button"
            onClick={() => setShowPrivacyDetails((prev) => !prev)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-main)',
              fontSize: '0.82rem',
              fontWeight: '600',
              cursor: 'pointer',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              textDecoration: 'underline',
              marginBottom: '0.75rem',
            }}
            aria-expanded={showPrivacyDetails}
          >
            <HelpCircle size={13} aria-hidden="true" />
            {showPrivacyDetails ? 'Hide privacy safeguards' : 'Why does Civic Help Setu ask for location?'}
          </button>

          {showPrivacyDetails && (
            <div
              style={{
                background: 'var(--bg-main)',
                border: '1px solid var(--border-light)',
                borderRadius: '0.65rem',
                padding: '0.85rem 1rem',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                lineHeight: '1.5',
                marginBottom: '1rem',
              }}
            >
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.25rem' }}>
                Privacy Safeguards & Zero-Storage Guarantee:
              </strong>
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                <li>Your GPS coordinates remain on your client device only.</li>
                <li>No profile tracking or location logging occurs.</li>
                <li>You can reset or clear cached coordinates at any time with one click.</li>
                <li>Every office in all 28 states and 8 union territories is fully searchable without location permission.</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {failure && (
        <div
          className="location-permission__status"
          role="alert"
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '0.65rem',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            marginTop: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <Info size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
          <div style={{ fontSize: '0.875rem' }}>
            <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{failure.title}</strong>
            <span style={{ color: 'var(--text-secondary)' }}>{failure.message}</span>
          </div>
        </div>
      )}

      {/* Action Buttons: Request/Retry vs Manual Search Options */}
      <div
        className="location-permission__actions"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          marginTop: '0.5rem',
        }}
      >
        {status !== LOCATION_STATUS.UNSUPPORTED && (
          <button
            type="button"
            id={LOCATION_REQUEST_BUTTON_ID}
            className="btn btn-primary location-permission__button"
            onClick={onRequestLocation}
            disabled={!canRequest}
            aria-disabled={!canRequest}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.88rem',
              fontWeight: '600',
              padding: '0.55rem 1.15rem',
              borderRadius: '99px',
            }}
          >
            <Navigation size={16} aria-hidden="true" />
            {buttonLabel}
          </button>
        )}

        <button
          type="button"
          className="btn btn-secondary location-permission__button"
          onClick={focusStateDistrict}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.88rem',
            fontWeight: '600',
            padding: '0.55rem 1.15rem',
            borderRadius: '99px',
          }}
        >
          <MapPin size={16} color="var(--accent-main)" aria-hidden="true" />
          Choose State / District manually
        </button>

        {(fallback || status === LOCATION_STATUS.IDLE) && (
          <button
            type="button"
            className="btn btn-secondary location-permission__button"
            onClick={focusSearch}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.88rem',
              fontWeight: '600',
              padding: '0.55rem 1.15rem',
              borderRadius: '99px',
            }}
          >
            <Search size={16} aria-hidden="true" />
            Search by locality instead
          </button>
        )}
      </div>

      <p className="location-permission__sr sr-only" role="status" aria-live="polite">
        {requesting ? 'Waiting for your browser to share your location.' : ''}
      </p>
    </section>
  );
};

export default LocationPermissionPanel;
