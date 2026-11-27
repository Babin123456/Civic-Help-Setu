// Multi-Agent Civic Casework Orchestrator
// =======================================
// Versioned state machine orchestrating specialist agents (intake, policy-retrieval,
// evidence, form-assistance, quality-review) with human approval gates.
// All AI/agent outputs are treated as untrusted proposals requiring human approval
// for high-impact actions.

import {
  AGENT_SCHEMA_VERSION,
  AGENT_STATUS,
  AGENT_PRIORITY,
  CASE_STATE_TRANSITIONS,
  HIGH_IMPACT_ACTIONS,
  validateAgentInput,
  validateAgentOutput,
  requiresCitizenApproval,
  syntheticFixtures,
  AgentOutputProposal,
  ApprovalResult,
} from '../data/agentContract.js';

import {
  createCase,
  updateCaseState,
  recordAgentProposal,
  createApprovalGate,
  respondToApprovalGate,
  getApprovalGate,
  hasPendingApprovalGate,
  getPendingApprovalGates,
  cancelCase,
  canRetry,
  incrementRetry,
  checkSLA,
  serializeCaseState,
} from '../data/agentProvenanceStorage.js';

import { logDiagnostic } from '../utils/diagnostics.js';

/**
 * Agent handler interfaces - each agent receives a case context and returns
 * a proposal that must pass through the approval gate.
 */

// Intake Agent: Initial citizen intake and case setup
export const IntakeAgent = {
  name: 'intake',

  /**
   * Process citizen intake input and transition to policy retrieval
   */
  async process(caseContext) {
    const { input, citizenId, caseType } = caseContext;

    // Validate input at service boundary
    const inputValidation = validateAgentInput(input, 'intake');
    if (!inputValidation.valid) {
      const error = `Intake agent: Invalid input - ${inputValidation.errors.join(', ')}`;
      logDiagnostic(error, 'error');
      return {
        success: false,
        error: error,
        proposal: null,
        status: AGENT_STATUS.FAILED,
      };
    }

    // Record starting state
    const now = new Date().toISOString();

    // Build proposal - intake completes case setup
    const proposal = {
      proposal: {
        caseId: caseContext.caseId,
        citizenId,
        caseType,
        summary: synthesizeIntakeSummary(input.intakeData),
        eligibilityHints: extractEligibilityHints(input.intakeData),
      },
      citations: [
        { source: 'intake-procedure', url: '#', excerpt: 'Standard intake procedure' },
      ],
      confidence: 0.85,
      requiresApproval: false, // Intake does not submit externally
      impactLevel: 'low',
      rationale: 'Citizen intake completed; case ready for policy retrieval',
      agentName: this.name,
      timestamp: now,
    };

    // Record the proposal
    const caseState = caseContext.caseState;
    const recordResult = recordAgentProposal(caseState, proposal);
    if (!recordResult.success) {
      return { success: false, error: recordResult.error };
    }

    // Update state to policy retrieval queued
    const stateResult = updateCaseState(caseState, 'policy_retrieval_queued');
    if (!stateResult.success) {
      return { success: false, error: stateResult.error };
    }

    return {
      success: true,
      proposal,
      status: AGENT_STATUS.COMPLETED,
      nextState: 'policy_retrieval_queued',
    };
  },
};

