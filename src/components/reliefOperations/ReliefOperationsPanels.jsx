import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Info,
  PlusCircle,
  Search,
  ShieldCheck,
  Truck,
  Warehouse,
  XCircle,
} from 'lucide-react';
import {
  ALLOCATION_STATUS,
  DELIVERY_STATUS_LABELS,
  NEED_STATUS,
  RELIEF_CATEGORY_LABELS,
  RESOURCE_STATUS,
  STOCK_MOVEMENT_LABELS,
  PARTNER_STATUS_LABELS,
  RELIEF_ERROR_GUIDANCE,
  URGENCY_LEVEL_LABELS,
} from '../../services/reliefOperationsConstants';
import {
  ReliefConfidenceBadge,
  ReliefEmptyState,
  ReliefPriorityBadge,
  ReliefStatusBadge,
} from './ReliefOperationsStates';

const fmtDate = (value) => (value ? new Date(value).toLocaleString() : '—');
const fmtNumber = (value) => Number(value || 0).toLocaleString();
const actorLabel = (entry) => entry?.actorId || 'unknown';

// ── Overview ─────────────────────────────────────────────────────────────────

export function ReliefOverviewPanel({ unmetNeeds, incidents }) {
  return (
    <div className="relief-panel-stack">
      <section className="relief-card" aria-labelledby="relief-unmet-heading">
        <h2 id="relief-unmet-heading">Unmet needs by category</h2>
        <p className="relief-muted">
          Aggregated from open, non-archived reports. Duplicate reports are excluded after verification.
          Figures include the report count so a single report is never mistaken for a trend.
        </p>
        {unmetNeeds.summary.byCategory.length === 0 ? (
          <ReliefEmptyState
            title="No unmet needs recorded"
            message="When a citizen or partner submits an open need report it will appear here."
          />
        ) : (
          <div className="relief-table-wrap">
            <table className="relief-table">
              <caption className="sr-only">Unmet relief needs aggregated by category</caption>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Open reports</th>
                  <th scope="col">People affected</th>
                  <th scope="col">Unfulfilled units</th>
                  <th scope="col">Stale reports</th>
                </tr>
              </thead>
              <tbody>
                {unmetNeeds.summary.byCategory.map((row) => (
                  <tr key={row.category}>
                    <th scope="row">{row.categoryLabel}</th>
                    <td>{fmtNumber(row.reportCount)}</td>
                    <td>{fmtNumber(row.peopleAffected)}</td>
                    <td>{fmtNumber(row.remainingQuantity)}</td>
                    <td>
                      {row.staleCount > 0 ? (
                        <span className="relief-text-warning">
                          <AlertTriangle size={13} aria-hidden="true" /> {row.staleCount}
                        </span>
                      ) : (
                        '0'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="relief-card" aria-labelledby="relief-locality-heading">
        <h2 id="relief-locality-heading">Demand by locality</h2>
        <p className="relief-muted">
          The table is the accessible alternative to a map. It lists every locality that has an open
          report, with freshness information.
        </p>
        {unmetNeeds.summary.byLocality.length === 0 ? (
          <ReliefEmptyState title="No localities with open demand" message="No open reports are in scope." />
        ) : (
          <div className="relief-table-wrap">
            <table className="relief-table">
              <caption className="sr-only">Open relief demand grouped by locality</caption>
              <thead>
                <tr>
                  <th scope="col">Locality</th>
                  <th scope="col">Jurisdiction</th>
                  <th scope="col">Open reports</th>
                  <th scope="col">People affected</th>
                  <th scope="col">Unfulfilled units</th>
                  <th scope="col">Last updated</th>
                </tr>
              </thead>
              <tbody>
                {unmetNeeds.summary.byLocality.map((row) => (
                  <tr key={`${row.jurisdictionId}-${row.locality}`}>
                    <th scope="row">{row.locality}</th>
                    <td>{row.jurisdictionId}</td>
                    <td>{fmtNumber(row.reportCount)}</td>
                    <td>{fmtNumber(row.peopleAffected)}</td>
                    <td>{fmtNumber(row.remainingQuantity)}</td>
                    <td>{fmtDate(row.lastUpdatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="relief-card" aria-labelledby="relief-incidents-heading">
        <h2 id="relief-incidents-heading">Active incidents</h2>
        {incidents.length === 0 ? (
          <ReliefEmptyState title="No public incidents" message="No incident has been published for this jurisdiction." />
        ) : (
          <ul className="relief-list">
            {incidents.map((incident) => (
              <li key={incident.id} className="relief-list-item">
                <div>
                  <strong>{incident.name}</strong>{' '}
                  <ReliefStatusBadge status={incident.status} type="incident" />
                  <p className="relief-muted">{incident.publicSummary}</p>
                </div>
                <dl className="relief-inline-meta">
                  <div>
                    <dt>Type</dt>
                    <dd>{incident.disasterType}</dd>
                  </div>
                  <div>
                    <dt>Locality</dt>
                    <dd>{incident.locality}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{fmtDate(incident.updatedAt)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── Need reports ─────────────────────────────────────────────────────────────

const NEED_FILTERS = [
  ['', 'All statuses'],
  [NEED_STATUS.SUBMITTED, 'Submitted'],
  [NEED_STATUS.VERIFIED, 'Verified'],
  [NEED_STATUS.TRIAGED, 'Triaged'],
  [NEED_STATUS.ALLOCATED, 'Allocated'],
  [NEED_STATUS.FULFILLED, 'Fulfilled'],
  [NEED_STATUS.REJECTED, 'Rejected'],
  [NEED_STATUS.DUPLICATE, 'Duplicate'],
];

export function ReliefNeedsPanel({
  needsPage,
  filters,
  onFilterChange,
  onReview,
  canVerify,
}) {
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const handleDecision = (needId, decision, reason = '') => {
    setActionError(null);
    setBusyId(needId);
    try {
      onReview(needId, { decision, reason });
      setRejecting(null);
      setRejectReason('');
    } catch (error) {
      setActionError(RELIEF_ERROR_GUIDANCE[error?.code] || error?.message || 'The review could not be saved.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="relief-card" aria-labelledby="relief-needs-heading">
      <div className="relief-card-header">
        <div>
          <h2 id="relief-needs-heading">Need reports</h2>
          <p className="relief-muted">
            Operational records. Private notes and reporter references stay inside this view and are never
            exposed by public APIs.
          </p>
        </div>
        <div className="relief-filter-row">
          <label htmlFor="relief-need-status" className="relief-visually-labelled">
            <Search size={14} aria-hidden="true" /> Status
          </label>
          <select
            id="relief-need-status"
            value={filters.status || ''}
            onChange={(event) => onFilterChange({ ...filters, status: event.target.value || 'all' })}
          >
            {NEED_FILTERS.map(([value, label]) => (
              <option key={value || 'all'} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {actionError && (
        <p className="relief-error-inline" role="alert">
          {actionError}
        </p>
      )}

      {needsPage.items.length === 0 ? (
        <ReliefEmptyState
          title="No need reports match"
          message="Adjust the status filter, or check that reports were submitted for this jurisdiction."
        />
      ) : (
        <div className="relief-table-wrap">
          <table className="relief-table">
            <caption className="sr-only">
              Relief need reports with quantity, urgency, freshness and review actions
            </caption>
            <thead>
              <tr>
                <th scope="col">Tracking token</th>
                <th scope="col">Category</th>
                <th scope="col">Locality</th>
                <th scope="col">Remaining</th>
                <th scope="col">People</th>
                <th scope="col">Urgency</th>
                <th scope="col">Status</th>
                <th scope="col">Updated</th>
                {canVerify && <th scope="col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {needsPage.items.map((need) => (
                <tr key={need.id}>
                  <th scope="row">
                    <code>{need.trackingToken}</code>
                    {need.duplicateCount > 0 && (
                      <span className="relief-merged-count">{need.duplicateCount} merged</span>
                    )}
                  </th>
                  <td>{RELIEF_CATEGORY_LABELS[need.category] || need.category}</td>
                  <td>{need.locality}</td>
                  <td>
                    {fmtNumber(need.remainingQuantity)}
                    <span className="relief-muted"> / {fmtNumber(need.quantity)}</span>
                  </td>
                  <td>{fmtNumber(need.peopleAffected)}</td>
                  <td>{URGENCY_LEVEL_LABELS[need.urgency] || need.urgency}</td>
                  <td>
                    <ReliefStatusBadge status={need.status} />
                    {need.isStale && <span className="relief-stale-flag">Stale</span>}
                  </td>
                  <td>{fmtDate(need.updatedAt)}</td>
                  {canVerify && (
                    <td>
                      <div className="relief-action-row">
                        {need.status === NEED_STATUS.SUBMITTED && (
                          <button
                            type="button"
                            className="relief-button relief-button--small"
                            onClick={() => handleDecision(need.id, 'verify')}
                            disabled={busyId === need.id}
                          >
                            <ClipboardCheck size={13} aria-hidden="true" /> Verify
                          </button>
                        )}
                        {need.status === NEED_STATUS.VERIFIED && (
                          <button
                            type="button"
                            className="relief-button relief-button--small"
                            onClick={() => handleDecision(need.id, 'triage')}
                            disabled={busyId === need.id}
                          >
                            <CheckCircle2 size={13} aria-hidden="true" /> Triage
                          </button>
                        )}
                        {[NEED_STATUS.SUBMITTED, NEED_STATUS.VERIFIED, NEED_STATUS.TRIAGED].includes(
                          need.status
                        ) && (
                          <button
                            type="button"
                            className="relief-button relief-button--small relief-button--danger"
                            onClick={() => {
                              setRejecting(need.id);
                              setRejectReason('');
                              setActionError(null);
                            }}
                          >
                            <XCircle size={13} aria-hidden="true" /> Reject
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejecting && (
        <form
          className="relief-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleDecision(rejecting, 'reject', rejectReason);
          }}
        >
          <h3>Reject need report</h3>
          <p className="relief-muted">
            A reason of at least 5 characters is required and is written to the audit trail. Reporter
            contact details are never requested.
          </p>
          <div className="relief-field">
            <label htmlFor="relief-reject-reason">Rejection reason</label>
            <textarea
              id="relief-reject-reason"
              rows={2}
              maxLength={300}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              required
              minLength={5}
            />
          </div>
          <div className="relief-form-actions">
            <button type="submit" className="relief-button relief-button--danger">
              Confirm rejection
            </button>
            <button
              type="button"
              className="relief-button relief-button--ghost"
              onClick={() => setRejecting(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <p className="relief-muted relief-pagination">
        Page {needsPage.page} of {needsPage.totalPages} · {fmtNumber(needsPage.total)} report
        {needsPage.total === 1 ? '' : 's'} in scope
      </p>
    </section>
  );
}

// ── Forecast ─────────────────────────────────────────────────────────────────

export function ReliefForecastPanel({
  run,
  onRun,
  canRun,
  canPropose,
  onOpenAllocation,
  onRejectRecommendation,
  stale,
}) {
  const [error, setError] = useState(null);
  const recommendations = run?.recommendations || [];

  const handleReject = (recommendation) => {
    setError(null);
    try {
      onRejectRecommendation({
        recommendationId: recommendation.recommendationId,
        modelVersion: recommendation.modelVersion,
        decision: 'rejected',
        recommendedQuantity: recommendation.recommendedQuantity,
        operatorNote: 'Operator rejected the automated recommendation from the forecast panel.',
        executedAt: recommendation.executedAt,
      });
    } catch (rejectError) {
      setError(RELIEF_ERROR_GUIDANCE[rejectError?.code] || rejectError?.message || 'Decision not recorded.');
    }
  };

  return (
    <div className="relief-panel-stack">
      <section className="relief-card" aria-labelledby="relief-forecast-heading">
        <div className="relief-card-header">
          <div>
            <h2 id="relief-forecast-heading">Needs forecast &amp; allocation recommendations</h2>
            <p className="relief-muted">
              Deterministic ruleset that clusters open reports by jurisdiction, locality and category. It
              recommends supply quantities only. A human reviewer must approve every allocation.
            </p>
          </div>
          {canRun && (
            <button type="button" className="relief-button relief-button--primary" onClick={onRun}>
              <ShieldCheck size={15} aria-hidden="true" /> Run forecast
            </button>
          )}
        </div>

        {!run ? (
          <ReliefEmptyState
            title="No forecast has run in this session"
            message={
              canRun
                ? 'Run the forecast to see recommendations with evidence, confidence and freshness.'
                : 'Ask a relief operator to run the needs forecast for this jurisdiction.'
            }
          />
        ) : (
          <>
            <dl className="relief-inline-meta relief-inline-meta--wide">
              <div>
                <dt>Ruleset version</dt>
                <dd>
                  <code>{run.rulesetVersion}</code>
                </dd>
              </div>
              <div>
                <dt>Feature window</dt>
                <dd>
                  {run.featureWindow.days} days ({fmtDate(run.featureWindow.from)} – {fmtDate(run.featureWindow.to)})
                </dd>
              </div>
              <div>
                <dt>Executed at</dt>
                <dd>{fmtDate(run.executedAt)}</dd>
              </div>
              <div>
                <dt>Mode</dt>
                <dd>{run.fallbackMode ? 'Deterministic fallback' : 'Ruleset (local, no network)'}</dd>
              </div>
              <div>
                <dt>Freshness</dt>
                <dd>
                  {run.dataFreshness?.isStale ? (
                    <span className="relief-text-warning">
                      <AlertTriangle size={13} aria-hidden="true" /> Stale reports
                    </span>
                  ) : (
                    'Within freshness limit'
                  )}
                </dd>
              </div>
            </dl>

            {stale && (
              <p className="relief-banner relief-banner--stale" role="status">
                <AlertTriangle size={16} aria-hidden="true" /> This run includes stale reports. Verify in the
                field before approving an allocation.
              </p>
            )}

            <ul className="relief-limitations">
              {run.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>

            <div className="relief-recommendation-grid">
              {recommendations.length === 0 ? (
                <ReliefEmptyState
                  title="No recommendations"
                  message="No open reports matched the forecast window. Verify reports or widen the window."
                />
              ) : (
                recommendations.map((recommendation) => (
                  <article className="relief-recommendation" key={recommendation.recommendationId}>
                    <header>
                      <div>
                        <h3>{recommendation.locality}</h3>
                        <p className="relief-muted">
                          {recommendation.categoryLabel} · {recommendation.jurisdictionId}
                        </p>
                      </div>
                      <ReliefPriorityBadge
                        tier={recommendation.priorityTier}
                        score={recommendation.priorityScore}
                      />
                    </header>

                    <p className="relief-recommendation-quantity">
                      Recommended supply: <strong>{fmtNumber(recommendation.recommendedQuantity)}</strong>{' '}
                      units
                      <span className="relief-muted">
                        {' '}
                        · {fmtNumber(recommendation.requestedRemainingQuantity)} unfulfilled reported
                      </span>
                    </p>

                    <p className="relief-badge-row">
                      <ReliefConfidenceBadge confidence={recommendation.confidence} />
                      <span className="relief-badge">{recommendation.evidence.reportCount} reports</span>
                      <span className="relief-badge">{recommendation.evidence.verifiedCount} verified</span>
                      {recommendation.freshness.isStale && (
                        <span className="relief-badge relief-badge--warning">Stale evidence</span>
                      )}
                    </p>

                    <p className="relief-muted">{recommendation.confidenceReason}</p>

                    <details>
                      <summary>Evidence &amp; explanation</summary>
                      <ul>
                        {recommendation.explanation.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                      <p className="relief-help">
                        Source fields: {recommendation.evidence.sourceFields.join(', ')}. Newest report{' '}
                        {fmtDate(recommendation.evidence.newestReportAt)}. Report spread{' '}
                        {fmtNumber(recommendation.evidence.spreadMeters)} m. Model{' '}
                        <code>{recommendation.modelVersion}</code> executed{' '}
                        {fmtDate(recommendation.executedAt)}.
                      </p>
                    </details>

                    {recommendation.requiresMedicalReview && (
                      <p className="relief-medical-notice" role="note">
                        <Info size={15} aria-hidden="true" /> {recommendation.medicalReviewNotice}
                      </p>
                    )}

                    <p className="relief-help">
                      <ShieldCheck size={13} aria-hidden="true" /> Human approval required. This system never
                      approves, reserves or dispatches stock on its own.
                    </p>

                    <div className="relief-form-actions">
                      <button
                        type="button"
                        className="relief-button relief-button--primary"
                        onClick={() => onOpenAllocation(recommendation)}
                        disabled={!canPropose}
                        title={canPropose ? undefined : 'Only relief operators and administrators can propose allocations.'}
                      >
                        <PlusCircle size={15} aria-hidden="true" /> Review &amp; create proposal
                      </button>
                      <button
                        type="button"
                        className="relief-button relief-button--ghost"
                        onClick={() => handleReject(recommendation)}
                        disabled={!canPropose}
                      >
                        Reject recommendation
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>

            <h3 className="relief-subheading">Recommendations as an accessible table</h3>
            <div className="relief-table-wrap">
              <table className="relief-table">
                <caption className="sr-only">
                  Forecast recommendations with priority, confidence, evidence counts and freshness
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Locality</th>
                    <th scope="col">Category</th>
                    <th scope="col">Recommended quantity</th>
                    <th scope="col">Priority</th>
                    <th scope="col">Confidence</th>
                    <th scope="col">Reports</th>
                    <th scope="col">Newest report</th>
                    <th scope="col">Human approval</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendations.map((recommendation) => (
                    <tr key={`table-${recommendation.recommendationId}`}>
                      <th scope="row">{recommendation.locality}</th>
                      <td>{recommendation.categoryLabel}</td>
                      <td>{fmtNumber(recommendation.recommendedQuantity)}</td>
                      <td>
                        {recommendation.priorityTier} ({recommendation.priorityScore})
                      </td>
                      <td>{recommendation.confidence}</td>
                      <td>
                        {recommendation.evidence.reportCount} ({recommendation.evidence.verifiedCount}{' '}
                        verified)
                      </td>
                      <td>{fmtDate(recommendation.evidence.newestReportAt)}</td>
                      <td>{recommendation.requiresHumanApproval ? 'Required' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {error && (
          <p className="relief-error-inline" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}

// ── Allocations ──────────────────────────────────────────────────────────────

export function ReliefAllocationsPanel({
  allocationsPage,
  actorId,
  onApprove,
  onReject,
  onDispatch,
  onConfirm,
  onCancel,
  canApprove,
  canDispatch,
  canConfirm,
}) {
  const [decisionTarget, setDecisionTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const submitDecision = (event) => {
    event.preventDefault();
    setActionError(null);
    setBusyId(decisionTarget.allocation.id);
    try {
      if (decisionTarget.decision === 'approve') {
        onApprove(decisionTarget.allocation.id, reason);
      } else if (decisionTarget.decision === 'reject') {
        onReject(decisionTarget.allocation.id, reason);
      } else {
        onCancel(decisionTarget.allocation.id, reason);
      }
      setDecisionTarget(null);
      setReason('');
    } catch (error) {
      setActionError(RELIEF_ERROR_GUIDANCE[error?.code] || error?.message || 'The action could not be saved.');
    } finally {
      setBusyId(null);
    }
  };

  const openDecision = (allocation, decision) => {
    setDecisionTarget({ allocation, decision });
    setReason('');
    setActionError(null);
  };

  return (
    <div className="relief-panel-stack">
      <section className="relief-card" aria-labelledby="relief-allocations-heading">
        <h2 id="relief-allocations-heading">Allocation queue &amp; delivery tracking</h2>
        <p className="relief-muted">
          Approval reserves stock inside one transaction, so two reviewers cannot over-reserve the same
          batch. The proposer cannot approve their own proposal. Dispatch and confirmation move the
          reservation into issued stock and update the linked need.
        </p>

        {actionError && (
          <p className="relief-error-inline" role="alert">
            {actionError}
          </p>
        )}

        {allocationsPage.items.length === 0 ? (
          <ReliefEmptyState
            title="No allocations in this scope"
            message="Create a proposal from a forecast recommendation, or adjust the jurisdiction filter."
          />
        ) : (
          <div className="relief-table-wrap">
            <table className="relief-table">
              <caption className="sr-only">
                Allocation proposals with status, linked need, stock reservation and permitted actions
              </caption>
              <thead>
                <tr>
                  <th scope="col">Proposal</th>
                  <th scope="col">Need</th>
                  <th scope="col">Stock batch</th>
                  <th scope="col">Quantity</th>
                  <th scope="col">Site</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allocationsPage.items.map((allocation) => {
                  const selfProposal = allocation.createdBy === actorId;
                  return (
                    <tr key={allocation.id}>
                      <th scope="row">
                        <code>{allocation.id}</code>
                        <p className="relief-help">By {actorLabel(allocation)}</p>
                      </th>
                      <td>
                        {allocation.needSummary ? (
                          <>
                            <code>{allocation.needSummary.trackingToken}</code>
                            <p className="relief-help">{allocation.needSummary.locality}</p>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {allocation.resourceSummary ? (
                          <>
                            {allocation.resourceSummary.name}
                            <p className="relief-help">
                              {fmtNumber(allocation.resourceSummary.availableQuantity)} available · batch{' '}
                              {allocation.resourceSummary.batchRef || 'n/a'}
                            </p>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{fmtNumber(allocation.quantity)}</td>
                      <td>{allocation.siteSummary?.name || '—'}</td>
                      <td>
                        <ReliefStatusBadge status={allocation.status} type="allocation" />
                        {allocation.deliverySummary && (
                          <p className="relief-help">
                            Delivery: {DELIVERY_STATUS_LABELS[allocation.deliverySummary.status] || allocation.deliverySummary.status}
                          </p>
                        )}
                      </td>
                      <td>{fmtDate(allocation.createdAt)}</td>
                      <td>
                        <div className="relief-action-row">
                          {canApprove && allocation.status === ALLOCATION_STATUS.PENDING_APPROVAL && (
                              <>
                                <button
                                  type="button"
                                  className="relief-button relief-button--small"
                                  onClick={() => openDecision(allocation, 'approve')}
                                  disabled={selfProposal || busyId === allocation.id}
                                  title={
                                    selfProposal
                                      ? 'Separation of duty: the proposer cannot approve their own allocation.'
                                      : undefined
                                  }
                                >
                                  <CheckCircle2 size={13} aria-hidden="true" /> Approve &amp; reserve
                                </button>
                                <button
                                  type="button"
                                  className="relief-button relief-button--small relief-button--ghost"
                                  onClick={() => openDecision(allocation, 'reject')}
                                  disabled={selfProposal || busyId === allocation.id}
                                >
                                  Reject
                                </button>
                              </>
                            )}

                          {canDispatch && allocation.status === ALLOCATION_STATUS.RESERVED && (
                            <>
                              <button
                                type="button"
                                className="relief-button relief-button--small"
                                onClick={() => onDispatch(allocation)}
                                disabled={busyId === allocation.id}
                              >
                                <Truck size={13} aria-hidden="true" /> Dispatch
                              </button>
                              <button
                                type="button"
                                className="relief-button relief-button--small relief-button--ghost"
                                onClick={() => openDecision(allocation, 'cancel')}
                                disabled={busyId === allocation.id}
                              >
                                Cancel
                              </button>
                            </>
                          )}

                          {canConfirm && allocation.status === ALLOCATION_STATUS.DISPATCHED && (
                            <button
                              type="button"
                              className="relief-button relief-button--small"
                              onClick={() => onConfirm(allocation)}
                              disabled={busyId === allocation.id}
                            >
                              <CheckCircle2 size={13} aria-hidden="true" /> Confirm delivery
                            </button>
                          )}

                          {allocation.status === ALLOCATION_STATUS.CONFIRMED && (
                            <span className="relief-muted">
                              Fulfilled {fmtNumber(allocation.fulfilledQuantity)} units on{' '}
                              {fmtDate(allocation.confirmedAt)}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="relief-muted relief-pagination">
          Page {allocationsPage.page} of {allocationsPage.totalPages} · {fmtNumber(allocationsPage.total)}{' '}
          proposal{allocationsPage.total === 1 ? '' : 's'} in scope
        </p>
      </section>

      {decisionTarget && (
        <form className="relief-inline-form" onSubmit={submitDecision}>
          <h3>
            {decisionTarget.decision === 'approve'
              ? 'Approve and reserve stock'
              : decisionTarget.decision === 'reject'
                ? 'Reject allocation proposal'
                : 'Cancel allocation'}
          </h3>
          <p className="relief-muted">
            {decisionTarget.decision === 'approve'
              ? `Approving reserves ${fmtNumber(decisionTarget.allocation.quantity)} units from ${decisionTarget.allocation.resourceSummary?.name || 'the selected batch'} in one transaction. If stock is no longer available the proposal stays pending.`
              : 'A reason of at least 5 characters is required and is recorded in the append-only audit trail.'}
          </p>
          <div className="relief-field">
            <label htmlFor="relief-decision-reason">Reason</label>
            <textarea
              id="relief-decision-reason"
              rows={2}
              maxLength={300}
              minLength={5}
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <div className="relief-form-actions">
            <button type="submit" className="relief-button relief-button--primary">
              Confirm {decisionTarget.decision}
            </button>
            <button
              type="button"
              className="relief-button relief-button--ghost"
              onClick={() => setDecisionTarget(null)}
            >
              Close
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Inventory & sites ────────────────────────────────────────────────────────

export function ReliefInventoryPanel({
  resourcesPage,
  sites,
  movementsPage,
  partners,
  canManage,
  onAddStock,
  onQuarantine,
}) {
  const [stockForm, setStockForm] = useState({ resourceId: '', quantity: '', reason: '' });
  const [quarantineForm, setQuarantineForm] = useState({ resourceId: '', reason: '' });
  const [feedback, setFeedback] = useState(null);

  const resourceOptions = useMemo(
    () => resourcesPage.items.filter((resource) => resource.status !== RESOURCE_STATUS.EXPIRED),
    [resourcesPage.items]
  );

  const submitStock = (event) => {
    event.preventDefault();
    setFeedback(null);
    try {
      onAddStock(stockForm.resourceId, {
        quantity: Number(stockForm.quantity),
        reason: stockForm.reason,
      });
      setStockForm({ resourceId: '', quantity: '', reason: '' });
      setFeedback({ type: 'success', message: 'Stock receipt recorded and written to the stock ledger.' });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: RELIEF_ERROR_GUIDANCE[error?.code] || error?.message || 'Stock could not be added.',
      });
    }
  };

  const submitQuarantine = (event) => {
    event.preventDefault();
    setFeedback(null);
    try {
      onQuarantine(quarantineForm.resourceId, { reason: quarantineForm.reason });
      setQuarantineForm({ resourceId: '', reason: '' });
      setFeedback({ type: 'success', message: 'Stock written off with a reason recorded in the audit trail.' });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: RELIEF_ERROR_GUIDANCE[error?.code] || error?.message || 'Stock could not be written off.',
      });
    }
  };

  return (
    <div className="relief-panel-stack">
      {feedback && (
        <p className={feedback.type === 'error' ? 'relief-error-inline' : 'relief-success'} role="status">
          {feedback.message}
        </p>
      )}

      <section className="relief-card" aria-labelledby="relief-stock-heading">
        <h2 id="relief-stock-heading">Resource inventory</h2>
        <p className="relief-muted">
          Unreserved stock is the only quantity available to a new allocation. Expired or quarantined
          batches are excluded from allocation and shown with an explicit status.
        </p>
        {resourcesPage.items.length === 0 ? (
          <ReliefEmptyState title="No stock in this scope" message="Add stock or change the jurisdiction filter." />
        ) : (
          <div className="relief-table-wrap">
            <table className="relief-table">
              <caption className="sr-only">Resource stock batches with availability and expiry</caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Category</th>
                  <th scope="col">Batch</th>
                  <th scope="col">On hand</th>
                  <th scope="col">Reserved</th>
                  <th scope="col">Available</th>
                  <th scope="col">Status</th>
                  <th scope="col">Expires</th>
                </tr>
              </thead>
              <tbody>
                {resourcesPage.items.map((resource) => (
                  <tr key={resource.id}>
                    <th scope="row">{resource.name}</th>
                    <td>{RELIEF_CATEGORY_LABELS[resource.category] || resource.category}</td>
                    <td>{resource.batchRef || '—'}</td>
                    <td>{fmtNumber(resource.quantityOnHand)}</td>
                    <td>{fmtNumber(resource.quantityReserved)}</td>
                    <td>{fmtNumber(resource.availableQuantity)}</td>
                    <td>
                      <ReliefStatusBadge status={resource.status} type="resource" />
                      {resource.isExpired && <span className="relief-stale-flag">Do not allocate</span>}
                    </td>
                    <td>{resource.expiresAt ? fmtDate(resource.expiresAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canManage && (
        <div className="relief-two-column">
          <form className="relief-card" onSubmit={submitStock}>
            <h2>Receive stock</h2>
            <p className="relief-muted">
              Records a receipt movement. Use the batch reference printed on the delivery note.
            </p>
            <div className="relief-field">
              <label htmlFor="relief-stock-resource">Stock batch</label>
              <select
                id="relief-stock-resource"
                value={stockForm.resourceId}
                onChange={(event) => setStockForm({ ...stockForm, resourceId: event.target.value })}
                required
              >
                <option value="">Select a batch…</option>
                {resourceOptions.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name} — {resource.batchRef || resource.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="relief-form-grid">
              <div className="relief-field">
                <label htmlFor="relief-stock-quantity">Quantity received</label>
                <input
                  id="relief-stock-quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={stockForm.quantity}
                  onChange={(event) => setStockForm({ ...stockForm, quantity: event.target.value })}
                  required
                />
              </div>
              <div className="relief-field">
                <label htmlFor="relief-stock-reason">Source / note</label>
                <input
                  id="relief-stock-reason"
                  type="text"
                  maxLength={300}
                  value={stockForm.reason}
                  onChange={(event) => setStockForm({ ...stockForm, reason: event.target.value })}
                  placeholder="District warehouse transfer"
                />
              </div>
            </div>
            <button type="submit" className="relief-button relief-button--primary">
              <Warehouse size={15} aria-hidden="true" /> Record receipt
            </button>
          </form>

          <form className="relief-card" onSubmit={submitQuarantine}>
            <h2>Write off or quarantine stock</h2>
            <p className="relief-muted">
              A reason is mandatory. The batch becomes unavailable for allocation and the decision is
              audited.
            </p>
            <div className="relief-field">
              <label htmlFor="relief-quarantine-resource">Stock batch</label>
              <select
                id="relief-quarantine-resource"
                value={quarantineForm.resourceId}
                onChange={(event) => setQuarantineForm({ ...quarantineForm, resourceId: event.target.value })}
                required
              >
                <option value="">Select a batch…</option>
                {resourceOptions.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name} — {resource.batchRef || resource.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="relief-field">
              <label htmlFor="relief-quarantine-reason">Reason</label>
              <textarea
                id="relief-quarantine-reason"
                rows={2}
                maxLength={300}
                minLength={5}
                value={quarantineForm.reason}
                onChange={(event) => setQuarantineForm({ ...quarantineForm, reason: event.target.value })}
                required
              />
            </div>
            <button type="submit" className="relief-button relief-button--danger">
              <AlertTriangle size={15} aria-hidden="true" /> Write off stock
            </button>
          </form>
        </div>
      )}

      <section className="relief-card" aria-labelledby="relief-sites-heading">
        <h2 id="relief-sites-heading">Distribution sites</h2>
        {sites.length === 0 ? (
          <ReliefEmptyState title="No distribution sites" message="No site is published for this jurisdiction." />
        ) : (
          <ul className="relief-list">
            {sites.map((site) => (
              <li key={site.id} className="relief-list-item">
                <div>
                  <strong>{site.name}</strong>
                  <p className="relief-muted">{site.address}</p>
                </div>
                <dl className="relief-inline-meta">
                  <div>
                    <dt>Locality</dt>
                    <dd>{site.locality}</dd>
                  </div>
                  <div>
                    <dt>Daily capacity</dt>
                    <dd>{fmtNumber(site.capacityPerDay)}</dd>
                  </div>
                  <div>
                    <dt>Public</dt>
                    <dd>{site.isPublic === false ? 'No' : 'Yes'}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="relief-card" aria-labelledby="relief-movements-heading">
        <h2 id="relief-movements-heading">Recent stock movements</h2>
        {movementsPage.items.length === 0 ? (
          <ReliefEmptyState title="No stock movements" message="Receipts, reservations and issues appear here." />
        ) : (
          <div className="relief-table-wrap">
            <table className="relief-table">
              <caption className="sr-only">Recent stock movements with quantity and reason</caption>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Type</th>
                  <th scope="col">Quantity</th>
                  <th scope="col">On hand after</th>
                  <th scope="col">Reserved after</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {movementsPage.items.map((movement) => (
                  <tr key={movement.id}>
                    <th scope="row">{fmtDate(movement.createdAt)}</th>
                    <td>{STOCK_MOVEMENT_LABELS[movement.type] || movement.type}</td>
                    <td>{fmtNumber(movement.quantity)}</td>
                    <td>{fmtNumber(movement.balanceAfter)}</td>
                    <td>{fmtNumber(movement.reservedAfter)}</td>
                    <td>{movement.reason || '—'}</td>
                    <td>{movement.actorRole || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {partners.length > 0 && (
        <section className="relief-card" aria-labelledby="relief-partners-heading">
          <h2 id="relief-partners-heading">Relief partner verification</h2>
          <p className="relief-muted">
            Partner submissions require a verified record for the same jurisdiction. Verification is
            restricted to administrators.
          </p>
          <div className="relief-table-wrap">
            <table className="relief-table">
              <caption className="sr-only">Relief partners and verification status</caption>
              <thead>
                <tr>
                  <th scope="col">Organisation</th>
                  <th scope="col">Jurisdiction</th>
                  <th scope="col">Status</th>
                  <th scope="col">Verified at</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((partner) => (
                  <tr key={partner.id}>
                    <th scope="row">{partner.organisationName}</th>
                    <td>{partner.jurisdictionId}</td>
                    <td>{PARTNER_STATUS_LABELS[partner.status] || partner.status}</td>
                    <td>{fmtDate(partner.verifiedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

// ── Public status ────────────────────────────────────────────────────────────

export function ReliefPublicPanel({ publicStatus, onTrack }) {
  const [token, setToken] = useState('');
  const [tracked, setTracked] = useState(null);
  const [trackError, setTrackError] = useState(null);

  const submitTrack = (event) => {
    event.preventDefault();
    setTrackError(null);
    try {
      setTracked(onTrack(token));
    } catch (error) {
      setTracked(null);
      setTrackError(RELIEF_ERROR_GUIDANCE[error?.code] || error?.message || 'No report was found for that token.');
    }
  };

  return (
    <div className="relief-panel-stack">
      <section className="relief-card" aria-labelledby="relief-public-heading">
        <h2 id="relief-public-heading">Public relief status</h2>
        <p className="relief-muted">
          This is the same aggregate projection the public API returns: counts by category and locality.
          Individual reports, descriptions, coordinates, private notes and reporter references are never
          included.
        </p>
        <dl className="relief-inline-meta relief-inline-meta--wide">
          <div>
            <dt>Open need reports</dt>
            <dd>{fmtNumber(publicStatus.openNeedCount)}</dd>
          </div>
          <div>
            <dt>People affected</dt>
            <dd>{fmtNumber(publicStatus.peopleAffected)}</dd>
          </div>
          <div>
            <dt>Confirmed distributions</dt>
            <dd>{fmtNumber(publicStatus.confirmedDistributionCount)}</dd>
          </div>
          <div>
            <dt>Units distributed</dt>
            <dd>{fmtNumber(publicStatus.confirmedUnitsDistributed)}</dd>
          </div>
          <div>
            <dt>Last updated</dt>
            <dd>{fmtDate(publicStatus.lastUpdatedAt)}</dd>
          </div>
        </dl>

        <div className="relief-table-wrap">
          <table className="relief-table">
            <caption className="sr-only">Public aggregate relief demand by category</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Reports</th>
                <th scope="col">People affected</th>
                <th scope="col">Unfulfilled units</th>
              </tr>
            </thead>
            <tbody>
              {publicStatus.byCategory.map((row) => (
                <tr key={row.category}>
                  <th scope="row">{row.categoryLabel}</th>
                  <td>{fmtNumber(row.reportCount)}</td>
                  <td>{fmtNumber(row.peopleAffected)}</td>
                  <td>{fmtNumber(row.remainingQuantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="relief-disclaimer">{publicStatus.disclaimer}</p>

        <h3 className="relief-subheading">Fields that are published</h3>
        <ul className="relief-chip-list">
          {publicStatus.publicFields.map((field) => (
            <li key={field} className="relief-badge">
              {field}
            </li>
          ))}
        </ul>
      </section>

      <section className="relief-card" aria-labelledby="relief-track-heading">
        <h2 id="relief-track-heading">Track a need report</h2>
        <p className="relief-muted">
          Enter the tracking token issued when a report was submitted. Only the public projection is
          returned.
        </p>
        <form className="relief-inline-form" onSubmit={submitTrack}>
          <div className="relief-field">
            <label htmlFor="relief-track-token">Tracking token</label>
            <input
              id="relief-track-token"
              type="text"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="TRK-RLF-100001"
              autoComplete="off"
              required
            />
          </div>
          <button type="submit" className="relief-button relief-button--primary">
            <Search size={15} aria-hidden="true" /> Track report
          </button>
        </form>

        {trackError && (
          <p className="relief-error-inline" role="alert">
            {trackError}
          </p>
        )}

        {tracked && (
          <dl className="relief-receipt" aria-live="polite">
            <div>
              <dt>Category</dt>
              <dd>{tracked.categoryLabel}</dd>
            </div>
            <div>
              <dt>Locality</dt>
              <dd>{tracked.locality}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{tracked.statusLabel}</dd>
            </div>
            <div>
              <dt>Requested / fulfilled</dt>
              <dd>
                {fmtNumber(tracked.quantity)} / {fmtNumber(tracked.fulfilledQuantity)}
              </dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{fmtDate(tracked.updatedAt)}</dd>
            </div>
          </dl>
        )}
      </section>
    </div>
  );
}

// ── Audit ────────────────────────────────────────────────────────────────────

export function ReliefAuditPanel({ auditPage }) {
  return (
    <section className="relief-card" aria-labelledby="relief-audit-heading">
      <h2 id="relief-audit-heading">Append-only audit trail</h2>
      <p className="relief-muted">
        Every verification, approval, reservation, dispatch, delivery, correction and override is stored
        with its actor, role, jurisdiction, reason and timestamp. Entries are never edited; corrections are
        recorded as new entries.
      </p>

      {auditPage.items.length === 0 ? (
        <ReliefEmptyState title="No audit entries" message="Actions recorded in this jurisdiction will appear here." />
      ) : (
        <div className="relief-table-wrap">
          <table className="relief-table">
            <caption className="sr-only">Relief operations audit trail</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Action</th>
                <th scope="col">Entity</th>
                <th scope="col">Actor</th>
                <th scope="col">Reason</th>
                <th scope="col">Change</th>
              </tr>
            </thead>
            <tbody>
              {auditPage.items.map((entry) => (
                <tr key={entry.id}>
                  <th scope="row">{fmtDate(entry.timestamp)}</th>
                  <td>
                    <code>{entry.action}</code>
                  </td>
                  <td>
                    {entry.entityType}
                    <p className="relief-help">{entry.entityId}</p>
                  </td>
                  <td>
                    {entry.actorId}
                    <p className="relief-help">{entry.actorRole}</p>
                  </td>
                  <td>{entry.reason || '—'}</td>
                  <td>
                    {entry.before || entry.after ? (
                      <code className="relief-audit-change">
                        {entry.before ? `from ${JSON.stringify(entry.before)} ` : ''}
                        {entry.after ? `to ${JSON.stringify(entry.after)}` : ''}
                      </code>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="relief-muted relief-pagination">
        Page {auditPage.page} of {auditPage.totalPages} · {fmtNumber(auditPage.total)} entries
      </p>
    </section>
  );
}

// ── Partner verification (admin) ─────────────────────────────────────────────

export function ReliefPartnersPanel({ partners }) {
  return (
    <section className="relief-card" aria-labelledby="relief-partners-admin-heading">
      <h2 id="relief-partners-admin-heading">Partner verification records</h2>
      <p className="relief-muted">
        Only verified partners can submit need reports for a jurisdiction. Suspension and revocation
        require a reason and are audited.
      </p>
      {partners.length === 0 ? (
        <ReliefEmptyState title="No partner records" message="No partner has been registered." />
      ) : (
        <div className="relief-table-wrap">
          <table className="relief-table">
            <caption className="sr-only">Partner verification records</caption>
            <thead>
              <tr>
                <th scope="col">Organisation</th>
                <th scope="col">Jurisdiction</th>
                <th scope="col">Status</th>
                <th scope="col">Verified by</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => (
                <tr key={partner.id}>
                  <th scope="row">{partner.organisationName}</th>
                  <td>{partner.jurisdictionId}</td>
                  <td>
                    <ReliefStatusBadge status={partner.status} type="partner" />
                  </td>
                  <td>{partner.verifiedBy || '—'}</td>
                  <td>{fmtDate(partner.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────

export function ReliefNotification({ type = 'info', children }) {
  const Icon = type === 'success' ? CheckCircle2 : type === 'error' ? XCircle : Info;
  return (
    <p className={type === 'error' ? 'relief-error-inline' : 'relief-success'} role="status">
      <Icon size={15} aria-hidden="true" /> {children}
    </p>
  );
}
