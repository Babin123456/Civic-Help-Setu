import crypto from 'node:crypto';

export const ANOMALY_SEVERITY = Object.freeze({
  HIGH: 'HIGH', // Impossible coordinates, negative fees
  MEDIUM: 'MEDIUM', // Mismatched pin codes, suspicious office hours
  LOW: 'LOW' // Formatting typos
});

export const REVIEW_STATUS = Object.freeze({
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  FALSE_POSITIVE: 'FALSE_POSITIVE'
});

export class CivicDataQualityAnomalyReviewQueueService {
  constructor() {
    this.reviewQueue = new Map();
  }

  scoreAndQueueRecord(record = {}) {
    const { id, title, state, pinCode, coordinates = {}, officeHours, fees } = record;
    const recordId = id || `REC-${crypto.randomBytes(4).toString('hex')}`;
    const anomalies = [];

    // Rule 1: Geolocation boundary check (India Lat/Long range)
    if (coordinates.lat !== undefined && coordinates.lng !== undefined) {
      if (coordinates.lat < 6.0 || coordinates.lat > 37.5 || coordinates.lng < 68.0 || coordinates.lng > 97.5) {
        anomalies.push({
          field: 'coordinates',
          severity: ANOMALY_SEVERITY.HIGH,
          explanation: `Coordinates (${coordinates.lat}, ${coordinates.lng}) fall outside Indian geographic boundaries.`
        });
      }
    }

    // Rule 2: Negative fee schedule check
    if (fees !== undefined && Number(fees) < 0) {
      anomalies.push({
        field: 'fees',
        severity: ANOMALY_SEVERITY.HIGH,
        explanation: `Statutory fee cannot be negative (${fees}).`
      });
    }

    // Rule 3: 6-digit postal code check
    if (pinCode && !/^[1-9][0-9]{5}$/.test(String(pinCode))) {
      anomalies.push({
        field: 'pinCode',
        severity: ANOMALY_SEVERITY.MEDIUM,
        explanation: `Malformed Indian PIN code: '${pinCode}' (expected 6 numeric digits).`
      });
    }

    if (anomalies.length === 0) {
      return { isQueued: false, reason: 'Record passed all data quality gates cleanly.' };
    }

    const queueId = `REV-ANOM-${crypto.randomBytes(6).toString('hex')}`;
    const queueItem = {
      queueId,
      recordId,
      recordTitle: title || 'Untitled Service Record',
      state: state || 'ALL_INDIA',
      anomalies,
      highestSeverity: anomalies.some(a => a.severity === ANOMALY_SEVERITY.HIGH) ? ANOMALY_SEVERITY.HIGH : ANOMALY_SEVERITY.MEDIUM,
      reviewStatus: REVIEW_STATUS.PENDING_REVIEW,
      reviewerNotes: null,
      submittedAt: new Date().toISOString()
    };

    this.reviewQueue.set(queueId, queueItem);
    return { isQueued: true, queueId, item: queueItem };
  }

  reviewQueueItem(queueId, resolution = {}) {
    const item = this.reviewQueue.get(queueId);
    if (!item) throw new Error(`Queue item ${queueId} not found.`);

    const { status, reviewerName, notes } = resolution;
    if (!status || !REVIEW_STATUS[status]) {
      throw new Error(`Invalid resolution status: ${status}`);
    }

    item.reviewStatus = status;
    item.reviewerName = reviewerName || 'Admin Moderator';
    item.reviewerNotes = notes || '';
    item.resolvedAt = new Date().toISOString();

    return item;
  }

  getPendingAnomalies() {
    return Array.from(this.reviewQueue.values()).filter(
      (i) => i.reviewStatus === REVIEW_STATUS.PENDING_REVIEW
    );
  }
}
