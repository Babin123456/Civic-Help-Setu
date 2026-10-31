import { describe, it, expect } from 'vitest';
import {
  getEstimatedStageDays,
  estimateStageMilestones,
} from './applicationMilestoneEstimator';

describe('applicationMilestoneEstimator', () => {
  it('maps standard civic stage names to duration windows', () => {
    expect(getEstimatedStageDays('Application Submitted')).toBe(1);
    expect(getEstimatedStageDays('Document Scrutiny')).toBe(3);
    expect(getEstimatedStageDays('Police Verification')).toBe(7);
    expect(getEstimatedStageDays('Officer Approval')).toBe(4);
    expect(getEstimatedStageDays('Certificate Dispatch')).toBe(2);
  });

  it('calculates on-schedule stages for newly submitted application', () => {
    const app = {
      id: 'APP-501',
      serviceName: 'Income Certificate',
      currentStageIndex: 1,
      submissionDate: new Date().toISOString(),
      stages: [
        { name: 'Application Submitted' },
        { name: 'Document Scrutiny' },
        { name: 'Tehsildar Approval' },
      ],
    };
    const res = estimateStageMilestones(app);
    expect(res.stages.length).toBe(3);
    expect(res.stages[0].status).toBe('COMPLETED');
    expect(res.stages[1].status).toBe('IN_PROGRESS');
    expect(res.hasBottleneck).toBe(false);
    expect(res.overallVelocity).toBe('ON_SCHEDULE');
  });

  it('detects bottleneck when current stage has exceeded target milestone date', () => {
    // Submitted 20 days ago, but still stuck on Stage 1 (Document Scrutiny, expected within 4 days)
    const submitted20DaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    const app = {
      id: 'APP-502',
      serviceName: 'Caste Certificate',
      currentStageIndex: 1,
      submissionDate: submitted20DaysAgo,
      stages: [
        { name: 'Application Submitted' },
        { name: 'Document Scrutiny' },
        { name: 'Field Inspection' },
        { name: 'Sanction' },
      ],
    };
    const res = estimateStageMilestones(app);
    expect(res.hasBottleneck).toBe(true);
    expect(res.bottleneckStage.stageName).toBe('Document Scrutiny');
    expect(res.bottleneckStage.delayedDays).toBeGreaterThan(10);
    expect(res.overallVelocity).toBe('BOTTLENECK_DETECTED');
  });
});
