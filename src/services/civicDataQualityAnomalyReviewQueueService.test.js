import { describe, it, expect, beforeEach } from 'vitest';
import {
  CivicDataQualityAnomalyReviewQueueService,
  ANOMALY_SEVERITY,
  REVIEW_STATUS
} from './civicDataQualityAnomalyReviewQueueService.js';

describe('CivicDataQualityAnomalyReviewQueueService (#1452)', () => {
  let service;

  beforeEach(() => {
    service = new CivicDataQualityAnomalyReviewQueueService();
  });

  it('queues corrupted records with field-level explanations and severity tiers', () => {
    const result = service.scoreAndQueueRecord({
      title: 'Kalyan Seva Kendra',
      pinCode: '0124', // Invalid 4-digit pin
      coordinates: { lat: 51.5074, lng: -0.1278 }, // London coordinates
      fees: -50
    });

    expect(result.isQueued).toBe(true);
    expect(result.item.anomalies.length).toBe(3);
    expect(result.item.highestSeverity).toBe(ANOMALY_SEVERITY.HIGH);
    expect(result.item.anomalies.some(a => a.field === 'coordinates')).toBe(true);
  });

  it('supports human review, false-positive feedback, and audit logging', () => {
    const queued = service.scoreAndQueueRecord({
      title: 'Special Hill Post Office',
      pinCode: 'PIN_INVALID_CHARS'
    });

    expect(queued.isQueued).toBe(true);

    const reviewed = service.reviewQueueItem(queued.queueId, {
      status: REVIEW_STATUS.FALSE_POSITIVE,
      reviewerName: 'Priya Sharma (Data Admin)',
      notes: 'Verified against postal circular 2026'
    });

    expect(reviewed.reviewStatus).toBe(REVIEW_STATUS.FALSE_POSITIVE);
    expect(reviewed.reviewerName).toBe('Priya Sharma (Data Admin)');
    expect(service.getPendingAnomalies().length).toBe(0);
  });
});
