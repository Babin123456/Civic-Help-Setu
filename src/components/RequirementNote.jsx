import {
  REQUIREMENT_LABELS,
  REQUIREMENT_DESCRIPTIONS,
} from '../services/requirementTypes';
import { safeHttpUrl } from '../utils/safeContent';

// Text label for a requirement type, plus the condition or cited source when
// there is one. The type is always written out, never shown by colour alone.
// A small shape in front of the label so the types also differ by form, not just colour.
const REQUIREMENT_MARKS = {
  required: '●',
  conditional: '◐',
  optional: '○',
  unverified: '?',
};

const RequirementNote = ({ requirement }) => {
  if (!requirement) return null;
  const { type, condition, source } = requirement;

  return (
    <span className="req-note">
      <span className={`req-badge req-badge--${type}`}>
        <span className="req-mark" aria-hidden="true">{REQUIREMENT_MARKS[type]}</span>
        {REQUIREMENT_LABELS[type]}
      </span>
      <span className="req-explain">
        {REQUIREMENT_DESCRIPTIONS[type]}
        {type === 'conditional' && condition ? ` Applies when: ${condition}` : ''}
        {type === 'required' && source ? (
          <>
            {' Source: '}
            {safeHttpUrl(source.url) ? (
              <a href={safeHttpUrl(source.url)} target="_blank" rel="noopener noreferrer">
                {source.name}
              </a>
            ) : (
              source.name
            )}
          </>
        ) : null}
      </span>
    </span>
  );
};

export default RequirementNote;
