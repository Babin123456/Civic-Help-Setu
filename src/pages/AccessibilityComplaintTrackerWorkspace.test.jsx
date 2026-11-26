import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AccessibilityComplaintTrackerWorkspace from './AccessibilityComplaintTrackerWorkspace.jsx';
import { resetToSampleCases } from '../services/accessibilityEscalationStorage.js';

describe('AccessibilityComplaintTrackerWorkspace Page (#950)', () => {
  beforeEach(() => {
    // Reset to sample cases
    resetToSampleCases();
  });

  it('renders workspace title and statutory authority references', () => {
    const html = renderToStaticMarkup(<AccessibilityComplaintTrackerWorkspace />);

    expect(html).toContain('Accessibility Complaint Follow-Up &amp; Escalation Tracker');
    expect(html).toContain('Rights of Persons with Disabilities (RPwD) Act, 2016');
    expect(html).toContain('Sections 44 &amp; 45');
    expect(html).toContain('Sections 75 &amp; 80');
    expect(html).toContain('Harmonised Guidelines 2021');
  });

  it('renders case selector tabs with sample case', () => {
    const html = renderToStaticMarkup(<AccessibilityComplaintTrackerWorkspace />);

    expect(html).toContain('District Civil Hospital, Block B');
    expect(html).toContain('New Case');
  });

  it('renders official status distinction banner in summary card', () => {
    const html = renderToStaticMarkup(<AccessibilityComplaintTrackerWorkspace />);

    expect(html).toContain('Citizen Record vs Official Status:');
    expect(html).toContain('CITIZEN TRACKER NOTICE');
  });

  it('renders timeline and event log', () => {
    const html = renderToStaticMarkup(<AccessibilityComplaintTrackerWorkspace />);

    expect(html).toContain('Chronological Correspondence &amp; Inspection Timeline');
    expect(html).toContain('Add Timeline Event');
  });

  it('renders export buttons and storage controls', () => {
    const html = renderToStaticMarkup(<AccessibilityComplaintTrackerWorkspace />);

    expect(html).toContain('Export All Dossier (.MD)');
    expect(html).toContain('Export All (.JSON)');
    expect(html).toContain('Reset Sample Data');
  });
});
