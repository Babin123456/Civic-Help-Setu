/**
 * Review step shown before a bulk archive or restore is applied. It lists what
 * will change and what will be skipped (already in that state, failed
 * validation, or ids that no longer exist), so nothing happens unseen.
 */
const SKIP_GROUPS = [
  ['skippedAlreadyArchived', 'Already archived, no change'],
  ['skippedNotArchived', 'Not archived, no change'],
];

const ServiceLifecycleReview = ({ kind, plan, busy = false, onConfirm, onCancel }) => {
  const archiving = kind === 'archive';
  const verb = archiving ? 'Archive' : 'Restore';
  const count = plan.toChange.length;

  return (
    <section className="lifecycle-review" role="region" aria-labelledby="lifecycle-review-title">
      <h3 id="lifecycle-review-title" className="lifecycle-review__title">
        Review: {verb.toLowerCase()} {count} service guide{count === 1 ? '' : 's'}
      </h3>
      <p className="lifecycle-review__note">
        {archiving
          ? 'Archived guides leave the public directory but are kept with the same link, so saved references still open a retired notice. You can restore them later.'
          : 'Restored guides return to the public directory. A guide missing a required field stays archived.'}
      </p>

      {count > 0 ? (
        <div>
          <h4 className="lifecycle-review__heading">Will be {archiving ? 'archived' : 'restored'}</h4>
          <ul className="lifecycle-review__list">
            {plan.toChange.map((item) => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="lifecycle-review__empty">Nothing in this selection can be changed.</p>
      )}

      {plan.invalid?.length > 0 && (
        <div>
          <h4 className="lifecycle-review__heading">Failed validation, stays archived</h4>
          <ul className="lifecycle-review__list">
            {plan.invalid.map((item) => (
              <li key={item.id}>
                {item.name}: missing {item.missing.join(', ')}. Edit the guide, then restore it.
              </li>
            ))}
          </ul>
        </div>
      )}

      {SKIP_GROUPS.map(([key, label]) =>
        plan[key]?.length > 0 ? (
          <div key={key}>
            <h4 className="lifecycle-review__heading">{label}</h4>
            <ul className="lifecycle-review__list">
              {plan[key].map((item) => (
                <li key={item.id}>{item.name}</li>
              ))}
            </ul>
          </div>
        ) : null
      )}

      {plan.unknownIds?.length > 0 && (
        <div>
          <h4 className="lifecycle-review__heading">No longer exist, skipped</h4>
          <ul className="lifecycle-review__list">
            {plan.unknownIds.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="lifecycle-review__actions">
        <button type="button" className="btn btn-primary" disabled={busy || count === 0} onClick={onConfirm}>
          {busy ? 'Applying...' : `${verb} ${count} guide${count === 1 ? '' : 's'}`}
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
};

export default ServiceLifecycleReview;
