import { describe, it, expect } from 'vitest';
import {
  auditRtiQuestions,
  buildRtiApplication,
  evaluateRtiFeeExemption,
} from './rtiDraftingEngine';

describe('rtiDraftingEngine - Question Audits & Petition Builder', () => {
  it('flags speculative "Why" questions under Section 2(f)', () => {
    const questions = [
      'Why was my mutation rejected?',
      'Certified copy of rejection order and inspection note.'
    ];

    const audit = auditRtiQuestions(questions);
    expect(audit.issues.length).toBe(1);
    expect(audit.issues[0].type).toBe('SPECULATIVE_QUERY');
    expect(audit.issues[0].warning).toContain('Section 2(f)');
  });

  it('flags Section 8 exemption risks', () => {
    const questions = ['Provide confidential cabinet decision notes and military files.'];
    const audit = auditRtiQuestions(questions);
    expect(audit.hasHighRisk).toBe(true);
    expect(audit.issues[0].type).toBe('SECTION_8_RISK');
  });

  it('builds full compliant Section 6(1) RTI application with BPL fee waiver', () => {
    const payload = {
      departmentId: 'municipal-corporation',
      applicantName: 'Kailash Meena',
      applicantAddress: 'Ward 12, Sanganer, Jaipur',
      questions: [
        'Certified copy of contractor tender sanction for road repair.',
        'Copy of quality testing report for bitumen mix used.'
      ],
      isBpl: true,
      bplCardNumber: 'BPL-RJ-2022-98712'
    };

    const res = buildRtiApplication(payload);
    expect(res.applicationText).toContain('Kailash Meena');
    expect(res.applicationText).toContain('Public Information Officer');
    expect(res.applicationText).toContain('BPL-RJ-2022-98712');
    expect(res.applicationText).toContain('fee is NOT payable');
    expect(res.exemptionDetails.isExempt).toBe(true);
    expect(res.exemptionDetails.feeAmount).toBe(0);
  });

  it('evaluates Section 7(5) BPL exemption details and mandatory fee waiver', () => {
    const bplExempt = evaluateRtiFeeExemption({ isBpl: true, bplCardNumber: 'BPL-9988' });
    expect(bplExempt.feeAmount).toBe(0);
    expect(bplExempt.isExempt).toBe(true);
    expect(bplExempt.exemptionReason).toContain('Section 7(5)');
    expect(bplExempt.requiredEnclosure).toContain('BPL-9988');

    const standard = evaluateRtiFeeExemption({ isBpl: false });
    expect(standard.feeAmount).toBe(10);
    expect(standard.isExempt).toBe(false);
  });

  it('applies 48-hour life and liberty urgent disposal proviso to Section 7(1)', () => {
    const payload = {
      departmentId: 'health-department',
      applicantName: 'Dr. Priya Varma',
      applicantAddress: 'Civil Lines, Delhi',
      questions: ['Emergency medicine supply logs and stock registers.'],
      isLifeOrLiberty: true,
    };
    const res = buildRtiApplication(payload);
    expect(res.applicationText).toContain('CONCERNS LIFE OR LIBERTY');
    expect(res.applicationText).toContain('48 HOURS');
    expect(res.exemptionDetails.statutoryWindow).toBe('48 Hours');
  });
});
