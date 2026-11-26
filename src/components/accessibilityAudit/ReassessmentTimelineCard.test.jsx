import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ReassessmentTimelineCard from './ReassessmentTimelineCard.jsx';

describe('ReassessmentTimelineCard', () => {
  it('renders reassessment history with rounds and resolved barriers', () => {
    const auditRecord = {
      reassessments: [
        {
          reassessmentId: 'r1',
          reassessedAt: '2026-11-18T10:00:00Z',
          assessorNotes: 'Post-renovation inspection of entrance doorway',
          evaluation: { score: 80 },
          resolvedBarriers: ['Doorway Clear Opening Width'],
          unresolvedBarriers: ['Ramp Slope Gradient'],
        },
      ],
    };

    const html = renderToStaticMarkup(
      <ReassessmentTimelineCard auditRecord={auditRecord} />
    );

    expect(html).toContain('Reassessment History &amp; Progress (1 rounds)');
    expect(html).toContain('Reassessment Round 1');
    expect(html).toContain('Post-renovation inspection of entrance doorway');
    expect(html).toContain('Newly Resolved Barriers (1)');
    expect(html).toContain('Doorway Clear Opening Width');
  });
});