// Policy Retrieval Agent: Retrieves relevant policies/schemes
export const PolicyRetrievalAgent = {
  name: 'policy-retrieval',

  /**
   * Process policy query and return matching schemes
   */
  async process(caseContext) {
    const { input, citizenId, caseType, caseState } = caseContext;

    // Validate input at service boundary
    const inputValidation = validateAgentInput(input, 'policy');
    if (!inputValidation.valid) {
      const error = `Policy retrieval agent: Invalid input - ${inputValidation.errors.join(', ')}`;
      logDiagnostic(error, 'error');
      return {
        success: false,
        error: error,
        proposal: null,
        status: AGENT_STATUS.FAILED,
      };
    }

    const now = new Date().toISOString();

    // Simulate policy retrieval - in production this would query schemes database
    const proposal = {
      proposal: {
        matchingSchemes: retrieveMatchingSchemes(input.query, citizenId, caseType),
        policyGaps: identifyPolicyGaps(input.query),
        nextSteps: generateNextSteps(input.query),
      },
      citations: [
        { source: 'scheme-catalogue', url: '#', excerpt: 'Relevant welfare schemes' },
        { source: 'jurisdiction-rules', url: '#', excerpt: 'Applicable jurisdictional rules' },
      ],
      confidence: 0.78,
      requiresApproval: false, // Policy retrieval is informational only
      impactLevel: 'low',
      rationale: 'Policy schemes identified; case ready for evidence organization',
      agentName: this.name,
      timestamp: now,
    };

    // Record the proposal
    const recordResult = recordAgentProposal(caseState, proposal);
    if (!recordResult.success) {
      return { success: false, error: recordResult.error };
    }

    // Update state to evidence organization queued
    const stateResult = updateCaseState(caseState, 'evidence_organization_queued');
    if (!stateResult.success) {
      return { success: false, error: stateResult.error };
    }

    return {
      success: true,
      proposal,
      status: AGENT_STATUS.COMPLETED,
      nextState: 'evidence_organization_queued',
    };
  },
};

// Evidence Organization Agent: Organizes evidence documents
export const EvidenceOrganizationAgent = {
  name: 'evidence-organization',

  /**
   * Process evidence items and organize them
   */
  async process(caseContext) {
    const { input, citizenId, caseType, caseState } = caseContext;

    // Validate input at service boundary
    const inputValidation = validateAgentInput(input, 'evidence');
    if (!inputValidation.valid) {
      const error = `Evidence organization agent: Invalid input - ${inputValidation.errors.join(', ')}`;
      logDiagnostic(error, 'error');
      return {
        success: false,
        error: error,
        proposal: null,
        status: AGENT_STATUS.FAILED,
      };
    }

    const now = new Date().toISOString();

    // Organize and validate evidence items
    const organizedEvidence = input.evidenceItems.map((item) => ({
      ...item,
      status: 'organized',
      organizedAt: now,
      provenance: {
        source: item.description || item.type,
        organizedBy: 'evidence-organization-agent',
      },
    }));

    const proposal = {
      proposal: {
        organizedEvidence,
        evidenceGaps: identifyEvidenceGaps(input.evidenceItems),
        provenanceScore: calculateProvenanceScore(input.evidenceItems),
      },
      citations: [
        { source: 'evidence-catalogue', url: '#', excerpt: 'Organized evidence records' },
      ],
      confidence: 0.82,
      requiresApproval: false, // Evidence org is organizational, no external submission
      impactLevel: 'low',
      rationale: 'Evidence organized; case ready for form assistance',
      agentName: this.name,
      timestamp: now,
    };

    // Record the proposal
    const recordResult = recordAgentProposal(caseState, proposal);
    if (!recordResult.success) {
      return { success: false, error: recordResult.error };
    }

    // Update state to form assistance queued
    const stateResult = updateCaseState(caseState, 'form_assistance_queued');
    if (!stateResult.success) {
      return { success: false, error: stateResult.error };
    }

    return {
      success: true,
      proposal,
      status: AGENT_STATUS.COMPLETED,
      nextState: 'form_assistance_queued',
    };
  },
};

