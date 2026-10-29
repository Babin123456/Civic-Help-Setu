/**
 * Service to calculate expected milestone completion dates and detect stage bottlenecks
 * for tracked citizen applications.
 */

export const STANDARD_STAGE_DURATIONS = {
  submission: 1,
  scrutiny: 3,
  verification: 7,
  approval: 4,
  issuance: 2,
};

/**
 * Maps a stage name to estimated standard business days required.
 */
export const getEstimatedStageDays = (stageName = '') => {
  const norm = String(stageName).toLowerCase();
  if (norm.includes('submit') || norm.includes('acknowledgement') || norm.includes('received')) return 1;
  if (norm.includes('scrutiny') || norm.includes('review') || norm.includes('preliminary')) return 3;
  if (norm.includes('verification') || norm.includes('inspection') || norm.includes('police') || norm.includes('field')) return 7;
  if (norm.includes('approval') || norm.includes('sanction') || norm.includes('officer')) return 4;
  if (norm.includes('generate') || norm.includes('dispatch') || norm.includes('print') || norm.includes('download')) return 2;
  return 3; // default average
};

/**
 * Calculates stage-by-stage milestone estimates and flags stalled bottleneck stages.
 */
export const estimateStageMilestones = (application, now = new Date()) => {
  if (!application) return { stages: [], overallStatus: 'UNKNOWN', hasBottleneck: false };

  const stagesList = Array.isArray(application.stages) && application.stages.length > 0
    ? application.stages
    : [
        { name: 'Application Submitted' },
        { name: 'Document Scrutiny' },
        { name: 'Field / Police Verification' },
        { name: 'Officer Approval & Sanction' },
        { name: 'Certificate Generation & Dispatch' },
      ];

  const currentIndex = typeof application.currentStageIndex === 'number'
    ? application.currentStageIndex
    : 0;

  const dateValue = application.submissionDate || application.appliedDate || application.createdAt || application.updatedAt;
  const baseTime = dateValue ? new Date(dateValue).getTime() : now.getTime();
  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();

  let runningDayOffset = 0;
  let hasBottleneck = false;
  let bottleneckStage = null;

  const evaluatedStages = stagesList.map((stageObj, idx) => {
    const stageName = typeof stageObj === 'string' ? stageObj : stageObj.name || `Stage ${idx + 1}`;
    const durationDays = stageObj.expectedDays || getEstimatedStageDays(stageName);

    runningDayOffset += durationDays;
    const targetTime = baseTime + runningDayOffset * 24 * 60 * 60 * 1000;
    const targetDate = new Date(targetTime);

    let stageStatus = 'UPCOMING';
    if (idx < currentIndex) {
      stageStatus = 'COMPLETED';
    } else if (idx === currentIndex) {
      stageStatus = 'IN_PROGRESS';
    }

    const isCurrent = idx === currentIndex;
    const isDelayed = isCurrent && currentTime > targetTime;
    const delayedDays = isDelayed ? Math.floor((currentTime - targetTime) / (1000 * 60 * 60 * 24)) : 0;

    if (isDelayed && !hasBottleneck) {
      hasBottleneck = true;
      bottleneckStage = {
        stageName,
        stageIndex: idx,
        delayedDays,
        targetDate,
      };
    }

    return {
      index: idx,
      name: stageName,
      expectedDays: durationDays,
      targetDate,
      status: stageStatus,
      isDelayed,
      delayedDays,
    };
  });

  return {
    stages: evaluatedStages,
    currentIndex,
    hasBottleneck,
    bottleneckStage,
    overallVelocity: hasBottleneck ? 'BOTTLENECK_DETECTED' : 'ON_SCHEDULE',
  };
};
