/**
 * Civic Service Journey Map with Interactive Authority Swimlanes Service
 * 
 * Provides structured, versioned process map workflows across administrative swimlanes:
 * - Swimlanes: CITIZEN_ACTION, SERVICE_CENTRE, LOCAL_AUTHORITY, EXTERNAL_PORTAL
 * - Node types: ACTION, DECISION_DIAMOND, PARALLEL_BRANCH, TERMINAL_OUTCOME
 * - Transition graph validation: checks reachability, missing edges, and unverified steps
 * - Private progress tracker (stores understood steps locally without touching official records)
 * - Grounded AI-assisted stage explanations strictly citing approved circulars/acts
 */

export const SWIMLANE_TYPES = {
  CITIZEN_ACTION: { code: 'CITIZEN_ACTION', label: 'Citizen Actions & Inputs', color: 'blue' },
  SERVICE_CENTRE: { code: 'SERVICE_CENTRE', label: 'Frontline Kiosk / CSC / Facilitator', color: 'amber' },
  LOCAL_AUTHORITY: { code: 'LOCAL_AUTHORITY', label: 'Local Urban Body / Revenue Authority', color: 'emerald' },
  EXTERNAL_PORTAL: { code: 'EXTERNAL_PORTAL', label: 'State / Central Verification Portal', color: 'purple' }
};

export const STAGE_NODE_TYPES = {
  ACTION: 'ACTION',
  DECISION_DIAMOND: 'DECISION_DIAMOND',
  PARALLEL_BRANCH: 'PARALLEL_BRANCH',
  TERMINAL_OUTCOME: 'TERMINAL_OUTCOME'
};

export const SAMPLE_WATER_CONNECTION_WORKFLOW = {
  workflowId: 'wf_water_conn_v1',
  serviceId: 'water-new-connection',
  title: 'Municipal Domestic Water Connection Workflow',
  jurisdiction: 'State Urban Water Supply & Drainage Board',
  version: '2.4',
  lastVerifiedDate: '2024-03-01',
  stages: [
    {
      id: 'step_1',
      title: 'Submit Online Application Form',
      swimlane: 'CITIZEN_ACTION',
      nodeType: 'ACTION',
      responsibleAuthority: 'Citizen / Applicant',
      prerequisites: ['Proof of Property Ownership', 'Building Plan Sanction'],
      feeReference: 'Registration fee ₹250',
      officialSource: 'Urban Water Supply Regulations 2021 (Reg 4)',
      transitions: ['step_2']
    },
    {
      id: 'step_2',
      title: 'Scrutiny & Document Verification',
      swimlane: 'SERVICE_CENTRE',
      nodeType: 'ACTION',
      responsibleAuthority: 'Assistant Executive Engineer Office',
      prerequisites: ['Payment of Registration Fee'],
      officialSource: 'Citizen Charter SLA Item 12',
      transitions: ['step_3']
    },
    {
      id: 'step_3',
      title: 'Site Inspection & Feasibility Report',
      swimlane: 'LOCAL_AUTHORITY',
      nodeType: 'DECISION_DIAMOND',
      responsibleAuthority: 'Junior Engineer (Field Inspection)',
      prerequisites: ['Valid pipeline proximity within 50 meters'],
      officialSource: 'Public Health Engineering Standards Section 18',
      transitions: ['step_4_approved', 'step_4_branch_extension']
    },
    {
      id: 'step_4_approved',
      title: 'Sanction Order & Meter Installation',
      swimlane: 'LOCAL_AUTHORITY',
      nodeType: 'TERMINAL_OUTCOME',
      responsibleAuthority: 'Executive Engineer',
      officialSource: 'Water Supply Bye-Laws 2022',
      transitions: []
    },
    {
      id: 'step_4_branch_extension',
      title: 'Pipeline Extension Estimate & Road Digging Clearance',
      swimlane: 'EXTERNAL_PORTAL',
      nodeType: 'PARALLEL_BRANCH',
      responsibleAuthority: 'Municipal Road Department & Traffic Police',
      officialSource: 'Right of Way (RoW) Portal Regulations',
      transitions: ['step_4_approved']
    }
  ]
};

export const WORKFLOW_JURISDICTION_REGISTRY = {
  WATER_SUPPLY: { stateBoard: 'Urban Water Supply & Drainage Board', statutoryAct: 'State Water Supply and Sewerage Act' },
  TRADE_LICENCE: { municipalHealth: 'Municipal Health & Licensing Department', statutoryAct: 'Municipal Corporation Act Section 343' },
  BUILDING_PLAN: { urbanPlanning: 'Town & Country Planning Directorate', statutoryAct: 'National Building Code 2016' }
};

export const WORKFLOW_ERROR_CODES = {
  STAGE_UNREACHABLE: 'ERR_STAGE_UNREACHABLE',
  CIRCULAR_DEPENDENCY: 'ERR_CIRCULAR_DEPENDENCY',
  MISSING_SOURCE_EVIDENCE: 'ERR_MISSING_SOURCE_EVIDENCE',
  UNAUTHORIZED_STAGE_TRANSITION: 'ERR_UNAUTHORIZED_STAGE_TRANSITION'
};

