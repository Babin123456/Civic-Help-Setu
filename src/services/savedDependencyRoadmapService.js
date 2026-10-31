/**
 * Saved Civic Services Sequential Prerequisite & Execution Roadmap Engine.
 *
 * Inspects a citizen's saved/bookmarked services, constructs a dependency graph,
 * groups them into sequential stages, identifies blockers, and estimates cumulative
 * end-to-end processing timelines.
 */

// Known statutory prerequisite relationships in Indian public administration
export const KNOWN_CIVIC_PREREQUISITES = {
  'ews-certificate': ['income-certificate', 'caste-certificate'],
  'driving-license': ['learners-license'],
  'obc-ncl-certificate': ['caste-certificate', 'income-certificate'],
  'domicile-certificate': ['ration-card', 'voter-id'],
  'passport': ['birth-certificate', 'aadhaar-card'],
  'scholarship-scheme': ['income-certificate', 'caste-certificate', 'bank-account'],
  'marriage-registration': ['birth-certificate', 'aadhaar-card'],
  'trade-license': ['property-tax-receipt', 'occupancy-certificate'],
};

/**
 * Extracts numeric processing days from strings like "15 working days", "21 Days", "3-5 days".
 */
export function parseProcessingDays(timeStr = '') {
  if (!timeStr || typeof timeStr !== 'string') return 14;
  const match = timeStr.match(/(\d+)/);
  if (!match) return 14;
  const num = parseInt(match[1], 10);
  return Number.isNaN(num) || num <= 0 ? 14 : num;
}

/**
 * Evaluates dependency roadmap for a list of service objects.
 */
export function buildDependencyRoadmap(serviceList = []) {
  const services = (Array.isArray(serviceList) ? serviceList : []).filter(Boolean);
  if (services.length === 0) {
    return {
      stages: [],
      totalEstimatedDays: 0,
      hasBlockers: false,
    };
  }

  const serviceIdSet = new Set(services.map((s) => s.id));

  // Determine stage levels: 0 (No prerequisites), 1 (Depends on stage 0), 2 (Depends on stage 1)
  const assessed = services.map((svc) => {
    const prereqIds = KNOWN_CIVIC_PREREQUISITES[svc.id] || [];
    // Which of these prerequisites are also in the user's saved list?
    const internalPrereqs = prereqIds.filter((pId) => serviceIdSet.has(pId));
    // External prerequisites not in saved list
    const externalPrereqs = prereqIds.filter((pId) => !serviceIdSet.has(pId));

    const isBlocked = internalPrereqs.length > 0;
    const stageIndex = isBlocked ? 1 : 0;
    const estimatedDays = parseProcessingDays(svc.processingTime);

    return {
      id: svc.id,
      name: svc.name || svc.id,
      category: svc.category || 'General',
      processingTime: svc.processingTime || '15 days',
      estimatedDays,
      prerequisites: prereqIds,
      internalPrereqs,
      externalPrereqs,
      isBlocked,
      stageIndex,
    };
  });

  // Group into Stage 1 (Initial Applications) and Stage 2 (Dependent Applications)
  const stage0 = assessed.filter((s) => s.stageIndex === 0);
  const stage1 = assessed.filter((s) => s.stageIndex === 1);

  const stages = [];
  if (stage0.length > 0) {
    const stage0MaxDays = Math.max(...stage0.map((s) => s.estimatedDays), 0);
    stages.push({
      stageNumber: 1,
      title: 'Phase 1: Foundational Civic Prerequisites (Apply First)',
      description: 'These certificates have no internal dependencies and can be applied for immediately in parallel.',
      services: stage0,
      phaseDays: stage0MaxDays,
    });
  }

  if (stage1.length > 0) {
    const stage1MaxDays = Math.max(...stage1.map((s) => s.estimatedDays), 0);
    stages.push({
      stageNumber: 2,
      title: 'Phase 2: Dependent Applications (Apply After Phase 1 Approval)',
      description: 'These applications require approval of Phase 1 certificates as mandatory attachments.',
      services: stage1,
      phaseDays: stage1MaxDays,
    });
  }

  const totalEstimatedDays = stages.reduce((acc, st) => acc + st.phaseDays, 0);

  return {
    stages,
    totalEstimatedDays,
    hasBlockers: stage1.length > 0,
    totalServicesCount: services.length,
  };
}
