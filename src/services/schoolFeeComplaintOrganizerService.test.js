import { describe, it, expect, beforeEach } from 'vitest';
import { SchoolFeeComplaintOrganizerService } from './schoolFeeComplaintOrganizerService.js';

describe('SchoolFeeComplaintOrganizerService', () => {
  let service;

  beforeEach(() => {
    service = new SchoolFeeComplaintOrganizerService();
  });

  it('detects arithmetic differences and unlisted charges between notice and receipt', () => {
    const notice = [
      { headName: 'Tuition Fee', amountINR: 15000 },
      { headName: 'Computer & Science Laboratory Fee', amountINR: 2000 }
    ];

    const receipt = [
      { headName: 'Tuition Fee', amountINR: 18000 }, // +3000 hike
      { headName: 'Computer & Science Laboratory Fee', amountINR: 2000 },
      { headName: 'Smart Board Digital Content Fee', amountINR: 3500 } // Unexplained head
    ];

    const result = service.reconcileFeeReceipts(notice, receipt);

    expect(result.hasDiscrepancies).toBe(true);
    expect(result.totalSanctionedINR).toBe(17000);
    expect(result.totalChargedINR).toBe(23500);
    expect(result.netVarianceINR).toBe(6500);

    expect(result.discrepancies.length).toBe(1);
    expect(result.discrepancies[0].headName).toBe('Tuition Fee');
    expect(result.discrepancies[0].differenceINR).toBe(3000);

    expect(result.unexplainedCharges.length).toBe(1);
    expect(result.unexplainedCharges[0].headName).toBe('Smart Board Digital Content Fee');
  });

  it('drafts a neutral, polite parent clarification letter', () => {
    const notice = [{ headName: 'Tuition Fee', amountINR: 10000 }];
    const receipt = [
      { headName: 'Tuition Fee', amountINR: 12000 },
      { headName: 'Building Maintenance Levy', amountINR: 1500 }
    ];

    const result = service.reconcileFeeReceipts(notice, receipt);
    const letter = service.draftParentClarificationLetter(
      { parentName: 'Anita Desai', studentName: 'Rohan Desai', gradeSection: 'Class 8-A' },
      result,
      { schoolName: 'Delhi Public Academy' }
    );

    expect(letter).toContain('Anita Desai');
    expect(letter).toContain('Rohan Desai');
    expect(letter).toContain('Tuition Fee');
    expect(letter).toContain('Building Maintenance Levy');
    expect(letter).toContain('kindly request you to provide a detailed line-item breakdown');
  });

  it('retrieves state fee regulatory committee details (UP, MH, DL)', () => {
    const upRegulator = service.getStateRegulator('IN-UP');
    expect(upRegulator).toBeDefined();
    expect(upRegulator.committeeName).toContain('District Fee Regulatory Committee');
    expect(upRegulator.keyRules[0]).toContain('Consumer Price Index (CPI) + 5%');
  });
});