// Form Assistance Agent: drafts forms based on evidence and policies
export const FormAssistanceAgent = {
  name: 'form-assistance',

  /**
   * Generate draft form filling with citizen approval gate
   */
  async process(caseContext) {
    const { input, citizenId, caseType, caseState } = caseContext;

    // Validate input at service boundary
    const inputValidation = validateAgentInput(input, 'form-assistance');
    if (!inputValidation.valid) {
      const error = `Form assistance agent: Invalid input - ${inputValidation.errors.join(', ')}`;
      logDiagnostic(error, 'error');
      return {
        success: false,
        error: error,
        proposal: null,
        status: AGENT_STATUS.FAILED,
      };
    }

    const now = new Date().toISOString();

    // Generate draft form data
    const draftForm = generateDraftForm(input.formType, input.formData, caseContext);

    const proposal = {
      proposal: {
        draftForm,
        formVersion: '1.0',
        suggestions: generateFormSuggestions(input.formData),
        missingFields: checkMissingFields(input.formType, input.formData),
      },
      citations: [
        { source: 'form-template', url: '#', excerpt: 'Standard form template' },
        { source: 'scheme-requirements', url: '#', excerpt: 'Scheme-specific requirements' },
      ],
      confidence: 0.88,
      requiresApproval: true, // Form submission requires citizen approval
      impactLevel: 'high',
      rationale: 'Draft form generated; requires explicit citizen approval before submission',
      agentName: this.name,
      timestamp: now,
    };

    // Record the proposal
    const recordResult = recordAgentProposal(caseState, proposal);
    if (!recordResult.success) {
      return { success: false, error: recordResult.error };
    }

    // Create approval gate for form submission
    // This is the key human approval gate - no external submission without citizen approval
    const gateResult = createApprovalGate(caseState, HIGH_IMPACT_ACTIONS.SUBMIT_FORM, 'high');
    if (!gateResult.success) {
      return { success: false, error: gateResult.error };
    }

    // Update state to form assistance in progress (approval_required will be set after gate response)
    const stateResult = updateCaseState(caseState, 'form_assistance_in_progress');
    if (!stateResult.success) {
      return { success: false, error: stateResult.error };
    }

    return {
      success: true,
      proposal,
      gateId: gateResult.gateId,
      status: AGENT_STATUS.APPROVAL_REQUIRED,
      nextState: 'form_assistance_approval_required',
      requiresCitizenApproval: true,
    };
  },
};

// Quality Review Agent: Reviews draft for completeness and compliance
export const QualityReviewAgent = {
  name: 'quality-review',

  /**
   * Review draft content for completeness, compliance, and quality
   */
  async process(caseContext) {
    const { input, citizenId, caseType, caseState } = caseContext;

    // Validate input at service boundary
    const inputValidation = validateAgentInput(input, 'quality-review');
    if (!inputValidation.valid) {
      const error = `Quality review agent: Invalid input - ${inputValidation.errors.join(', ')}`;
      logDiagnostic(error, 'error');
      return {
        success: false,
        error: error,
        proposal: null,
        status: AGENT_STATUS.FAILED,
      };
    }

    const now = new Date().toISOString();

    // Perform quality review checks
    const reviewResults = performQualityReview(input.content, caseContext);

    const proposal = {
      proposal: {
        qualityScore: reviewResults.score,
        complianceIssues: reviewResults.complianceIssues,
        recommendations: reviewResults.recommendations,
        areasForImprovement: reviewResults.areasForImprovement,
      },
      citations: [
        { source: 'quality-standards', url: '#', excerpt: 'Civic form quality standards' },
        { source: 'compliance-rules', url: '#', excerpt: 'Applicable compliance rules' },
      ],
      confidence: reviewResults.confidence,
      requiresApproval: reviewResults.requiresHumanReview,
      impactLevel: 'medium',
      rationale: reviewResults.rationale,
      agentName: this.name,
      timestamp: now,
    };

    // Record the proposal
    const recordResult = recordAgentProposal(caseState, proposal);
    if (!recordResult.success) {
      return { success: false, error: recordResult.error };
    }

    // Check if approval is needed based on quality issues
    const shouldRequireApproval = reviewResults.requiresHumanReview || proposal.impactLevel === 'high';

    let nextState = 'quality_review_completed';
    let status = AGENT_STATUS.COMPLETED;

    if (shouldRequireApproval) {
      nextState = 'quality_review_approval_required';
      status = AGENT_STATUS.APPROVAL_REQUIRED;

      // Create approval gate for quality approval
      const gateResult = createApprovalGate(caseState, HIGH_IMPACT_ACTIONS.CLAIM_BENEFIT, 'medium');
      if (gateResult.success) {
        // Update state to approval required
        const stateResult = updateCaseState(caseState, 'quality_review_approval_required');
        if (stateResult.success) {
          status = AGENT_STATUS.APPROVAL_REQUIRED;
        }
      }
    }

    return {
      success: true,
      proposal,
      status,
      nextState,
      requiresCitizenApproval: shouldRequireApproval,
    };
  },
};

/**
 * Core orchestrator - runs the versioned state machine
 */

