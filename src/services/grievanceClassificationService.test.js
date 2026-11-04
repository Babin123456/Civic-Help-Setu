import { describe, it, expect } from 'vitest';
import {
  classifyGrievance,
  GRIEVANCE_CATEGORIES,
  SAMPLE_GRIEVANCES,
} from './grievanceClassificationService.js';

describe('grievanceClassificationService', () => {
  it('correctly classifies road potholes and routes to PWD / Municipal Roads', () => {
    const text = 'Deep pothole on the street outside school causing accidents and vehicle damage.';
    const result = classifyGrievance(text);

    expect(result.isValid).toBe(true);
    expect(result.category).toBe(GRIEVANCE_CATEGORIES.ROADS_AND_INFRASTRUCTURE);
    expect(result.department).toContain('Public Works Department (PWD)');
    expect(result.whyThisDepartment).toContain('maintaining road surfaces');
    expect(result.slaDays).toBe(7);
    expect(result.evidenceToGather.some((e) => e.includes('photograph'))).toBe(true);
    expect(result.escalationLadder).toContain('Junior Engineer (Roads)');
  });

  it('correctly classifies garbage dumping and routes to Municipal Sanitation', () => {
    const text = 'Piles of overflowing garbage and waste lying uncollected in our ward for 3 days.';
    const result = classifyGrievance(text);

    expect(result.isValid).toBe(true);
    expect(result.category).toBe(GRIEVANCE_CATEGORIES.MUNICIPAL_SANITATION);
    expect(result.department).toContain('Solid Waste');
    expect(result.slaDays).toBe(2);
    expect(result.officialPortals.some((p) => p.name.includes('Swachhata'))).toBe(true);
  });

  it('correctly classifies contaminated water supply and routes to Jal Board', () => {
    const text = 'Dirty water coming from kitchen tap. Water supply is completely muddy and smelly.';
    const result = classifyGrievance(text);

    expect(result.isValid).toBe(true);
    expect(result.category).toBe(GRIEVANCE_CATEGORIES.WATER_AND_SEWERAGE);
    expect(result.department).toContain('Water Supply');
    expect(result.evidenceToGather.some((e) => e.includes('Consumer Connection'))).toBe(true);
  });

  it('correctly classifies electrical hazards and routes to DISCOM', () => {
    const text = 'Transformer sparking near the main road with dangling wire risking lives.';
    const result = classifyGrievance(text);

    expect(result.isValid).toBe(true);
    expect(result.category).toBe(GRIEVANCE_CATEGORIES.ELECTRICITY_AND_POWER);
    expect(result.department).toContain('DISCOM');
    expect(result.slaDays).toBe(1);
    expect(result.urgency).toContain('Emergency');
    expect(result.escalationLadder.some((l) => l.includes('1912'))).toBe(true);
  });

  it('correctly classifies public bus service and traffic overcharging', () => {
    const text = 'City bus route skipped scheduled morning stops, auto drivers overcharging passengers.';
    const result = classifyGrievance(text);

    expect(result.isValid).toBe(true);
    expect(result.category).toBe(GRIEVANCE_CATEGORIES.PUBLIC_TRANSPORT);
    expect(result.department).toContain('State Road Transport Corporation');
  });

  it('detects multi-department overlapping issues and provides dual routing notice', () => {
    // Both road pothole and water pipeline leakage mentioned
    const text = 'Pothole on the road caused by broken water supply pipeline burst.';
    const result = classifyGrievance(text);

    expect(result.isValid).toBe(true);
    expect(result.isMultiDepartment).toBe(true);
    expect(result.secondaryDepartment).toBeDefined();
    expect(result.secondaryNotice).toContain('copy this grievance to both authorities');
  });

  it('handles ambiguous or generic complaints with CPGRAMS central fallback', () => {
    const text = 'Staff was behaving rudely and refused to process file #9812 without reason.';
    const result = classifyGrievance(text);

    expect(result.isValid).toBe(true);
    expect(result.category).toBe(GRIEVANCE_CATEGORIES.AMBIGUOUS_MULTI_DEPARTMENT);
    expect(result.isAmbiguous).toBe(true);
    expect(result.department).toContain('CPGRAMS');
    expect(result.evidenceToGather.length).toBeGreaterThan(0);
  });

  it('handles empty input gracefully', () => {
    const result = classifyGrievance('');
    expect(result.isValid).toBe(false);
    expect(result.recommendation).toBeNull();
  });

  it('evaluates all sample grievances successfully', () => {
    SAMPLE_GRIEVANCES.forEach((sample) => {
      const res = classifyGrievance(sample.text);
      expect(res.isValid).toBe(true);
      expect(res.department).toBeDefined();
      expect(res.slaDays).toBeGreaterThan(0);
      expect(res.evidenceToGather.length).toBeGreaterThan(0);
      expect(res.escalationLadder.length).toBeGreaterThan(0);
    });
  });
});
