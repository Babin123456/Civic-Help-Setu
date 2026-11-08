import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ApplicationTimeline from './ApplicationTimeline';

describe('ApplicationTimeline Component (#582)', () => {
  it('renders empty fallback when stages array is empty or undefined', () => {
    const html = renderToStaticMarkup(<ApplicationTimeline stages={[]} />);
    expect(html).toContain('No application milestone stages have been recorded');
  });

  it('renders status legend and stages with distinguishable status labels and icons', () => {
    const testStages = [
      {
        title: 'Application Submitted Online',
        description: 'Submission acknowledged and reference number generated.',
        timestamp: '12 Oct 2026, 10:30 AM',
        completed: true,
      },
      {
        title: 'Physical Record Verification',
        description: 'Field officer review at jurisdictional Tehsil office.',
        timestamp: '18 Oct 2026, 02:15 PM',
        inProgress: true,
      },
      {
        title: 'Clarification Needed',
        description: 'Applicant must re-upload readable address proof.',
        actionRequired: true,
      },
      {
        title: 'Delayed Clearance Step',
        description: 'Under review by Sub-Divisional Magistrate.',
        isDelayed: true,
      },
      {
        title: 'Final Certificate Generation',
        description: 'Digitally signed copy available for download.',
      },
    ];

    const html = renderToStaticMarkup(<ApplicationTimeline stages={testStages} />);

    // Legend
    expect(html).toContain('Completed');
    expect(html).toContain('In Progress');
    expect(html).toContain('Action Required');
    expect(html).toContain('Delayed');
    expect(html).toContain('Upcoming');

    // Milestones
    expect(html).toContain('Stage 1');
    expect(html).toContain('Application Submitted Online');
    expect(html).toContain('12 Oct 2026, 10:30 AM');

    expect(html).toContain('Stage 2');
    expect(html).toContain('Physical Record Verification');

    expect(html).toContain('Stage 3');
    expect(html).toContain('Clarification Needed');

    expect(html).toContain('Stage 4');
    expect(html).toContain('Delayed Step');

    expect(html).toContain('Stage 5');
    expect(html).toContain('Final Certificate Generation');
    expect(html).toContain('Date pending'); // Fallback for missing timestamp
  });

  it('renders fallback description when milestone description is missing', () => {
    const stages = [
      {
        title: 'Identity Verification',
      },
    ];

    const html = renderToStaticMarkup(<ApplicationTimeline stages={stages} />);
    expect(html).toContain('No detailed progress notes provided by the department');
  });
});