export class CaseworkOrchestrator {
  constructor(firebaseAdmin) {
    db = firebaseAdmin.firestore();
    this.agents = {
      intake: IntakeAgent,
      'policy-retrieval': PolicyRetrievalAgent,
      evidence: EvidenceOrganizationAgent,
      'form-assistance': FormAssistanceAgent,
      'quality-review': QualityReviewAgent,
    };
  }

  /**
   * Start a new casework orchestrator case
   */
  async startCase(citizenId, caseType, tenantId) {
    const caseState = createCase(citizenId, caseType, tenantId);

    // Store initial state in Firestore
    const serialized = serializeCaseState(caseState);
    await db.collection('casework_orchestrator_cases').doc(caseState.caseId).set(serialized);

    // Set initial agent state
    caseState.agentStates.get('intake').status = AGENT_STATUS.RUNNING;
    caseState.startedAt = new Date().toISOString();

    await db.collection('casework_orchestrator_cases').doc(caseState.caseId).update({
      agentStates: caseState.agentStates,
      startedAt: caseState.startedAt,
    });

    return {
      success: true,
      caseId: caseState.caseId,
      initialState: caseState.state,
    };
  }

  /**
   * Execute the next step in the orchestrator state machine
   * @param {string} caseId - The case ID
   * @param {string} agentName - Name of the agent to run
   * @param {Object} input - Agent-specific input
   * @returns {Object} Execution result
   */
  async executeNextStep(caseId, agentName, input) {
    const caseDocRef = db.collection('casework_orchestrator_cases').doc(caseId);
    const caseDoc = await caseDocRef.get();

    if (!caseDoc.exists) {
      const error = `Case ${caseId} not found`;
      logDiagnostic(error, 'error');
      return { success: false, error };
    }

    const caseState = caseDoc.data();
    const Agent = this.agents[agentName];

    if (!Agent) {
      const error = `Agent ${agentName} not found in orchestrator registry`;
      logDiagnostic(error, 'error');
      return { success: false, error };
    }

    // Check if agent is already running or case is cancelled
    const agentState = caseState.agentStates.get(agentName);
    if (agentState && agentState.status === AGENT_STATUS.RUNNING) {
      return { success: false, error: `Agent ${agentName} is already running for this case` };
    }

    if (caseState.cancelled) {
      return { success: false, error: 'Case has been cancelled' };
    }

    // Set agent to running status
    const now = new Date().toISOString();
    caseState.agentStates.set(agentName, {
      status: AGENT_STATUS.RUNNING,
      startedAt: now,
      completedAt: null,
    });

    await caseDocRef.update({
      agentStates: caseState.agentStates,
      updatedAt: now,
    });

    try {
      // Execute agent process
      const context = {
        caseId,
        citizenId: caseState.citizenId,
        caseType: caseState.caseType,
        input,
        caseState, // Full case state for recording proposals and gates
      };

      const result = await Agent.process(context);

      if (!result.success) {
        // Agent failed - handle retry logic
        caseState = incrementRetry(caseState);

        if (!canRetry(caseState)) {
          // Max retries exceeded - move to failed state
          caseState = cancelCase(caseState, 'Max retries exceeded');
          await caseDocRef.update({
            state: caseState.state,
            retryCount: caseState.retryCount,
            cancelled: caseState.cancelled,
            updatedAt: caseState.updatedAt,
          });
          return {
            success: false,
            error: 'Agent failed after max retries',
            status: AGENT_STATUS.FAILED,
          };
        }

        // Retry - update state and re-queue
        caseState.retryCount = caseState.retryCount; // already incremented
        await caseDocRef.update({
          retryCount: caseState.retryCount,
          agentStates: caseState.agentStates,
          updatedAt: caseState.updatedAt,
        });

        return {
          success: false,
          error: result.error,
          status: AGENT_STATUS.FAILED,
          retryable: true,
        };
      }

      // Agent completed successfully - update agent state
      caseState.agentStates.set(agentName, {
        status: result.status || AGENT_STATUS.COMPLETED,
        result: result.proposal ? result.proposal.proposal : null,
        error: null,
        startedAt: result.startedAt || caseState.agentStates.get(agentName).startedAt,
        completedAt: now,
      });

      await caseDocRef.update({
        agentStates: caseState.agentStates,
        updatedAt: caseState.updatedAt,
      });

      // Check if we need to move to next state
      // If this was the last agent in the pipeline, or if approval is required
      if (result.requiresCitizenApproval && result.gateId) {
        // Check for pending approval gates
        const approvalGate = getApprovalGate(caseState, result.gateId);
        if (approvalGate && approvalGate.status === 'pending') {
          // Wait for citizen approval - stay in current state
          return {
            success: true,
            status: AGENT_STATUS.APPROVAL_REQUIRED,
            gateId: result.gateId,
            message: 'Awaiting citizen approval',
            requiresCitizenApproval: true,
          };
        }
      }

      // Determine next state based on orchestrator transitions
      let nextState = result.nextState || 'intake_completed';

      // Fetch current state to determine valid transition
      const currentState = caseState.state;

      const validTransitions = CASE_STATE_TRANSITIONS[currentState];
      if (validTransitions && validTransitions.includes(nextState)) {
        updateCaseState(caseState, nextState);
        await caseDocRef.update({
          state: caseState.state,
          updatedAt: caseState.updatedAt,
        });
      } else if (validTransitions) {
        // Use first valid transition
        updateCaseState(caseState, validTransitions[0]);
        await caseDocRef.update({
          state: caseState.state,
          updatedAt: caseState.updatedAt,
        });
      }

      return {
        success: true,
        status: result.status || AGENT_STATUS.COMPLETED,
        nextState: caseState.state,
        proposal: result.proposal,
        requiresCitizenApproval: result.requiresCitizenApproval || hasPendingApprovalGate(caseState),
      };

    } catch (err) {
      // Unexpected error - increment retry
      logDiagnostic(`Orchestrator error for agent ${agentName}: ${err.message}`, 'error');

      caseState = incrementRetry(caseState);

      if (!canRetry(caseState)) {
        caseState = cancelCase(caseState, 'Unexpected error after max retries');
        await caseDocRef.update({
          state: caseState.state,
          retryCount: caseState.retryCount,
          cancelled: caseState.cancelled,
          updatedAt: caseState.updatedAt,
        });
        return {
          success: false,
          error: 'Unexpected agent error after max retries',
          status: AGENT_STATUS.FAILED,
        };
      }

      await caseDocRef.update({
        retryCount: caseState.retryCount,
        agentStates: caseState.agentStates,
        updatedAt: caseState.updatedAt,
      });

      return {
        success: false,
        error: err.message,
        status: AGENT_STATUS.FAILED,
        retryable: true,
      };
    }
  }

