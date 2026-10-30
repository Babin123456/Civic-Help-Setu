import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ApplicationMilestoneTracker from './ApplicationMilestoneTracker';

describe('ApplicationMilestoneTracker', () => {
  it('renders nothing when application is missing', () => {
    const html = renderToStaticMarkup(<ApplicationMilestoneTracker application={null} />);
    expect(html).toBe('');
  });

  it('renders milestone stages for active application', () => {
    const app = {
      id: 'APP-99',
      serviceName: 'Driving License',
      currentStageIndex: 1,
      submissionDate: new Date().toISOString(),
      stages: [
        { name: 'Application Submitted' },
        { name: 'Document Scrutiny' },
        { name: 'Biometric Test' },
      ],
    };
    const html = renderToStaticMarkup(<ApplicationMilestoneTracker application={app} />);
    expect(html).toContain('Estimated Milestone Schedule &amp; Stage Velocity');
    expect(html).toContain('Document Scrutiny');
    expect(html).toContain('Progressing on Schedule');
  });

  it('shows stalled stage warning when bottleneck is detected', () => {
    const app = {
      id: 'APP-99-STALLED',
      serviceName: 'Caste Certificate',
      currentStageIndex: 1,
      submissionDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      stages: [
        { name: 'Application Submitted' },
        { name: 'Field Verification' },
        { name: 'Sanction' },
      ],
    };
    const html = renderToStaticMarkup(<ApplicationMilestoneTracker application={app} />);
    expect(html).toContain('Stalled Stage Detected');
    expect(html).toContain('Potential Delay at Field Verification');
  });
});
