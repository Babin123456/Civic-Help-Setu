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
    expect(result.confidence).toBeGreaterThanOrEqual(50);
    expect(result.source).toBeDefined();
  });

  it('correctly classifies garbage dumping and routes to Municipal Sanitation', () => {
    const text = 'Piles of overflowing garbage and waste lying uncollected in our ward for 3 days.';
    const result = classifyGrievance(text);

    expect(result.isValid).toBe(true);
    expect(result.category).toBe(GRIEVANCE_CATEGORIES.MUNICIPAL_SANITATION);
    expect(result.department).toContain('Solid Waste');
    expect(result.slaDays).toBe(2);
    expect(result.officialPortals.some((p) => p.name.includes('Swachhata'))).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(50);
  });

  it('correctly classifies contaminated water supply and routes to Jal Board', () => {
    const text = 'Dirty water coming from kitchen tap. Water supply is completely muddy and smelly.';
    const result = classifyGrievance(text);

    expect(result.isValid).toBe(true);
    expect(result.category).toBe(GRIEVANCE_CATEGORIES.WATER_AND_SEWERAGE);
    expect(result.department).toContain('Water Supply');
    expect(result.evidenceToGather.some((e) => e.includes('Consumer Connection'))).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(50);
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
    expect(result.confidence).toBeGreaterThanOrEqual(50);
  });

  it('correctly classifies public bus service and traffic overcharging', () => {
    const text = 'City bus route skipped scheduled morning stops, auto drivers overcharging passengers.';
    const result = classifyGrievance(text);

    expect(result.isValid).toBe(true);
    expect(result.category).toBe(GRIEVANCE_CATEGORIES.PUBLIC_TRANSPORT);
    expect(result.department).toContain('State Road Transport Corporation');
    expect(result.confidence).toBeGreaterThanOrEqual(50);
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
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.source).toBeDefined();
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
      expect(res.confidence).toBeGreaterThan(0);
      expect(res.source).toBeDefined();
    });
  });

  it('detects unsupported claims in grievance text', () => {
    // Text with legal/court terminology that has no matching department rules
    const text = 'The officer refused my application and I want to file a supreme court petition.';
    const result = classifyGrievance(text);

    expect(result.isValid).toBe(true);
    // Should detect unsupported claims (attached as unsupportedClaims array)
    expect(result.unsupportedClaims).toBeDefined();
    expect(result.unsupportedClaims.length).toBeGreaterThan(0);
    expect(result.unsupportedClaims.some((c) => c.includes('supreme court'))).toBe(true);
  });

  it('detects billing dispute claims without department match', () => {
    // Billing dispute text that doesn't match any department routing rules
    const text = 'My application for a subsidy was denied and I have billing charges I cannot pay.';
    const result = classifyGrievance(text);

    expect(result.isValid).toBe(true);
    // Should detect billing dispute claim (in unsupportedClaims array since no department routing)
    expect(result.unsupportedClaims).toBeDefined();
    expect(result.unsupportedClaims.length).toBeGreaterThan(0);
    expect(result.unsupportedClaims.some((c) => c.includes('billing') || c.includes('charge'))).toBe(true);
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

  it('evaluates all sample grievances with confidence and source', () => {
    SAMPLE_GRIEVANCES.forEach((sample) => {
      const res = classifyGrievance(sample.text);
      expect(res.isValid).toBe(true);
      expect(res.department).toBeDefined();
      expect(res.slaDays).toBeGreaterThan(0);
      expect(res.evidenceToGather.length).toBeGreaterThan(0);
      expect(res.escalationLadder.length).toBeGreaterThan(0);
      expect(res.confidence).toBeGreaterThan(0);
      expect(res.source).toBeDefined();
    });
  });
});