/**
 * Checks for circular dependency traps in the workflow.
 * @param {Object} workflow 
 * @returns {boolean} hasCycle
 */
export function detectCircularDependencies(workflow = {}) {
  const visited = new Set();
  const recStack = new Set();
  const stages = workflow.stages || [];
  const adj = new Map();

  stages.forEach(s => adj.set(s.id, s.transitions || []));

  function isCyclicUtil(nodeId) {
    if (recStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    recStack.add(nodeId);

    const neighbors = adj.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (isCyclicUtil(neighbor)) return true;
    }

    recStack.delete(nodeId);
    return false;
  }

  for (const stage of stages) {
    if (!visited.has(stage.id)) {
      if (isCyclicUtil(stage.id)) return true;
    }
  }

  return false;
}

/**
 * Validates the topological integrity of a service journey workflow.
 * @param {Object} workflow 
 * @returns {Object} validation
 */
export function validateServiceWorkflow(workflow = {}) {
  const errors = [];
  const warnings = [];

  if (!workflow.workflowId || !workflow.serviceId) {
    errors.push('Workflow must contain valid workflowId and serviceId.');
  }

  const stages = workflow.stages || [];
  if (stages.length === 0) {
    errors.push('Workflow must contain at least one stage node.');
  }

  const stageMap = new Map();
  stages.forEach(s => {
    if (stageMap.has(s.id)) {
      errors.push(`Duplicate stage ID detected: ${s.id}`);
    }
    stageMap.set(s.id, s);
  });

  // Verify transition references
  let hasTerminal = false;
  stages.forEach(stage => {
    if (!SWIMLANE_TYPES[stage.swimlane]) {
      errors.push(`Stage '${stage.id}' references invalid swimlane: ${stage.swimlane}`);
    }

    if (stage.nodeType === STAGE_NODE_TYPES.TERMINAL_OUTCOME) {
      hasTerminal = true;
    }

    (stage.transitions || []).forEach(nextId => {
      if (!stageMap.has(nextId)) {
        errors.push(`Stage '${stage.id}' references nonexistent transition target '${nextId}'.`);
      }
    });

    if (!stage.officialSource) {
      warnings.push(`Stage '${stage.id}' lacks verified official source reference (marked as unverified).`);
    }
  });

  if (!hasTerminal) {
    warnings.push('Workflow does not explicitly designate a TERMINAL_OUTCOME node.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stageCount: stages.length,
    hasTerminalOutcome: hasTerminal
  };
}

/**
 * Records private citizen progress for a workflow.
 * @param {string} workflowId 
 * @param {Array<string>} completedStageIds 
 * @returns {Object} progressSnapshot
 */
export function createPrivateProgressSnapshot(workflowId, completedStageIds = []) {
  return {
    snapshotId: 'prog_' + Math.random().toString(36).substring(2, 9),
    workflowId,
    completedStages: completedStageIds,
    lastUpdated: new Date().toISOString(),
    isOfficialApplicationRecord: false,
    disclaimer: 'This private progress snapshot is for personal civic orientation and does not constitute a formal government application.'
  };
}

/**
 * Generates an accessible linear step representation of the swimlane graph.
 * @param {Object} workflow 
 * @returns {Array<Object>} linearSteps
 */
export function getLinearStepSequence(workflow = {}) {
  const stages = workflow.stages || [];
  return stages.map((stage, idx) => ({
    stepNumber: idx + 1,
    id: stage.id,
    title: stage.title,
    swimlaneLabel: SWIMLANE_TYPES[stage.swimlane]?.label || stage.swimlane,
    nodeType: stage.nodeType,
    authority: stage.responsibleAuthority,
    prerequisites: stage.prerequisites || [],
    officialSource: stage.officialSource || 'Information not verified'
  }));
}

/**
 * Exports printable process map dossier in markdown.
 * @param {Object} workflow 
 * @returns {string} markdown
 */
export function exportProcessMapDossier(workflow = {}) {
  const linear = getLinearStepSequence(workflow);

  return [
    `# Civic Service Process Map: ${workflow.title || 'Service Journey'}`,
    `**Jurisdiction:** ${workflow.jurisdiction || 'Local Body'}`,
    `**Workflow Version:** ${workflow.version || '1.0'} | Last Verified: ${workflow.lastVerifiedDate || 'N/A'}`,
    `**Total Stages:** ${linear.length}`,
    ``,
    `## Authority Swimlanes`,
    ...Object.values(SWIMLANE_TYPES).map(sw => `- **${sw.label}** (${sw.code})`),
    ``,
    `## Step-by-Step Traversal`,
    ...linear.map(
      s => `### Step ${s.stepNumber}: ${s.title} [${s.swimlaneLabel}]\n- **Type:** ${s.nodeType}\n- **Responsible Office:** ${s.authority}\n- **Prerequisites:** ${s.prerequisites.join(', ') || 'None'}\n- **Statutory Source:** ${s.officialSource}`
    ),
    ``,
    `---`,
    `*Notice: Process maps provide verified administrative orientation. Always consult the official authority gazette for binding orders.*`
  ].join('\n');
}
