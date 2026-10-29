import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { CheckSquare, Square } from 'lucide-react';
import {
  CHECKLIST_STORAGE_KEY,
  createChecklistSession,
} from '../services/checklistStorage';
import { summarizeRequirementProgress } from '../services/requirementTypes';
import RequirementNote from './RequirementNote';

const STATUS_TEXT = {
  saving: 'Saving...',
  saved: 'All changes saved.',
  updated: 'Updated from another tab or window.',
};

// `items` is an array of labels. Pass `checklistId` to save progress in the
// browser; without it the list only lives in memory, as before.
// `requirements` is an optional map of item label -> { type, condition, source }
// (see requirementTypes.js). When given, each item shows its type and progress
// counts official requirements only.
const Checklist = ({ items = [], checklistId, label = 'Checklist', requirements }) => {
  const itemsKey = items.join('\u0000');
  const session = useMemo(
    () => createChecklistSession({ id: checklistId, items }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checklistId, itemsKey]
  );

  const { checked, status } = useSyncExternalStore(
    session.subscribe,
    session.getState,
    session.getState
  );

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === null || event.key === CHECKLIST_STORAGE_KEY) {
        session.refresh();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [session]);

  const done = items.filter((item) => checked.includes(item)).length;
  const blocked = status === 'conflict';
  const summary = requirements
    ? summarizeRequirementProgress(items, checked, requirements)
    : null;

  return (
    <div className="cl-root">
      <p className="cl-progress">
        {summary
          ? `${summary.mandatoryDone} of ${summary.mandatoryTotal} official requirements completed`
          : `${done} of ${items.length} completed`}
      </p>
      {summary && (summary.conditionalCount + summary.optionalCount + summary.unverifiedCount > 0) && (
        <p className="cl-progress">
          Not counted above:
          {[
            summary.conditionalCount && ` ${summary.conditionalCount} conditional`,
            summary.optionalCount && ` ${summary.optionalCount} optional`,
            summary.unverifiedCount && ` ${summary.unverifiedCount} not verified`,
          ].filter(Boolean).join(',')}
          .
        </p>
      )}
      <ul className="cl-list" aria-label={label}>
        {items.map((item) => {
          const isChecked = checked.includes(item);
          return (
            <li key={item} className={`cl-item${isChecked ? ' is-done' : ''}`}>
              <label className="cl-label">
                <input
                  type="checkbox"
                  className="cl-input"
                  checked={isChecked}
                  disabled={blocked}
                  onChange={() => session.toggle(item)}
                />
                <span className="cl-box" aria-hidden="true">
                  {isChecked ? <CheckSquare size={22} /> : <Square size={22} />}
                </span>
                <span className="cl-text">
                  {item}
                  {requirements && <RequirementNote requirement={requirements[item]} />}
                </span>
                <span className="cl-state">{isChecked ? 'Done' : 'To do'}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <p className="cl-status" role="status" aria-live="polite">
        {STATUS_TEXT[status] || ''}
      </p>

      {status === 'error' && (
        <div className="cl-alert cl-alert-error" role="alert">
          <span>
            Your changes could not be saved in this browser. They are shown here
            but may be lost if you leave.
          </span>
          <button type="button" className="btn btn-secondary" onClick={session.retry}>
            Retry saving
          </button>
        </div>
      )}

      {status === 'conflict' && (
        <div className="cl-alert cl-alert-conflict" role="alert">
          <span>
            This checklist was changed in another tab or window, so your latest
            change was not saved. Choose which version to keep.
          </span>
          <span className="cl-actions">
            <button type="button" className="btn btn-secondary" onClick={session.reloadLatest}>
              Load latest version
            </button>
            <button type="button" className="btn btn-secondary" onClick={session.overwrite}>
              Keep mine and save
            </button>
          </span>
        </div>
      )}
    </div>
  );
};
export default Checklist;
