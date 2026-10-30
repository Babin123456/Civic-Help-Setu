import { useMemo, useRef, useState } from 'react';
import ServiceDetails from '../../pages/ServiceDetails';
import { discardDraft, listDrafts, publishDraft, reviewDraft } from '../../services/serviceDrafts';
import { approveDraft, returnDraft, reviewerCan, submitForReview, withdrawReview } from '../../services/serviceReview';
import { actorLabel } from '../../services/accessControl';
import { HIGH_IMPACT_FIELDS, REASON_MAX, SOURCE_REFERENCE_MAX } from '../../data/reviewPolicy';
import { safeHttpUrl } from '../../utils/safeContent';

const REVIEW_CHIP = { pending: 'Waiting for review', approved: 'Approved', returned: 'Returned for changes' };
const KIND_LABEL = { added: 'Added', removed: 'Removed', changed: 'Changed' };
const KIND_MARK = { added: '+', removed: '−', changed: '~' };

const formatTime = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
};

const Lines = ({ lines, empty = 'Nothing' }) =>
  lines.length === 0 ? (
    <span className="sdp-empty">{empty}</span>
  ) : (
    <ul className="sdp-lines">
      {lines.map((line, i) => (
        <li key={`${i}:${line}`}>{line}</li>
      ))}
    </ul>
  );