  /**
   * Citizen responds to an approval gate
   */
  async respondToApproval(caseId, gateId, response) {
    const caseDocRef = db.collection('casework_orchestrator_cases').doc(caseId);
    const caseDoc = await caseDocRef.get();

    if (!caseDoc.exists) {
      return { success: false, error: 'Case not found' };
    }

    const caseState = caseDoc.data();
    const result = respondToApprovalGate(caseState, gateId, response);

    if (!result.success) {
      return result;
    }

    await caseDocRef.update({
      approvalGates: caseState.approvalGates,
      updatedAt: caseState.updatedAt,
    });

    if (result.gate.status === 'approved') {
      // Approved - proceed based on gate action type
      const gate = result.gate;
      const currentState = caseState.state;

      // Determine next state based on which gate was approved
      if (gate.actionType === HIGH_IMPACT_ACTIONS.SUBMIT_FORM) {
        // Form submission approved - move to submission_approved
        const validTransitions = CASE_STATE_TRANSITIONS[currentState];
        if (validTransitions && validTransitions.includes('submission_approved')) {
          updateCaseState(caseState, 'submission_approved');
        } else {
          // Find a reasonable next state
          updateCaseState(caseState, 'quality_review_completed');
        }
      } else if (gate.actionType === HIGH_IMPACT_ACTIONS.CLAIM_BENEFIT) {
        // Benefit claim approved
        const validTransitions = CASE_STATE_TRANSITIONS[currentState];
        if (validTransitions && validTransitions.includes('submission_approved')) {
          updateCaseState(caseState, 'submission_approved');
        }
      }

      await caseDocRef.update({
        state: caseState.state,
        updatedAt: caseState.updatedAt,
      });
    }

    return {
      success: true,
      approved: result.gate.status === 'approved',
      state: caseState.state,
    };
  }

