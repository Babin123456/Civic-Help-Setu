import crypto from 'node:crypto';

export const FOOTPATH_DEFECT_TYPE = Object.freeze({
  MISSING_FOOTPATH: 'MISSING_FOOTPATH',
  LEVEL_CHANGE_ABRUPT: 'LEVEL_CHANGE_ABRUPT',
  UNSAFE_CROSSING: 'UNSAFE_CROSSING',
  BLOCKED_RAMP: 'BLOCKED_RAMP',
  INACCESSIBLE_SURFACE: 'INACCESSIBLE_SURFACE'
});

export const MOBILITY_PROFILE = Object.freeze({
  WHEELCHAIR: 'WHEELCHAIR',
  STROLLER: 'STROLLER',
  GENERAL_PEDESTRIAN: 'GENERAL_PEDESTRIAN'
});

export class FootpathContinuityAuditService {
  constructor() {
    this.audits = new Map();
  }

  createRouteAudit(routeData = {}) {
    const {
      routeName,
      originName,
      destinationName,
      totalDistanceMeters = 500,
      segments = [],
      issues = []
    } = routeData;

    if (!routeName || !originName || !destinationName) {
      throw new Error('Route name, origin, and destination are required.');
    }

    const auditId = `AUD-FP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Score continuity
    const scores = this.calculateContinuityScore(totalDistanceMeters, issues);

    const audit = {
      auditId,
      routeName,
      originName,
      destinationName,
      totalDistanceMeters,
      segmentsCount: segments.length || 1,
      issues,
      scores,
      createdAt: new Date().toISOString()
    };

    this.audits.set(auditId, audit);
    return audit;
  }

  calculateContinuityScore(totalDistanceMeters, issues = []) {
    let baseScore = 100;
    let wheelchairPenalty = 0;
    let strollerPenalty = 0;

    for (const issue of issues) {
      switch (issue.type) {
        case FOOTPATH_DEFECT_TYPE.MISSING_FOOTPATH:
          baseScore -= 20;
          wheelchairPenalty += 30;
          strollerPenalty += 20;
          break;
        case FOOTPATH_DEFECT_TYPE.BLOCKED_RAMP:
        case FOOTPATH_DEFECT_TYPE.LEVEL_CHANGE_ABRUPT:
          baseScore -= 10;
          wheelchairPenalty += 25;
          strollerPenalty += 15;
          break;
        case FOOTPATH_DEFECT_TYPE.UNSAFE_CROSSING:
          baseScore -= 15;
          wheelchairPenalty += 15;
          strollerPenalty += 15;
          break;
        default:
          baseScore -= 5;
          wheelchairPenalty += 5;
      }
    }

    return {
      generalWalkingScore: Math.max(0, Math.min(100, baseScore)),
      wheelchairScore: Math.max(0, Math.min(100, baseScore - wheelchairPenalty)),
      strollerScore: Math.max(0, Math.min(100, baseScore - strollerPenalty)),
      disclaimer: 'Scores are community indicators and do not constitute statutory accessibility certification.'
    };
  }

  generateAuditDossier(auditId) {
    const audit = this.audits.get(auditId);
    if (!audit) throw new Error(`Audit ${auditId} not found.`);

    return {
      auditId: audit.auditId,
      title: `Pedestrian Usability Dossier: ${audit.routeName}`,
      routeSummary: `${audit.originName} -> ${audit.destinationName} (${audit.totalDistanceMeters}m)`,
      issueCount: audit.issues.length,
      scores: audit.scores,
      defectsList: audit.issues.map((i) => ({
        defect: i.type,
        locationMark: i.locationMark || 'Intermediate segment',
        description: i.description || 'Observed barrier'
      }))
    };
  }
}
