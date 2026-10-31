/**
 * Application Preparation Plan Service (#398)
 * 
 * Generates an actionable, ordered checklist / preparation plan based strictly on
 * documented service requirements (required documents, eligibility criteria, process steps,
 * official portal/office endpoints, and fee structures).
 * 
 * Governance & Grounding Rules:
 * 1. Strict Grounding: Tasks are derived exclusively from verified service fields.
 *    Undocumented external prerequisite steps are never hallucinated or invented.
 * 2. Transparent Ordering: Ambiguous or dependent sequences are explicitly marked as
 *    advisory suggestions (isSuggestedOrder: true) rather than rigid legal mandates.
 * 3. Citizen Control: Users can toggle, edit, remove, or append personal preparation tasks.
 * 4. Traceability: Every task links back to its originating field, requirement text, and service ID.
 */

export const PREPARATION_PLANS_KEY = 'civicbridge_preparation_plans_v1';

export const TASK_CATEGORIES = {
  DOCUMENTS: 'DOCUMENTS',
  ELIGIBILITY: 'ELIGIBILITY',
  FEES: 'FEES',
  PROCESS: 'PROCESS',
  SUBMISSION: 'SUBMISSION',
  CUSTOM: 'CUSTOM',
};

let inMemoryPlans = {};

const getStorage = () => {
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
};

/**
 * Retrieve all stored preparation plans from storage or in-memory fallback
 */
export const getAllStoredPlans = () => {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(PREPARATION_PLANS_KEY);
      return raw ? JSON.parse(raw) : inMemoryPlans;
    } catch {
      return inMemoryPlans;
    }
  }
  return inMemoryPlans;
};

/**
 * Save user plan for a given service
 */
export const saveStoredPlan = (serviceId, plan) => {
  if (!serviceId || !plan) return false;
  inMemoryPlans[serviceId] = plan;

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(PREPARATION_PLANS_KEY, JSON.stringify(inMemoryPlans));
      return true;
    } catch {
      return false;
    }
  }
  return true;
};

/**
 * Retrieve saved plan for a service if one exists
 */
export const getStoredPlan = (serviceId) => {
  const all = getAllStoredPlans();
  return all[serviceId] || null;
};

/**
 * Delete a saved plan for a service
 */
export const clearStoredPlan = (serviceId) => {
  delete inMemoryPlans[serviceId];
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(PREPARATION_PLANS_KEY, JSON.stringify(inMemoryPlans));
    } catch {
      // ignore
    }
  }
};

/**
 * Clean string for display
 */
const cleanText = (val) => {
  if (typeof val === 'string') return val.trim();
  if (val && typeof val === 'object') {
    return val.name || val.title || val.text || JSON.stringify(val);
  }
  return '';
};

/**
 * Generate a deterministic preparation plan from structured service fields
 */
