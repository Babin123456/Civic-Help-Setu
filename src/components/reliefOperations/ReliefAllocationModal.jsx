import { useMemo, useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import {
  RELIEF_ERROR_GUIDANCE,
  RELIEF_CATEGORY_LABELS,
  CONFIDENCE_LABELS,
  PRIORITY_TIER_LABELS,
} from '../../services/reliefOperationsConstants';
import { ReliefConfidenceBadge, ReliefPriorityBadge } from './ReliefOperationsStates';

const openStatuses = ['submitted', 'verified', 'triaged'];

const remaining = (need) =>
  Math.max(0, Number(need.quantity || 0) - Number(need.fulfilledQuantity || 0));

export default function ReliefAllocationModal({
  recommendation,
  needs = [],
  resources = [],
  sites = [],
  onClose,
  onSubmit,
  onReject,
}) {
  const candidateNeeds = useMemo(
    () =>
      needs.filter(
        (need) =>
          openStatuses.includes(need.status) &&
          need.category === recommendation.category &&
          need.jurisdictionId === recommendation.jurisdictionId &&
          need.locality === recommendation.locality &&
          remaining(need) > 0
      ),
    [needs, recommendation]
  );

  const candidateResources = useMemo(
    () =>
      resources.filter(
        (resource) =>
          resource.category === recommendation.category &&
          resource.jurisdictionId === recommendation.jurisdictionId &&
          Number(resource.availableQuantity ?? resource.quantityOnHand ?? 0) > 0 &&
          !resource.isExpired
      ),
    [resources, recommendation]
  );

  const candidateSites = useMemo(
    () => sites.filter((site) => site.jurisdictionId === recommendation.jurisdictionId),
    [sites, recommendation]
  );

  const [needId, setNeedId] = useState(candidateNeeds[0]?.id || '');
  const selectedNeed = candidateNeeds.find((need) => need.id === needId) || candidateNeeds[0] || null;
  const [resourceId, setResourceId] = useState(candidateResources[0]?.id || '');
  const selectedResource =
    candidateResources.find((resource) => resource.id === resourceId) || candidateResources[0] || null;
  const [siteId, setSiteId] = useState(
    candidateSites.find((site) => site.id === selectedNeed?.siteId)?.id || candidateSites[0]?.id || ''
  );
  const maxQuantity = Math.min(
    selectedNeed ? remaining(selectedNeed) : recommendation.recommendedQuantity,
    selectedResource
      ? Number(selectedResource.availableQuantity ?? selectedResource.quantityOnHand ?? 0)
      : recommendation.recommendedQuantity
  );
  const [quantity, setQuantity] = useState(
    String(Math.max(1, Math.min(recommendation.recommendedQuantity, maxQuantity || 1)))
  );
  const [operatorNote, setOperatorNote] = useState('');
  const [error, setError] = useState(null);

  const numericQuantity = Number(quantity);
  const decision = numericQuantity === recommendation.recommendedQuantity ? 'accepted' : 'edited';
  const unavailable = candidateNeeds.length === 0 || candidateResources.length === 0;

  const handleSubmit = (event) => {
    event.preventDefault();
    setError(null);
    if (!selectedNeed) {
      setError('Select a need report to allocate against.');
      return;
    }
    if (!selectedResource) {
      setError('Select an available stock item.');
      return;
    }
    if (!Number.isInteger(numericQuantity) || numericQuantity < 1) {
      setError('Enter a whole-number quantity of at least 1.');
      return;
    }
    if (numericQuantity > maxQuantity) {
      setError(`Quantity cannot exceed ${maxQuantity} for the selected need and available stock.`);
      return;
    }
    try {
      onSubmit({
        needId: selectedNeed.id,
        resourceId: selectedResource.id,
        category: recommendation.category,
        quantity: numericQuantity,
        siteId: siteId || selectedNeed.siteId || null,
        operatorNote,
        recommendation: {
          recommendationId: recommendation.recommendationId,
          modelVersion: recommendation.modelVersion,
          decision,
          recommendedQuantity: recommendation.recommendedQuantity,
          operatorNote:
            operatorNote ||
            (decision === 'edited'
              ? `Operator edited the recommendation from ${recommendation.recommendedQuantity} to ${numericQuantity}.`
              : 'Operator accepted the recommended quantity.'),
          executedAt: recommendation.executedAt,
        },
      });
    } catch (submitError) {
      setError(RELIEF_ERROR_GUIDANCE[submitError?.code] || submitError?.message || 'The proposal could not be created.');
    }
  };

  const handleReject = () => {
    setError(null);
    try {
      onReject({
        recommendationId: recommendation.recommendationId,
        modelVersion: recommendation.modelVersion,
        decision: 'rejected',
        recommendedQuantity: recommendation.recommendedQuantity,
        operatorNote: operatorNote || 'Operator rejected the automated recommendation.',
        executedAt: recommendation.executedAt,
      });
    } catch (rejectError) {
      setError(RELIEF_ERROR_GUIDANCE[rejectError?.code] || rejectError?.message || 'The decision could not be recorded.');
    }
  };

  return (
    <div className="relief-modal-backdrop">
      <div
        className="relief-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="relief-allocation-heading"
      >
        <div className="relief-modal-header">
          <div>
            <h2 id="relief-allocation-heading">Create allocation proposal</h2>
            <p className="relief-muted">
              {RELIEF_CATEGORY_LABELS[recommendation.category]} · {recommendation.locality}
            </p>
          </div>
          <button type="button" className="relief-icon-button" onClick={onClose} aria-label="Close allocation dialog">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <section className="relief-card relief-card--nested" aria-labelledby="relief-recommendation-heading">
          <h3 id="relief-recommendation-heading">Automated recommendation</h3>
          <p className="relief-badge-row">
            <ReliefPriorityBadge tier={recommendation.priorityTier} score={recommendation.priorityScore} />
            <ReliefConfidenceBadge confidence={recommendation.confidence} />
            <span className="relief-badge">Ruleset {recommendation.modelVersion}</span>
          </p>
          <p>
            Recommended quantity: <strong>{recommendation.recommendedQuantity}</strong> ·{' '}
            {recommendation.peopleAffected} people affected · {recommendation.evidence.reportCount} report
            {recommendation.evidence.reportCount === 1 ? '' : 's'} ({recommendation.evidence.verifiedCount}{' '}
            verified)
          </p>
          <p className="relief-muted">
            Priority: {PRIORITY_TIER_LABELS[recommendation.priorityTier]} · Confidence:{' '}
            {CONFIDENCE_LABELS[recommendation.confidence]} · Executed{' '}
            {new Date(recommendation.executedAt).toLocaleString()}
          </p>
          <details>
            <summary>Why this recommendation was produced</summary>
            <ul>
              {recommendation.explanation.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="relief-help">
              Source fields: {recommendation.evidence.sourceFields.join(', ')}.
              {recommendation.freshness.isStale
                ? ' Some reports are older than the freshness limit; verify in the field.'
                : ' Evidence is within the freshness limit.'}
            </p>
          </details>
          {recommendation.requiresMedicalReview && (
            <p className="relief-medical-notice" role="note">
              <AlertTriangle size={16} aria-hidden="true" /> {recommendation.medicalReviewNotice}
            </p>
          )}
        </section>

        {unavailable ? (
          <div className="relief-empty" role="status">
            <AlertTriangle size={24} aria-hidden="true" />
            <h3>No allocatable match</h3>
            <p>
              There is no open need or unreserved stock that matches this recommendation. Add stock or
              verify the need report before creating a proposal.
            </p>
          </div>
        ) : (
          <form className="relief-form" onSubmit={handleSubmit} noValidate>
            <div className="relief-form-grid">
              <div className="relief-field">
                <label htmlFor="allocation-need">Need report</label>
                <select id="allocation-need" value={needId} onChange={(event) => setNeedId(event.target.value)}>
                  {candidateNeeds.map((need) => (
                    <option key={need.id} value={need.id}>
                      {need.trackingToken} — {remaining(need)} remaining, {need.peopleAffected} people
                    </option>
                  ))}
                </select>
              </div>

              <div className="relief-field">
                <label htmlFor="allocation-resource">Stock batch</label>
                <select
                  id="allocation-resource"
                  value={resourceId}
                  onChange={(event) => setResourceId(event.target.value)}
                >
                  {candidateResources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name} — {resource.availableQuantity ?? resource.quantityOnHand} {resource.unit}{' '}
                      available
                    </option>
                  ))}
                </select>
              </div>

              <div className="relief-field">
                <label htmlFor="allocation-site">Distribution site</label>
                <select id="allocation-site" value={siteId} onChange={(event) => setSiteId(event.target.value)}>
                  <option value="">Use the need&apos;s site</option>
                  {candidateSites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name} — {site.locality}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relief-field">
                <label htmlFor="allocation-quantity">Allocation quantity</label>
                <input
                  id="allocation-quantity"
                  type="number"
                  min="1"
                  max={maxQuantity}
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  aria-describedby="allocation-quantity-help"
                  aria-invalid={numericQuantity > maxQuantity || numericQuantity < 1}
                />
                <p className="relief-help" id="allocation-quantity-help">
                  Recommended {recommendation.recommendedQuantity}; maximum for this selection is{' '}
                  {maxQuantity}. Editing the quantity is recorded as an operator override.
                </p>
              </div>
            </div>

            <div className="relief-field">
              <label htmlFor="allocation-note">Operator note (optional)</label>
              <textarea
                id="allocation-note"
                rows={2}
                maxLength={500}
                value={operatorNote}
                onChange={(event) => setOperatorNote(event.target.value)}
              />
            </div>

            {error && (
              <p className="relief-error-inline" role="alert">
                {error}
              </p>
            )}

            <p className="relief-help">
              This creates an <strong>awaiting approval</strong> proposal. It does not reserve stock and
              is not visible to citizens until it is approved and distribution is confirmed. A reviewer
              other than the creator must approve it.
            </p>

            <div className="relief-form-actions">
              <button type="submit" className="relief-button relief-button--primary">
                <Check size={16} aria-hidden="true" /> Submit for reviewer approval
              </button>
              <button
                type="button"
                className="relief-button relief-button--ghost"
                onClick={handleReject}
                disabled={!onReject}
              >
                Reject recommendation
              </button>
              <button type="button" className="relief-button relief-button--ghost" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
