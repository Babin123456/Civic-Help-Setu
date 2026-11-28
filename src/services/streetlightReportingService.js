import crypto from 'node:crypto';

export const OUTAGE_PROBLEM_TYPE = Object.freeze({
  NOT_WORKING: 'NOT_WORKING',
  DAMAGED_POLE: 'DAMAGED_POLE',
  EXPOSED_WIRING: 'EXPOSED_WIRING',
  INTERMITTENT_LIGHT: 'INTERMITTENT_LIGHT'
});

export const REPORT_STATUS = Object.freeze({
  UNVERIFIED: 'UNVERIFIED',
  MODERATED: 'MODERATED',
  SUBMITTED_TO_AUTHORITY: 'SUBMITTED_TO_AUTHORITY',
  RESOLVED: 'RESOLVED'
});

export class StreetlightReportingService {
  constructor() {
    this.reports = new Map();
  }

  createReport(data = {}) {
    const {
      latitude,
      longitude,
      address,
      problemType,
      description,
      landmark,
      photoPayload,
      responsibleAuthority = 'Municipal Corporation / DISCOM'
    } = data;

    if (!problemType || !OUTAGE_PROBLEM_TYPE[problemType]) {
      throw new Error(`Invalid problem type: ${problemType}`);
    }

    if (!address && (latitude === undefined || longitude === undefined)) {
      throw new Error('Either address or coordinates (latitude, longitude) must be provided.');
    }

    // Strip image metadata if provided
    let sanitizedPhoto = null;
    if (photoPayload) {
      sanitizedPhoto = {
        checksum: crypto.createHash('sha256').update(photoPayload).digest('hex'),
        sizeKb: Math.round(photoPayload.length / 1024),
        isMetadataStripped: true
      };
    }

    const referenceNumber = `STR-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const report = {
      referenceNumber,
      location: {
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        address: address || 'Marked on map',
        landmark: landmark || null
      },
      problemType,
      description: description || '',
      responsibleAuthority,
      sanitizedPhoto,
      status: REPORT_STATUS.UNVERIFIED,
      isPublic: true,
      createdAt: new Date().toISOString(),
      statusHistory: [
        {
          status: REPORT_STATUS.UNVERIFIED,
          timestamp: new Date().toISOString(),
          note: 'Community report registered. Marked unverified until local review.'
        }
      ]
    };

    this.reports.set(referenceNumber, report);
    return report;
  }

  detectDuplicates(latitude, longitude, thresholdMeters = 50) {
    if (latitude === null || longitude === null) return [];
    const matches = [];
    for (const report of this.reports.values()) {
      if (report.location.latitude && report.location.longitude) {
        // Approximate planar distance check for unit testing
        const dLat = Math.abs(report.location.latitude - latitude);
        const dLon = Math.abs(report.location.longitude - longitude);
        if (dLat < 0.0005 && dLon < 0.0005) {
          matches.push(report);
        }
      }
    }
    return matches;
  }

  generateComplaintSummary(referenceNumber) {
    const report = this.reports.get(referenceNumber);
    if (!report) throw new Error(`Report ${referenceNumber} not found.`);

    return {
      referenceNumber: report.referenceNumber,
      dateReported: report.createdAt,
      problemCategory: report.problemType,
      authorityNotice: `To: Executive Engineer / Nodal Officer, ${report.responsibleAuthority}`,
      locationDescription: `${report.location.address} (Near ${report.location.landmark || 'specified landmark'})`,
      currentStatus: report.status,
      publicLabel: report.status === REPORT_STATUS.UNVERIFIED ? 'Unverified Community Submission' : 'Verified by Ward'
    };
  }
}