export const generatePreparationPlan = (service) => {
  if (!service || typeof service !== 'object') {
    return {
      serviceId: null,
      serviceTitle: 'Unknown Service',
      tasks: [],
      generatedAt: new Date().toISOString(),
      isAdvisoryOrder: true,
      summary: { total: 0, completed: 0, percentage: 0 },
    };
  }

  const sId = service.id || 'unidentified-service';
  const sTitle = service.title || service.name || 'Civic Service';
  const tasks = [];
  let stepNumber = 1;

  // 1. Eligibility Verification Tasks
  const criteriaList = Array.isArray(service.eligibility)
    ? service.eligibility
    : Array.isArray(service.criteria)
      ? service.criteria
      : typeof service.eligibility === 'string'
        ? [service.eligibility]
        : [];

  criteriaList.forEach((criterion, idx) => {
    const text = cleanText(criterion);
    if (!text) return;

    tasks.push({
      id: `${sId}-elig-${idx + 1}`,
      stepNumber: stepNumber++,
      title: `Verify eligibility: ${text}`,
      category: TASK_CATEGORIES.ELIGIBILITY,
      categoryLabel: 'Eligibility Self-Check',
      sourceField: 'eligibility',
      sourceRequirement: text,
      sourceServiceId: sId,
      sourceServiceName: sTitle,
      isMandatory: true,
      isSuggestedOrder: false,
      completed: false,
      notes: '',
    });
  });

  // 2. Document Collection Tasks
  const documentsList = Array.isArray(service.documents)
    ? service.documents
    : Array.isArray(service.requiredDocuments)
      ? service.requiredDocuments
      : [];

  documentsList.forEach((doc, idx) => {
    const text = cleanText(doc);
    if (!text) return;

    tasks.push({
      id: `${sId}-doc-${idx + 1}`,
      stepNumber: stepNumber++,
      title: `Gather document: ${text}`,
      category: TASK_CATEGORIES.DOCUMENTS,
      categoryLabel: 'Required Documents',
      sourceField: 'documents',
      sourceRequirement: text,
      sourceServiceId: sId,
      sourceServiceName: sTitle,
      isMandatory: true,
      // Document gathering order is advisory (citizens can gather any document first)
      isSuggestedOrder: true,
      completed: false,
      notes: '',
    });
  });

  // 3. Fee & Payment Readiness Tasks
  const feeInfo = service.fees || service.fee;
  const isPurelyFree = feeInfo && typeof feeInfo === 'string' &&
    ['free', 'free of cost', 'nil', 'none', '₹0', 'rs 0', 'rs. 0'].includes(feeInfo.trim().toLowerCase());
  if (feeInfo && typeof feeInfo === 'string' && !isPurelyFree) {
    tasks.push({
      id: `${sId}-fee-1`,
      stepNumber: stepNumber++,
      title: `Prepare application fee payment (${feeInfo})`,
      category: TASK_CATEGORIES.FEES,
      categoryLabel: 'Fee Readiness',
      sourceField: 'fees',
      sourceRequirement: feeInfo,
      sourceServiceId: sId,
      sourceServiceName: sTitle,
      isMandatory: false,
      isSuggestedOrder: true,
      completed: false,
      notes: 'Verify accepted payment modes (UPI/NetBanking or Demand Draft) at the time of submission.',
    });
  }

  // 4. Official Application Process Steps
  const processSteps = Array.isArray(service.process)
    ? service.process
    : Array.isArray(service.steps)
      ? service.steps
      : Array.isArray(service.applicationSteps)
        ? service.applicationSteps
        : [];

  processSteps.forEach((step, idx) => {
    const text = cleanText(step);
    if (!text) return;

    tasks.push({
      id: `${sId}-step-${idx + 1}`,
      stepNumber: stepNumber++,
      title: text,
      category: TASK_CATEGORIES.PROCESS,
      categoryLabel: 'Application Procedure',
      sourceField: 'process',
      sourceRequirement: text,
      sourceServiceId: sId,
      sourceServiceName: sTitle,
      isMandatory: true,
      isSuggestedOrder: false,
      completed: false,
      notes: '',
    });
  });

  // 5. Portal or Office Submission Endpoint
  if (service.officialUrl) {
    tasks.push({
      id: `${sId}-sub-portal`,
      stepNumber: stepNumber++,
      title: `Submit application on the official portal`,
      category: TASK_CATEGORIES.SUBMISSION,
      categoryLabel: 'Final Submission',
      sourceField: 'officialUrl',
      sourceRequirement: service.officialUrl,
      sourceServiceId: sId,
      sourceServiceName: sTitle,
      isMandatory: true,
      isSuggestedOrder: false,
      completed: false,
      notes: `Official Link: ${service.officialUrl}`,
    });
  } else if (service.officeLocations || service.department) {
    const destination = service.department || 'designated civic authority office';
    tasks.push({
      id: `${sId}-sub-office`,
      stepNumber: stepNumber++,
      title: `Submit application in-person at ${destination}`,
      category: TASK_CATEGORIES.SUBMISSION,
      categoryLabel: 'Final Submission',
      sourceField: service.officeLocations ? 'officeLocations' : 'department',
      sourceRequirement: destination,
      sourceServiceId: sId,
      sourceServiceName: sTitle,
      isMandatory: true,
      isSuggestedOrder: false,
      completed: false,
      notes: 'Check local working hours and token distribution before visiting.',
    });
  }

  // Minimal requirement fallback: if service has virtually no structured fields,
  // do NOT hallucinate external steps; provide clear grounded checklist
  if (tasks.length === 0) {
    tasks.push({
      id: `${sId}-minimal-1`,
      stepNumber: 1,
      title: `Review official guidelines for ${sTitle}`,
      category: TASK_CATEGORIES.PROCESS,
      categoryLabel: 'Preliminary Review',
      sourceField: 'general',
      sourceRequirement: 'General catalogue entry',
      sourceServiceId: sId,
      sourceServiceName: sTitle,
      isMandatory: true,
      isSuggestedOrder: false,
      completed: false,
      notes: 'This catalogue record has minimal structured fields. Consult the department directly for specific requirements.',
    });
  }

  const plan = {
    serviceId: sId,
    serviceTitle: sTitle,
    tasks,
    generatedAt: new Date().toISOString(),
    isAdvisoryOrder: true,
    disclaimer: 'Generated strictly from verified service requirements. Step sequencing is advisory; local submission centers may specify alternate processing orders.',
  };

  return plan;
};

