import { AlertTriangle, X } from 'lucide-react';

/**
 * Non-blocking stale-data warning (#824).
 *
 * A warning banner is preferable to a modal here: the citizen can still read
 * the comparison, open a source, or choose another office. The notice states
 * exactly why a record is considered stale and never hides the list.
 */
const StaleDataNotice = ({ records = [], dataVersion, onDismiss }) => {
  const staleCount = records.filter((record) => record.verification.status !== 'verified').length;
  if (staleCount === 0) return null;

  return (
    <section className="comparison-stale-notice" role="status" aria-labelledby="stale-data-title">
      <AlertTriangle size={22} aria-hidden="true" />
      <div>
        <h2 id="stale-data-title">Some records need re-verification</h2>
        <p>
          {staleCount} of {records.length} matching office record{records.length === 1 ? '' : 's'} are older than
          180 days or have no dated verification source. Contact details, accessibility and service capability may have
          changed. Confirm with the office before travelling.
        </p>
        <p className="comparison-stale-notice__version">
          Office registry data version: {dataVersion || 'unknown'}.
        </p>
      </div>
      {onDismiss && (
        <button
          type="button"
          className="comparison-stale-notice__close"
          onClick={onDismiss}
          aria-label="Dismiss the stale-data warning for this session"
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </section>
  );
};

export default StaleDataNotice;
