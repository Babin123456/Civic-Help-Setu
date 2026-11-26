import { describe, it, expect, beforeEach } from 'vitest';
import {
  JourneyBottleneckFunnelService,
  calculateFunnelTransitions,
  JOURNEY_STAGES,
  MIN_ANONYMOUS_COHORT_THRESHOLD
} from './journeyBottleneckFunnelService.js';

describe('journeyBottleneckFunnelService', () => {
  describe('calculateFunnelTransitions', () => {
    it('computes transition rates and suppresses cohorts below threshold', () => {
      const rawStages = [
        { stage: 'STAGE_DISCOVERY', count: 100 },
        { stage: 'STAGE_CHECKLIST', count: 60 },
        { stage: 'STAGE_DRAFTING', count: 5 } // Below 10 -> suppressed
      ];

      const res = calculateFunnelTransitions(rawStages);
      expect(res.length).toBe(3);

      // Discovery
      expect(res[0].rawCount).toBe(100);
      expect(res[0].suppressed).toBe(false);

      // Checklist (60 / 100 = 0.6)
      expect(res[1].transitionRate).toBe(0.6);
      expect(res[1].dropOffRate).toBe(0.4);

      // Drafting (suppressed)
      expect(res[2].suppressed).toBe(true);
      expect(res[2].displayCount).toBe('< 10');
    });

    it('handles empty input gracefully', () => {
      expect(calculateFunnelTransitions([])).toEqual([]);
      expect(calculateFunnelTransitions(null)).toEqual([]);
    });
  });

  describe('JourneyBottleneckFunnelService', () => {
    let service;

    beforeEach(() => {
      service = new JourneyBottleneckFunnelService();
    });

    it('throws error for invalid journey stages', () => {
      expect(() => {
        service.logStageEvent({ stage: 'INVALID_STAGE', serviceId: 'ration' });
      }).toThrow(/Invalid journey stage/);
    });

    it('aggregates journey events into structured funnel report with filters', () => {
      // Simulate 20 discovery, 15 checklist, 12 drafting for Karnataka
      for (let i = 0; i < 20; i++) {
        service.logStageEvent({ stage: 'STAGE_DISCOVERY', serviceId: 'ration-card', jurisdiction: 'Karnataka' });
      }
      for (let i = 0; i < 15; i++) {
        service.logStageEvent({ stage: 'STAGE_CHECKLIST', serviceId: 'ration-card', jurisdiction: 'Karnataka' });
      }
      for (let i = 0; i < 12; i++) {
        service.logStageEvent({ stage: 'STAGE_DRAFTING', serviceId: 'ration-card', jurisdiction: 'Karnataka' });
      }

      const report = service.getFunnelReport({ serviceId: 'ration-card', jurisdiction: 'Karnataka' });

      expect(report.serviceId).toBe('ration-card');
      expect(report.jurisdiction).toBe('Karnataka');
      expect(report.totalRecordedEvents).toBe(47);

      const discovery = report.stages.find(s => s.stage === 'STAGE_DISCOVERY');
      const checklist = report.stages.find(s => s.stage === 'STAGE_CHECKLIST');

      expect(discovery.rawCount).toBe(20);
      expect(checklist.rawCount).toBe(15);
      expect(checklist.transitionRate).toBe(0.75); // 15 / 20
    });
  });
});
