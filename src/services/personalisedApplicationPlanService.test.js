import { describe, it, expect } from 'vitest';
import {
  generatePersonalisedPlan,
  buildPlanPrintHtml,
  APPLICATION_MODES,
  STEP_TYPES,
} from './personalisedApplicationPlanService';

describe('personalisedApplicationPlanService (#476)', () => {
  const verifiedService = {
    id: 'srv-ration-card',
    title: 'Priority Ration Card Issuance',
    department: 'Department of Food, Civil Supplies & Consumer Affairs',
    officialUrl: 'https://nfsa.gov.in/portal/ration-card',
    documents: ['Aadhaar Card', 'Income Certificate', 'Electricity Bill'],
    eligibility: ['Annual family income below Rs 1,00,000', 'No family member in government service'],
    fees: 'Rs. 50 statutory fee at counter',
    sla: '30 business days',
  };

  const sparseService = {
    id: 'srv-sparse',
    title: 'Local Cultural Grant',
    department: 'Ministry of Culture',
    documents: [], // missing
    eligibility: [], // missing
    fees: null, // missing
  };

  it('generates an ordered plan grounded in verified service requirements', () => {
    const plan = generatePersonalisedPlan(verifiedService, {
      mode: APPLICATION_MODES.ONLINE_SELF,
      hasDocumentsReady: true,
      isUrgent: false,
    });

    expect(plan.serviceId).toBe('srv-ration-card');
    expect(plan.steps.length).toBeGreaterThanOrEqual(4);

    const docStep = plan.steps.find((s) => s.sourceField === 'documents');
    expect(docStep).toBeDefined();
    expect(docStep.type).toBe(STEP_TYPES.OFFICIAL_REQUIREMENT);
    expect(docStep.checklist).toHaveLength(3);
    expect(docStep.checklist[0].checked).toBe(true); // pre-checked because hasDocumentsReady is true

    const feeStep = plan.steps.find((s) => s.sourceField === 'fees');
    expect(feeStep).toBeDefined();
    expect(feeStep.officialStatement).toContain('Rs. 50');

    const onlineStep = plan.steps.find((s) => s.sourceField === 'officialUrl');
    expect(onlineStep).toBeDefined();
    expect(onlineStep.sourceUrl).toBe('https://nfsa.gov.in/portal/ration-card');
  });

  it('exposes transparent data limitation advisories when catalogue information is missing', () => {
    const plan = generatePersonalisedPlan(sparseService, {
      mode: APPLICATION_MODES.CSC_COUNTER,
    });

    const docLimitation = plan.steps.find((s) => s.id.includes('step-doc-limitation'));
    expect(docLimitation).toBeDefined();
    expect(docLimitation.type).toBe(STEP_TYPES.MISSING_DATA_ADVISORY);
    expect(docLimitation.guidance).toContain('omitted in the record');

    const feeLimitation = plan.steps.find((s) => s.id.includes('step-fee-notice'));
    expect(feeLimitation).toBeDefined();
    expect(feeLimitation.type).toBe(STEP_TYPES.MISSING_DATA_ADVISORY);
  });

  it('adapts submission guidance based on citizen-chosen application mode', () => {
    const cscPlan = generatePersonalisedPlan(verifiedService, {
      mode: APPLICATION_MODES.CSC_COUNTER,
    });

    const subStep = cscPlan.steps.find((s) => s.id.includes('step-submission-csc'));
    expect(subStep).toBeDefined();
    expect(subStep.guidance).toContain('CSC operator');
  });

  it('generates printable HTML representation', () => {
    const plan = generatePersonalisedPlan(verifiedService, {});
    const html = buildPlanPrintHtml(plan);

    expect(html).toContain('Priority Ration Card Issuance');
    expect(html).toContain('Personalized Step-by-Step Application Roadmap');
    expect(html).toContain('OFFICIAL REQUIREMENT');
    expect(html).toContain('Aadhaar Card');
  });
});
