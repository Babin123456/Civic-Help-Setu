import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import GrievanceCompletenessCoachWorkspace from './GrievanceCompletenessCoachWorkspace.jsx';
import { resetLocalCoachState } from '../services/grievanceCompletenessCoachStorage.js';

describe('GrievanceCompletenessCoachWorkspace (#1444)', () => {
  beforeEach(() => {
    resetLocalCoachState();
  });

  it('renders heading, origin badges, multilingual selector, missing fields, and original vs approved text', () => {
    const html = renderToString(<GrievanceCompletenessCoachWorkspace />);
    expect(html).toContain('Public Grievance Language Quality &amp; Completeness Coach');
    expect(html).toContain('Citizen-Entered Draft');
    expect(html).toContain('Coach Suggestion (Approval Required)');
    expect(html).toContain('Official Filing Rule');
    expect(html).toContain('Prompt Language');
    expect(html).toContain('Approve Suggestion');
    expect(html).toContain('Original Citizen Text (Preserved Verbatim)');
  });
});