/**
 * Calculate completion metrics for a preparation plan
 */
export const calculatePlanProgress = (plan) => {
  if (!plan || !Array.isArray(plan.tasks) || plan.tasks.length === 0) {
    return { total: 0, completed: 0, percentage: 0, mandatoryTotal: 0, mandatoryCompleted: 0 };
  }

  const total = plan.tasks.length;
  const completed = plan.tasks.filter((t) => t.completed).length;
  const mandatoryTotal = plan.tasks.filter((t) => t.isMandatory).length;
  const mandatoryCompleted = plan.tasks.filter((t) => t.isMandatory && t.completed).length;

  return {
    total,
    completed,
    percentage: Math.round((completed / total) * 100),
    mandatoryTotal,
    mandatoryCompleted,
  };
};

/**
 * Toggle a task completion status
 */
export const toggleTaskCompletion = (plan, taskId) => {
  if (!plan || !Array.isArray(plan.tasks)) return plan;
  const updatedTasks = plan.tasks.map((task) =>
    task.id === taskId ? { ...task, completed: !task.completed } : task
  );
  const updatedPlan = { ...plan, tasks: updatedTasks, updatedAt: new Date().toISOString() };
  saveStoredPlan(plan.serviceId, updatedPlan);
  return updatedPlan;
};

/**
 * Add a custom user task to the preparation plan
 */
export const addCustomTask = (plan, { title, notes = '' }) => {
  if (!plan || !title.trim()) return plan;
  const newTask = {
    id: `${plan.serviceId}-custom-${Date.now()}`,
    stepNumber: (plan.tasks.length || 0) + 1,
    title: title.trim(),
    category: TASK_CATEGORIES.CUSTOM,
    categoryLabel: 'Personal Task',
    sourceField: 'user_defined',
    sourceRequirement: 'Added by user',
    sourceServiceId: plan.serviceId,
    sourceServiceName: plan.serviceTitle,
    isMandatory: false,
    isSuggestedOrder: true,
    completed: false,
    notes: notes.trim(),
  };

  const updatedPlan = {
    ...plan,
    tasks: [...plan.tasks, newTask],
    updatedAt: new Date().toISOString(),
  };
  saveStoredPlan(plan.serviceId, updatedPlan);
  return updatedPlan;
};

/**
 * Remove a task from the plan
 */
export const removeTaskFromPlan = (plan, taskId) => {
  if (!plan || !Array.isArray(plan.tasks)) return plan;
  const filteredTasks = plan.tasks.filter((t) => t.id !== taskId);
  const updatedPlan = { ...plan, tasks: filteredTasks, updatedAt: new Date().toISOString() };
  saveStoredPlan(plan.serviceId, updatedPlan);
  return updatedPlan;
};

/**
 * Edit an existing task's title or notes
 */
export const editTaskInPlan = (plan, taskId, updates = {}) => {
  if (!plan || !Array.isArray(plan.tasks)) return plan;
  const updatedTasks = plan.tasks.map((task) => {
    if (task.id === taskId) {
      return {
        ...task,
        title: updates.title !== undefined ? updates.title.trim() : task.title,
        notes: updates.notes !== undefined ? updates.notes.trim() : task.notes,
      };
    }
    return task;
  });

  const updatedPlan = { ...plan, tasks: updatedTasks, updatedAt: new Date().toISOString() };
  saveStoredPlan(plan.serviceId, updatedPlan);
  return updatedPlan;
};
