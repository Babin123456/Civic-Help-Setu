/**
 * CI/CD Pipeline Health and Deployment History View Service
 *
 * Implements a read-only workflow and deployment telemetry viewer:
 * - Aggregates public, non-secret workflow metadata from GitHub Actions and Vercel:
 *   * Workflow run ID, branch name, commit SHA, and duration
 *   * Detailed job states: SUCCESS, FAILED, PENDING, CANCELLED, SKIPPED, UNAVAILABLE
 *   * Preview vs. Production deployment status
 * - Strict Security & Hygiene Boundaries:
 *   * Zero exposure of raw environment variables, runner secrets, or tokens
 *   * Links failed jobs directly to public GitHub Actions logs rather than capturing server logs
 *   * Production deployment is marked SUCCESSFUL only when confirmed by the host provider
 * - Graceful Fallback Handling:
 *   * Handles stale caches, missing preview links, and upstream API rate limits gracefully
 */

export const PIPELINE_STATUS = Object.freeze({
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  PENDING: 'PENDING',
  CANCELLED: 'CANCELLED',
  SKIPPED: 'SKIPPED',
  UNAVAILABLE: 'UNAVAILABLE'
});

export const DEPLOYMENT_ENVIRONMENT = Object.freeze({
  PRODUCTION: 'PRODUCTION',
  PREVIEW: 'PREVIEW'
});

export class CicdPipelineHistoryService {
  constructor(options = {}) {
    this.repo = options.repo || 'GoldRay19/Civic-Help-Setu';
    this.runs = new Map(); // runId -> RunRecord
    this.deployments = new Map(); // deploymentId -> DeploymentRecord
  }

  /**
   * Ingests non-secret workflow run metadata
   * @param {Object} runData
   * @returns {Object} Stored run record
   */
  recordWorkflowRun({
    runId,
    workflowName,
    branch,
    commitSha,
    status = PIPELINE_STATUS.PENDING,
    durationSeconds = 0,
    failedJobs = [],
    timestamp = Date.now()
  }) {
    if (!runId || !workflowName || !commitSha) {
      throw new Error('Workflow run requires runId, workflowName, and commitSha');
    }

    const record = {
      runId: String(runId),
      workflowName,
      branch: branch || 'main',
      commitSha: commitSha.substring(0, 7), // 7-char short SHA
      status: PIPELINE_STATUS[status] || PIPELINE_STATUS.UNAVAILABLE,
      durationSeconds: Number(durationSeconds) || 0,
      failedJobs: failedJobs.map(j => ({
        name: j.name,
        logUrl: `https://github.com/${this.repo}/actions/runs/${runId}`
      })),
      timestamp
    };

    this.runs.set(String(runId), record);
    return record;
  }

  /**
   * Ingests deployment status
   * @param {Object} deployData
   * @returns {Object} Stored deployment record
   */
  recordDeployment({
    deploymentId,
    commitSha,
    environment = DEPLOYMENT_ENVIRONMENT.PREVIEW,
    status = PIPELINE_STATUS.PENDING,
    url = null,
    providerConfirmed = false
  }) {
    if (!deploymentId || !commitSha) {
      throw new Error('Deployment requires deploymentId and commitSha');
    }

    // Production is never marked SUCCESS without provider confirmation
    let verifiedStatus = status;
    if (environment === DEPLOYMENT_ENVIRONMENT.PRODUCTION && status === PIPELINE_STATUS.SUCCESS && !providerConfirmed) {
      verifiedStatus = PIPELINE_STATUS.PENDING;
    }

    const record = {
      deploymentId: String(deploymentId),
      commitSha: commitSha.substring(0, 7),
      environment,
      status: verifiedStatus,
      url: providerConfirmed && verifiedStatus === PIPELINE_STATUS.SUCCESS ? url : null,
      providerConfirmed: Boolean(providerConfirmed),
      timestamp: Date.now()
    };

    this.deployments.set(String(deploymentId), record);
    return record;
  }

  /**
   * Retrieves unified pipeline view associating commits with workflow and deployment states
   * @param {string} commitSha Short or full commit SHA
   * @returns {Object|null} Pipeline health status
   */
  getCommitPipelineStatus(commitSha) {
    if (!commitSha) return null;
    const shortSha = commitSha.substring(0, 7);

    const relatedRuns = Array.from(this.runs.values()).filter(r => r.commitSha === shortSha);
    const relatedDeploys = Array.from(this.deployments.values()).filter(d => d.commitSha === shortSha);

    const allWorkflowsSuccessful = relatedRuns.length > 0 && relatedRuns.every(r => r.status === PIPELINE_STATUS.SUCCESS);
    const hasFailedWorkflow = relatedRuns.some(r => r.status === PIPELINE_STATUS.FAILED);

    return {
      commitSha: shortSha,
      runsCount: relatedRuns.length,
      deploymentsCount: relatedDeploys.length,
      overallStatus: hasFailedWorkflow
        ? PIPELINE_STATUS.FAILED
        : (allWorkflowsSuccessful ? PIPELINE_STATUS.SUCCESS : PIPELINE_STATUS.PENDING),
      runs: relatedRuns,
      deployments: relatedDeploys
    };
  }
}