/** Before and after for every changed field. The change is written out, not only coloured. */
export const DiffTable = ({ changes, caption = 'What changes in the published guide' }) => {
  if (changes.length === 0) return <p className="sdp-hint">No field differs from the published guide.</p>;
  return (
    <div className="sdp-table-wrap" role="region" aria-label={caption} tabIndex={0}>
      <table className="sdp-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Change</th>
            <th scope="col">Published now</th>
            <th scope="col">In this draft</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c) => (
            <tr key={c.key} className={`sdp-row sdp-row--${c.kind}`}>
              <th scope="row">{c.label}</th>
              <td>
                <span className={`sdp-kind sdp-kind--${c.kind}`}>
                  <span aria-hidden="true">{KIND_MARK[c.kind]} </span>
                  {KIND_LABEL[c.kind]}
                </span>
              </td>
              <td>
                <Lines lines={c.removedItems.length ? c.removedItems.map((l) => `Removed: ${l}`) : c.before} empty="Not set" />
              </td>
              <td>
                <Lines lines={c.addedItems.length ? c.addedItems.map((l) => `Added: ${l}`) : c.after} empty="Not set" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/** The public service page, rendered by the same component, with every action switched off. */
export const DraftPreview = ({ record }) => (
  <div className="sdp-preview" role="region" aria-label="Preview of the public page">
    <p className="sdp-hint" role="note">
      Preview only. This is how the page will look; buttons and links do nothing here.
    </p>
    <ServiceDetails previewService={record} />
  </div>
);

const APPROVAL_TEXT = {
  'not-needed': 'No high-impact field changed, so no second reviewer is needed.',
  none: 'This change touches high-impact fields. Another admin must approve it before it can be published.',
  pending: 'Waiting for a second reviewer. It cannot be published yet.',
  returned: 'A reviewer returned this change. Edit the draft, then send it for review again.',
  approved: 'Approved by a second reviewer. It can be published.',
  outdated: 'The approval no longer applies: the draft or the published guide changed after it was given. Send it for review again.',
};

const when = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
};

/** Status, who did what, and the controls the signed-in admin may use on the second-reviewer step. */
export const ReviewControls = ({ state, viewer, onAct }) => {
  const [sourceReference, setSourceReference] = useState('');
  const [reason, setReason] = useState('');
  const { draft, approval, highImpact, reviewRequired } = state;
  const review = draft.review;
  const decision = reviewerCan(draft, viewer);
  const sources = Array.isArray(draft.record.officialSources) ? draft.record.officialSources : [];
  const canSend = reviewRequired && ['none', 'returned', 'outdated'].includes(approval);
  const isSender = review?.submittedBy && String(review.submittedBy).trim().toLowerCase() === String(viewer).trim().toLowerCase();

  return (
    <section className="sdp-review-box" aria-labelledby="sdp-second-review">
      <h5 id="sdp-second-review" className="sdp-subhead">
        Second review
      </h5>
      <p className={`sdp-status sdp-status--${approval}`} role="status">
        {APPROVAL_TEXT[approval]}
      </p>

      {reviewRequired && (
        <>
          <p className="sdp-hint">High-impact fields changed:</p>
          <ul className="sdp-lines">
            {highImpact.map((c) => (
              <li key={c.key}>
                <strong>{c.label}</strong>: {HIGH_IMPACT_FIELDS.find((f) => f.key === c.key)?.why}
              </li>
            ))}
          </ul>
        </>
      )}

      {review && (
        <dl className="sdp-facts">
          <dt>Sent by</dt>
          <dd>
            {review.submittedBy}, {when(review.submittedAt)}
          </dd>
          <dt>Source for the changed facts</dt>
          <dd>{review.sourceReference}</dd>
          {review.reviewer && (
            <>
              <dt>{review.status === 'approved' ? 'Approved by' : 'Returned by'}</dt>
              <dd>
                {review.reviewer}, {when(review.decidedAt)}
              </dd>
              <dt>Reason</dt>
              <dd>{review.reason}</dd>
            </>
          )}
        </dl>
      )}

      {reviewRequired && sources.length > 0 && (
        <>
          <p className="sdp-hint">Official sources on this guide, to check the changes against:</p>
          <ul className="sdp-lines">
            {sources.map((src, i) => {
              const href = safeHttpUrl(src?.url || '');
              return (
                <li key={`${src?.url}:${i}`}>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {src.name || href}
                    </a>
                  ) : (
                    src?.name || 'Source'
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {canSend && (
        <div className="sdp-form">
          <label htmlFor="sdp-source-ref">Where do the changed facts come from? (official notice, circular or page)</label>
          <textarea id="sdp-source-ref" rows={2} maxLength={SOURCE_REFERENCE_MAX} value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} />
          <button type="button" className="btn btn-primary sdp-btn" onClick={() => onAct(() => submitForReview(draft.draftId, { sourceReference }), 'Sent for second review.')}>
            Send for second review
          </button>
        </div>
      )}

      {approval === 'pending' && decision.allowed && (
        <div className="sdp-form">
          <label htmlFor="sdp-reason">Reason for your decision (required)</label>
          <textarea id="sdp-reason" rows={2} maxLength={REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="sdp-actions">
            <button type="button" className="btn btn-primary sdp-btn" onClick={() => onAct(() => approveDraft(draft.draftId, { reason }), 'Approved. The change can now be published.')}>
              Approve
            </button>
            <button type="button" className="btn btn-outline sdp-btn" onClick={() => onAct(() => returnDraft(draft.draftId, { reason }), 'Returned for changes. The published guide is unchanged.')}>
              Return for changes
            </button>
          </div>
        </div>
      )}

      {approval === 'pending' && !decision.allowed && (
        <div className="sdp-form">
          <p className="sdp-hint">{decision.why}</p>
          {isSender && (
            <button type="button" className="btn btn-outline sdp-btn" onClick={() => onAct(() => withdrawReview(draft.draftId), 'Taken back from review.')}>
              Withdraw from review
            </button>
          )}
        </div>
      )}
    </section>
  );
};

const Review = ({ draftId, refreshKey, onEditDraft, onClose, onChanged, actor }) => {
  // Read again when the parent saved the draft (refreshKey), so editing from this screen shows the new result.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const review = useMemo(() => reviewDraft(draftId), [draftId, refreshKey]);
  const [showPreview, setShowPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [acknowledge, setAcknowledge] = useState(false);
  const [message, setMessage] = useState('');
  const errorsRef = useRef(null);

  if (!review) return <p className="sdp-hint">That draft no longer exists.</p>;
  const { draft, errors, changes, stale, newerChanges, isNew, removedFromCatalogue } = review;
  const title = draft.record.name || 'Untitled guide';
  const viewer = actorLabel('');

  // Runs a review step and shows its error, if any, where the controls are.
  const act = (fn, okText) => {
    try {
      fn();
      setMessage('');
      onChanged(okText);
    } catch (err) {
      setMessage(err.message);
    }
  };

  const startPublish = () => {
    setMessage('');
    if (errors.length) {
      setConfirming(false);
      errorsRef.current?.focus();
      return;
    }
    setConfirming(true);
  };

  const confirmPublish = () => {
    try {
      const result = publishDraft(draftId, {
        actor,
        acknowledgeNewer: acknowledge,
      });
      onChanged(`Published "${title}". Changed: ${result.changedFields.join(', ')}.`);
      onClose();
    } catch (err) {
      setMessage(err.message);
      setConfirming(false);
    }
  };

  return (
    <section className="sdp-review" aria-labelledby="sdp-review-title">
      <div className="sdp-review__head">
        <h4 id="sdp-review-title" className="sdp-subhead">
          Review draft: {title}
        </h4>
        <button type="button" className="btn btn-outline sdp-btn" onClick={onClose}>
          Back to drafts
        </button>
      </div>
      <p className="sdp-hint">
        {isNew ? 'This is a new guide. Nothing is published until you confirm below.' : 'The published guide is unchanged until you confirm below.'}
      </p>

      {removedFromCatalogue && (
        <p className="sdp-alert" role="alert">
          The published guide this draft edits was removed. Discard the draft or copy its content into a new guide.
        </p>
      )}

      {errors.length > 0 && (
        <div className="sdp-errors" role="alert" tabIndex={-1} ref={errorsRef}>
          <strong>
            Fix {errors.length} problem{errors.length === 1 ? '' : 's'} before publishing:
          </strong>
          <ul className="sdp-lines">
            {errors.map((e, i) => (
              <li key={`${e.field}:${i}`}>
                {e.fieldId ? (
                  <button type="button" className="sdp-link" onClick={() => onEditDraft(draft, e.fieldId)}>
                    {e.message}
                  </button>
                ) : (
                  e.message
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {stale && (
        <div className="sdp-alert" role="alert">
          <strong>The published guide changed after you began this draft:</strong>
          <DiffTable changes={newerChanges} caption="Changes made to the published guide since this draft began" />
          <label className="sdp-check">
            <input type="checkbox" checked={acknowledge} onChange={(e) => setAcknowledge(e.target.checked)} />I have read these changes and want to
            publish my draft over them.
          </label>
        </div>
      )}

      <ReviewControls state={review} viewer={viewer} onAct={act} />

      <h5 className="sdp-subhead">Before and after</h5>
      <DiffTable changes={changes} />

      <div className="sdp-actions">
        <button type="button" className="btn btn-outline sdp-btn" aria-expanded={showPreview} onClick={() => setShowPreview((v) => !v)}>
          {showPreview ? 'Hide preview' : 'Show preview of the public page'}
        </button>
        <button type="button" className="btn btn-outline sdp-btn" onClick={() => onEditDraft(draft, null)}>
          Edit draft
        </button>
        <button type="button" className="btn btn-primary sdp-btn" onClick={startPublish} disabled={removedFromCatalogue || changes.length === 0 || (review.reviewRequired && review.approval !== 'approved')}>
          Publish…
        </button>
      </div>
      {changes.length === 0 && !removedFromCatalogue && (
        <p className="sdp-hint">There is nothing to publish: the draft matches the published guide.</p>
      )}

      {showPreview && <DraftPreview record={draft.record} />}

      {message && (
        <p className="sdp-alert" role="alert">
          {message}
        </p>
      )}

      {confirming && (
        <div className="sdp-confirm" role="group" aria-label="Confirm publish">
          <p>
            <strong>
              Publish {changes.length} change{changes.length === 1 ? '' : 's'} to the public directory?
            </strong>{' '}
            Citizens will see this on this device straight away: {changes.map((c) => c.label).join(', ')}.
          </p>
          <button type="button" className="btn btn-primary sdp-btn" onClick={confirmPublish} disabled={stale && !acknowledge}>
            Confirm and publish
          </button>
          <button type="button" className="btn btn-outline sdp-btn" onClick={() => setConfirming(false)}>
            Not yet
          </button>
          {stale && !acknowledge && <p className="sdp-hint">Tick the box above to confirm you are overwriting the newer changes.</p>}
        </div>
      )}
    </section>
  );
};

/**
 * Admin tab listing private drafts of service guides. A draft never reaches the public catalogue until
 * it is reviewed and published here. Docs: docs/SERVICE_DRAFTS.md
 */
export default function ServiceDraftsPanel({ onEditDraft, onChanged = () => {}, actor = 'Admin', refreshKey = 0 }) {
  const [version, setVersion] = useState(0);
  // Read again whenever the parent saved something (refreshKey) or this panel discarded or published (version).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const drafts = useMemo(() => listDrafts(), [refreshKey, version]);
  const [reviewing, setReviewing] = useState(null);
  const [discarding, setDiscarding] = useState(null);
  const [notice, setNotice] = useState('');

  const refresh = (text = '') => {
    setVersion((v) => v + 1);
    if (text) setNotice(text);
    onChanged(text);
  };

  const doDiscard = (draft) => {
    try {
      discardDraft(draft.draftId);
      setDiscarding(null);
      refresh(`Discarded the draft of "${draft.record.name || 'Untitled guide'}". The published guide was not touched.`);
    } catch (err) {
      setNotice(err.message);
      setVersion((v) => v + 1);
    }
  };

  if (reviewing) {
    return (
      <Review
        key={reviewing}
        draftId={reviewing}
        refreshKey={refreshKey + version}
        actor={actor}
        onEditDraft={onEditDraft}
        onClose={() => {
          setReviewing(null);
          setVersion((v) => v + 1);
        }}
        onChanged={refresh}
      />
    );
  }

  return (
    <section className="sdp" aria-labelledby="sdp-title">
      <h3 id="sdp-title" className="sdp-title">
        Service drafts
      </h3>
      <p className="sdp-intro">
        Drafts are private to this browser. Editing a draft never changes what citizens see; use Review to compare it with the published guide,
        preview the public page, and publish when it is ready.
      </p>
      <p className="sdp-notice" role="status" aria-live="polite">
        {notice}
      </p>

      {drafts.length === 0 ? (
        <p className="sdp-hint">No drafts. Use &ldquo;Save as draft&rdquo; when you edit or add a guide.</p>
      ) : (
        <ul className="sdp-list">
          {drafts.map((d) => {
            const name = d.record.name || 'Untitled guide';
            return (
              <li key={d.draftId} className="sdp-item">
                <div className="sdp-item__main">
                  <div className="sdp-item__name">{name}</div>
                  <div className="sdp-item__meta">
                    {d.review?.status ? `${REVIEW_CHIP[d.review.status]} · ` : ''}
                    {d.serviceId ? 'Edit of a published guide' : 'New guide'} · saved {formatTime(d.updatedAt)}
                    {d.author ? ` by ${d.author}` : ''}
                  </div>
                </div>
                <div className="sdp-item__actions">
                  <button
                    type="button"
                    className="btn btn-primary sdp-btn"
                    onClick={() => setReviewing(d.draftId)}
                    aria-label={`Review draft ${name}`}
                  >
                    Review
                  </button>
                  <button type="button" className="btn btn-outline sdp-btn" onClick={() => onEditDraft(d, null)} aria-label={`Edit draft ${name}`}>
                    Edit
                  </button>
                  {discarding === d.draftId ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-outline sdp-btn"
                        onClick={() => doDiscard(d)}
                        aria-label={`Confirm discard of draft ${name}`}
                      >
                        Confirm discard
                      </button>
                      <button type="button" className="btn btn-outline sdp-btn" onClick={() => setDiscarding(null)}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline sdp-btn"
                      onClick={() => setDiscarding(d.draftId)}
                      aria-label={`Discard draft ${name}`}
                    >
                      Discard
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
