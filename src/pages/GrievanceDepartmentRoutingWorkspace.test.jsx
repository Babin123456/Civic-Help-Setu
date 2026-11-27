import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import GrievanceDepartmentRoutingWorkspace from './GrievanceDepartmentRoutingWorkspace.jsx';
import { resetLocalRoutingState } from '../services/grievanceDepartmentRoutingStorage.js';

describe('GrievanceDepartmentRoutingWorkspace (#1445)', () => {
  beforeEach(() => {
    resetLocalRoutingState();
  });

  it('renders heading, origin badges, ranked suggestions, override controls, and per-class metrics table', () => {
    const html = renderToString(<GrievanceDepartmentRoutingWorkspace />);
    expect(html).toContain('AI-Assisted Grievance Department Routing &amp; Human Override');
    expect(html).toContain('Citizen-Entered Complaint');
    expect(html).toContain('AI Routing Suggestion');
    expect(html).toContain('Official Department Rule');
    expect(html).toContain('Confirm Routing');
    expect(html).toContain('Per-Class Classifier Evaluation Metrics');
  });
});
