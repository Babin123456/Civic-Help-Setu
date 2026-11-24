import { describe, it, expect, beforeEach } from 'vitest';
import {
  CicdPipelineHistoryService,
  PIPELINE_STATUS,
  DEPLOYMENT_ENVIRONMENT
} from './cicdPipelineHistoryService.js';

describe('cicdPipelineHistoryService', () => {
  let service;

  beforeEach(() => {
    service = new CicdPipelineHistoryService({ repo: 'GoldRay19/Civic-Help-Setu' });
  });

  describe('recordWorkflowRun', () => {
    it('records workflow run with non-secret metadata and short SHA', () => {
      const run = service.recordWorkflowRun({
        runId: '12345',
        workflowName: 'Test & Lint',
        branch: 'feat/new-ui',
        commitSha: 'abcdef1234567890',
        status: PIPELINE_STATUS.SUCCESS,
        durationSeconds: 45
      });

      expect(run.runId).toBe('12345');
      expect(run.commitSha).toBe('abcdef1');
      expect(run.status).toBe(PIPELINE_STATUS.SUCCESS);
      expect(run.durationSeconds).toBe(45);
    });

    it('attaches public GitHub action links to failed jobs without leaking server logs', () => {
      const run = service.recordWorkflowRun({
        runId: '99999',
        workflowName: 'Security Scan',
        commitSha: '987654321',
        status: PIPELINE_STATUS.FAILED,
        failedJobs: [{ name: 'Gitleaks scan' }]
      });

      expect(run.status).toBe(PIPELINE_STATUS.FAILED);
      expect(run.failedJobs.length).toBe(1);
      expect(run.failedJobs[0].logUrl).toBe('https://github.com/GoldRay19/Civic-Help-Setu/actions/runs/99999');
    });
  });

  describe('recordDeployment', () => {
    it('prevents marking production deployment SUCCESS without explicit provider confirmation', () => {
      const unconfirmed = service.recordDeployment({
        deploymentId: 'd_1',
        commitSha: 'abcdef1',
        environment: DEPLOYMENT_ENVIRONMENT.PRODUCTION,
        status: PIPELINE_STATUS.SUCCESS,
        providerConfirmed: false // Not yet verified by Vercel
      });

      expect(unconfirmed.status).toBe(PIPELINE_STATUS.PENDING);
      expect(unconfirmed.url).toBeNull();

      const confirmed = service.recordDeployment({
        deploymentId: 'd_2',
        commitSha: 'abcdef1',
        environment: DEPLOYMENT_ENVIRONMENT.PRODUCTION,
        status: PIPELINE_STATUS.SUCCESS,
        url: 'https://civic-help-setu.org',
        providerConfirmed: true
      });

      expect(confirmed.status).toBe(PIPELINE_STATUS.SUCCESS);
      expect(confirmed.url).toBe('https://civic-help-setu.org');
    });
  });

  describe('getCommitPipelineStatus', () => {
    it('aggregates workflow and deployment health for a given commit', () => {
      service.recordWorkflowRun({
        runId: '1',
        workflowName: 'Unit Tests',
        commitSha: 'a1b2c3d',
        status: PIPELINE_STATUS.SUCCESS
      });
      service.recordWorkflowRun({
        runId: '2',
        workflowName: 'Build & Lint',
        commitSha: 'a1b2c3d',
        status: PIPELINE_STATUS.SUCCESS
      });
      service.recordDeployment({
        deploymentId: 'dep_1',
        commitSha: 'a1b2c3d',
        environment: DEPLOYMENT_ENVIRONMENT.PREVIEW,
        status: PIPELINE_STATUS.SUCCESS,
        providerConfirmed: true
      });

      const status = service.getCommitPipelineStatus('a1b2c3d');
      expect(status.runsCount).toBe(2);
      expect(status.deploymentsCount).toBe(1);
      expect(status.overallStatus).toBe(PIPELINE_STATUS.SUCCESS);
    });
  });
});
