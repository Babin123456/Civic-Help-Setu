import { describe, it, expect } from 'vitest';
import {
  tokenizeReportText,
  computeJaccardSimilarity,
  getGeospatialGridBucket,
  evaluatePairwiseReportSimilarity,
  detectReportBursts,
  confirmModeratorMerge,
  reverseModeratorMerge,
  MODERATION_MERGE_STATE,
} from './duplicateReportDetectionService.js';

describe('Duplicate and Coordinated Civic Report Detection Service', () => {
  it('converts exact GPS coordinates into privacy-preserving geospatial buckets', () => {
    const bucketA = getGeospatialGridBucket(12.971598, 77.594562);
    const bucketB = getGeospatialGridBucket(12.971800, 77.594700); // 30m away
    const bucketFar = getGeospatialGridBucket(13.082680, 80.270718); // Chennai

    expect(bucketA).toBe(bucketB); // Grouped into identical ~1km grid
    expect(bucketA).not.toBe(bucketFar);
  });

  it('computes Jaccard text similarity between report narratives', () => {
    const setA = tokenizeReportText('Massive pothole near water tank main road');
    const setB = tokenizeReportText('Deep pothole on main road opposite water tank');
    const sim = computeJaccardSimilarity(setA, setB);
    expect(sim).toBeGreaterThan(0.5);
  });

  it('identifies duplicate reports within proximate geo-bucket and time window', () => {
    const report1 = {
      id: 'rep-001',
      category: 'ROAD_POTHOLE',
      latitude: 19.076,
      longitude: 72.8777,
      description: 'Dangerous open trench on 5th cross road',
      createdAt: '2025-05-10T10:00:00Z',
    };

    const report2 = {
      id: 'rep-002',
      category: 'ROAD_POTHOLE',
      latitude: 19.0762,
      longitude: 72.8779,
      description: 'Open trench on 5th cross causing accidents',
      createdAt: '2025-05-10T14:30:00Z',
    };

    const similarity = evaluatePairwiseReportSimilarity(report1, report2);
    expect(similarity).toBeDefined();
    expect(similarity.confidence).toBeGreaterThan(0.6);
    expect(similarity.moderationState).toBe(MODERATION_MERGE_STATE.SUGGESTED_DUPLICATE);
    expect(similarity.reasons.length).toBeGreaterThanOrEqual(2);
    expect(similarity.originalReportsPreserved).toBe(true);
  });

  it('detects high-activity report bursts without punitive actions', () => {
    const burstReports = [
      { id: 'r1', category: 'WATER_LEAK', latitude: 28.6139, longitude: 77.209 },
      { id: 'r2', category: 'WATER_LEAK', latitude: 28.6141, longitude: 77.2092 },
      { id: 'r3', category: 'WATER_LEAK', latitude: 28.6138, longitude: 77.2089 },
      { id: 'r4', category: 'WATER_LEAK', latitude: 28.6142, longitude: 77.2091 },
    ];

    const bursts = detectReportBursts(burstReports, { burstThreshold: 4 });
    expect(bursts.length).toBe(1);
    expect(bursts[0].reportCount).toBe(4);
    expect(bursts[0].punitiveActionTaken).toBe(false);
    expect(bursts[0].observationNotice).toContain('Elevated report activity');
  });

  it('supports transparent moderator merge and full reversal', () => {
    const cluster = confirmModeratorMerge('cluster-pothole-101', ['rep-001', 'rep-002'], 'mod_agent_44');
    expect(cluster.status).toBe(MODERATION_MERGE_STATE.CONFIRMED_MERGED);
    expect(cluster.isReversible).toBe(true);

    const reversed = reverseModeratorMerge(cluster, 'mod_supervisor_02', 'Verified as two separate potholes 50m apart');
    expect(reversed.status).toBe(MODERATION_MERGE_STATE.UNMERGED_REVERSED);
    expect(reversed.reversalReason).toContain('separate potholes');
    expect(reversed.reversedBy).toBe('mod_supervisor_02');
  });
});
