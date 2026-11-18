import { describe, it, expect } from 'vitest';
import {
  generateNameChangeWorkflow,
  GazetteMilestoneTracker,
  NAME_CHANGE_CATEGORY,
  MILESTONE_STATUS,
  GAZETTE_TRACKER_DISCLAIMER,
  OFFICIAL_GAZETTE_AUTHORITY,
} from './gazetteNameChangeTrackerService.js';

describe('Gazette Name-Change Preparation and Publication Tracker', () => {
  it('structures the 4 distinct sequential phases clearly', () => {
    const workflow = generateNameChangeWorkflow(NAME_CHANGE_CATEGORY.ADULT_GENERAL);
    expect(workflow.phases.length).toBe(4);

    expect(workflow.phases[0].name).toContain('Affidavit Execution');
    expect(workflow.phases[1].name).toContain('Newspaper');
    expect(workflow.phases[2].name).toContain('Gazette Submission');
    expect(workflow.phases[3].name).toContain('Post-Gazette');

    expect(workflow.statutoryGazetteFee).toBe(OFFICIAL_GAZETTE_AUTHORITY.centralGazetteFeeStandard);
    expect(workflow.disclaimer).toBe(GAZETTE_TRACKER_DISCLAIMER);
  });

  it('adjusts statutory fee and requirements for minor applicants', () => {
    const minorWorkflow = generateNameChangeWorkflow(NAME_CHANGE_CATEGORY.MINOR_CHILD);
    expect(minorWorkflow.statutoryGazetteFee).toBe(OFFICIAL_GAZETTE_AUTHORITY.centralGazetteFeeMinor);

    const affidavitPhase = minorWorkflow.phases[0];
    expect(affidavitPhase.requiredDocuments).toContain('Affidavit signed by both parents/guardians');
    expect(affidavitPhase.requiredDocuments).toContain("Minor child's birth certificate");
  });

  it('enumerates separate post-gazette identity database update routes', () => {
    const workflow = generateNameChangeWorkflow(NAME_CHANGE_CATEGORY.ADULT_GENERAL);
    const postPhase = workflow.phases[3];

    expect(postPhase.targetDatabases.length).toBe(4);
    const names = postPhase.targetDatabases.map((d) => d.name);
    expect(names).toContain('Aadhaar Card');
    expect(names).toContain('PAN Card');
    expect(names).toContain('Passport');
    expect(names).toContain('Bank Accounts');
  });

  it('manages personal milestone progress without recording user names or PII', () => {
    const tracker = new GazetteMilestoneTracker();
    const tracking = tracker.initializeMilestoneTracker('anon-tracker-77');

    expect(tracking.milestones.length).toBe(8);
    expect(tracking.milestones[0].status).toBe(MILESTONE_STATUS.PENDING);

    // Complete affidavit
    const updated = tracker.updateMilestoneStatus('anon-tracker-77', 'M1_AFFIDAVIT', MILESTONE_STATUS.COMPLETED);
    expect(updated.milestones[0].status).toBe(MILESTONE_STATUS.COMPLETED);
    expect(updated.milestones[0].completedAt).toBeDefined();

    // Delete tracker
    const deleted = tracker.deleteTracker('anon-tracker-77');
    expect(deleted).toBe(true);
    expect(tracker.getMilestones('anon-tracker-77')).toBeNull();
  });

  it('exports formatted markdown readiness report cleanly', () => {
    const tracker = new GazetteMilestoneTracker();
    tracker.initializeMilestoneTracker('report-test-01', NAME_CHANGE_CATEGORY.ADULT_GENERAL);
    tracker.updateMilestoneStatus('report-test-01', 'M1_AFFIDAVIT', MILESTONE_STATUS.COMPLETED);

    const report = tracker.exportReadinessReport('report-test-01');
    expect(report).toContain('# Gazette Name-Change Readiness Summary');
    expect(report).toContain('✅ **Affidavit Drafted & Notarized**');
    expect(report).toContain('Civil Lines, Delhi');
    expect(report).toContain(GAZETTE_TRACKER_DISCLAIMER);
  });
});
