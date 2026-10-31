import { describe, it, expect } from 'vitest';
import {
  KNOWN_CIVIC_PREREQUISITES,
  parseProcessingDays,
  buildDependencyRoadmap,
} from './savedDependencyRoadmapService';

describe('savedDependencyRoadmapService', () => {
  it('exposes known civic prerequisite rules', () => {
    expect(KNOWN_CIVIC_PREREQUISITES['ews-certificate']).toContain('income-certificate');
    expect(KNOWN_CIVIC_PREREQUISITES['driving-license']).toContain('learners-license');
  });

  it('parses numeric processing days correctly', () => {
    expect(parseProcessingDays('15 working days')).toBe(15);
    expect(parseProcessingDays('21 Days')).toBe(21);
    expect(parseProcessingDays('7-10 days')).toBe(7);
    expect(parseProcessingDays('')).toBe(14);
  });

  it('builds multi-phase roadmap when dependent services are saved together', () => {
    const saved = [
      { id: 'income-certificate', name: 'Income Certificate', processingTime: '15 days' },
      { id: 'ews-certificate', name: 'EWS Certificate', processingTime: '21 days' },
    ];

    const roadmap = buildDependencyRoadmap(saved);
    expect(roadmap.stages.length).toBe(2);

    // Phase 1 has Income Certificate
    expect(roadmap.stages[0].services.some((s) => s.id === 'income-certificate')).toBe(true);
    // Phase 2 has EWS Certificate
    expect(roadmap.stages[1].services.some((s) => s.id === 'ews-certificate')).toBe(true);
    expect(roadmap.stages[1].services[0].isBlocked).toBe(true);
    expect(roadmap.totalEstimatedDays).toBe(15 + 21);
    expect(roadmap.hasBlockers).toBe(true);
  });

  it('handles empty or independent services gracefully', () => {
    const empty = buildDependencyRoadmap([]);
    expect(empty.stages.length).toBe(0);
    expect(empty.totalEstimatedDays).toBe(0);

    const independent = [
      { id: 'birth-certificate', name: 'Birth Certificate', processingTime: '7 days' },
      { id: 'death-certificate', name: 'Death Certificate', processingTime: '7 days' },
    ];
    const roadmap = buildDependencyRoadmap(independent);
    expect(roadmap.stages.length).toBe(1);
    expect(roadmap.hasBlockers).toBe(false);
  });
});