  /**
   * Cancel a case
   */
  async cancelCase(caseId, reason) {
    const caseDocRef = db.collection('casework_orchestrator_cases').doc(caseId);
    const caseDoc = await caseDocRef.get();

    if (!caseDoc.exists) {
      return { success: false, error: 'Case not found' };
    }

    const caseState = caseDoc.data();
    const cancelledCase = cancelCase(caseState, reason);

    await caseDocRef.update({
      state: cancelledCase.state,
      cancelled: cancelledCase.cancelled,
      cancellationReason: cancelledCase.cancellationReason,
      updatedAt: cancelledCase.updatedAt,
      agentStates: cancelledCase.agentStates,
    });

    return {
      success: true,
      caseId,
      state: cancelledCase.state,
    };
  }

  /**
   * Get case status
   */
  async getCaseStatus(caseId) {
    const caseDocRef = db.collection('casework_orchestrator_cases').doc(caseId);
    const caseDoc = await caseDocRef.get();

    if (!caseDoc.exists) {
      return { success: false, error: 'Case not found' };
    }

    const caseState = caseDoc.data();

    return {
      success: true,
      caseId,
      state: caseState.state,
      schemaVersion: caseState.schemaVersion,
      agentStates: Object.fromEntries(caseState.agentStates || new Map()),
      approvalGates: Object.fromEntries(
        (caseState.approvalGates || new Map()).entries()
      ),
      retryCount: caseState.retryCount,
      cancelled: caseState.cancelled,
      createdAt: caseState.createdAt,
      updatedAt: caseState.updatedAt,
    };
  }

  /**
   * Get all cases for a tenant (with jurisdiction isolation)
   */
  async getTenantCases(tenantId, stateFilter) {
    let query = db.collection('casework_orchestrator_cases');

    if (stateFilter) {
      query = query.where('state', '===', stateFilter);
    }

    const snapshot = await query.get();
    const cases = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      // Tenant isolation - only return cases belonging to this tenant
      if (data.tenantId === tenantId) {
        cases.push({
          caseId: doc.id,
          state: data.state,
          caseType: data.caseType,
          citizenId: data.citizenId,
          retryCount: data.retryCount,
          cancelled: data.cancelled,
          createdAt: data.createdAt,
        });
      }
    });

    return {
      success: true,
      cases,
      count: cases.length,
    };
  }

  /**
   * Get orchestrator metrics/statistics
   */
  async getMetrics() {
    const snapshot = await db.collection('casework_orchestrator_cases').get();

    const totalCases = snapshot.size;
    const statusCounts = {};
    const agentCounts = {};
    let totalRetries = 0;
    let cancelledCount = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();

      // Status count
      const state = data.state;
      statusCounts[state] = (statusCounts[state] || 0) + 1;

      // Agent counts
      if (data.agentStates) {
        for (const [agentName, agentState] of Object.entries(data.agentStates)) {
          agentCounts[agentName] = (agentCounts[agentName] || 0) + 1;
        }
      }

      // Retry totals
      totalRetries += (data.retryCount || 0);

      // Cancelled count
      if (data.cancelled) {
        cancelledCount += 1;
      }
    });

    return {
      success: true,
      totalCases,
      statusCounts,
      agentCounts,
      totalRetries,
      cancelledCount,
      averageRetries: totalCases > 0 ? totalRetries / totalCases : 0,
    };
  }
}

// Export synthetic fixtures for tests
export { syntheticFixtures };

/**
 * Health check for the orchestrator service
 */
export async function healthCheck() {
  if (!db) {
    return { healthy: false, error: 'Firestore not initialized' };
  }

  try {
    const snapshot = await db.collection('casework_orchestrator_cases').limit(1).get();
    return { healthy: true, totalCases: snapshot.size };
  } catch (err) {
    return { healthy: false, error: err.message };
  }
}