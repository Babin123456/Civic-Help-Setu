/**
 * src/data/digitalTwinSeed.js
 * Canonical Seed Workflows for the Civic Workflow Digital Twin (#1157).
 *
 * Includes:
 * 1. Income & Asset Certificate (v1.0.0 Baseline)
 * 2. Income & Asset Certificate (v1.1.0 Proposed - Digitized verification)
 * 3. Income & Asset Certificate (v1.2.0 Defective - Injected Dead End & unreachable branch)
 * 4. Street Vending Certificate (v1.0.0 Baseline)
 * 5. New Municipal Water & Sewerage Connection (v1.0.0 Multi-Office Baseline)
 */

import { NODE_TYPES, EDGE_TYPES, TERMINAL_STATUSES } from './digitalTwinContract';

/**
 * Baseline Working Workflow: Income Certificate (v1.0.0)
 */
export const WORKFLOW_INCOME_CERT_V1 = {
  id: 'wf-income-cert-v1',
  serviceId: 'income-certificate',
  version: '1.0.0',
  title: 'Income and Asset Certificate (Baseline 2025)',
  description: 'Standard 4-tier statutory verification through Taluk Office and Revenue Inspector.',
  initialStepId: 'step-online-intake',
  statutorySlaDays: 21,
  nodes: [
    {
      id: 'step-online-intake',
      label: 'Digital Intake Form Submission',
      type: NODE_TYPES.SERVICE_STEP,
      estimatedDays: 1,
      requiresOfficeVisit: false,
    },
    {
      id: 'doc-identity',
      label: 'Proof of Identity (Aadhaar or Voter ID)',
      type: NODE_TYPES.DOCUMENT_REQUIREMENT,
      acceptableKeys: ['DOC_AADHAAR_SYNTHETIC', 'DOC_VOTER_ID_ORIGIN_STATE', 'DOC_PAN_SYNTHETIC'],
      isMandatory: true,
    },
    {
      id: 'doc-address',
      label: 'Proof of Residence (Electricity Bill or Rent Agreement)',
      type: NODE_TYPES.DOCUMENT_REQUIREMENT,
      acceptableKeys: ['DOC_ELECTRICITY_BILL_LOCAL', 'DOC_RENT_AGREEMENT_CURRENT', 'DOC_MUNICIPAL_PROPERTY_RECEIPT'],
      isMandatory: true,
    },
    {
      id: 'doc-income-evidence',
      label: 'Income Proof (Salary Slip, BPL Card, or Self-Declaration)',
      type: NODE_TYPES.DOCUMENT_REQUIREMENT,
      acceptableKeys: ['DOC_SALARY_SLIP_CURRENT', 'DOC_BPL_RATION_CARD_SYNTHETIC', 'DOC_INCOME_DECLARATION_SELF', 'DOC_PENSION_PAYMENT_ORDER'],
      isMandatory: true,
    },
    {
      id: 'office-tahsil-scrutiny',
      label: 'Taluk Revenue Scrutiny Counter',
      type: NODE_TYPES.OFFICE_DESK,
      department: 'Revenue & Disaster Management',
      isAccessibleDesk: true,
    },
    {
      id: 'step-field-enquiry',
      label: 'Village Administrative Officer (VAO) Field Verification',
      type: NODE_TYPES.SERVICE_STEP,
      estimatedDays: 7,
      requiresOfficeVisit: false,
    },
    {
      id: 'step-revenue-inspector-signoff',
      label: 'Revenue Inspector (RI) Recommendation',
      type: NODE_TYPES.SERVICE_STEP,
      estimatedDays: 4,
      requiresOfficeVisit: false,
    },
    {
      id: 'step-tahsildar-approval',
      label: 'Tahsildar Digital Signature & Dispatch',
      type: NODE_TYPES.SERVICE_STEP,
      estimatedDays: 3,
      requiresOfficeVisit: false,
    },
    {
      id: 'term-approved',
      label: 'Certificate Digitally Issued & Downloadable',
      type: NODE_TYPES.TERMINAL_STATE,
      terminalStatus: TERMINAL_STATUSES.APPROVED.id,
    },
    {
      id: 'term-deficiency-notice',
      label: 'Deficiency Notice Issued (15-Day Cure Period)',
      type: NODE_TYPES.TERMINAL_STATE,
      terminalStatus: TERMINAL_STATUSES.REJECTED_WITH_REMEDY.id,
    },
  ],
  edges: [
    { id: 'e1', source: 'step-online-intake', target: 'doc-identity', type: EDGE_TYPES.REQUIRES_DOCUMENT },
    { id: 'e2', source: 'step-online-intake', target: 'doc-address', type: EDGE_TYPES.REQUIRES_DOCUMENT },
    { id: 'e3', source: 'step-online-intake', target: 'doc-income-evidence', type: EDGE_TYPES.REQUIRES_DOCUMENT },
    { id: 'e4', source: 'step-online-intake', target: 'office-tahsil-scrutiny', type: EDGE_TYPES.PROCEEDS_TO_OFFICE },
    { id: 'e5', source: 'step-online-intake', target: 'step-field-enquiry', type: EDGE_TYPES.SEQUENTIAL_STEP },
    { id: 'e6', source: 'step-field-enquiry', target: 'step-revenue-inspector-signoff', type: EDGE_TYPES.SEQUENTIAL_STEP },
    { id: 'e7', source: 'step-revenue-inspector-signoff', target: 'step-tahsildar-approval', type: EDGE_TYPES.SEQUENTIAL_STEP },
    { id: 'e8', source: 'step-tahsildar-approval', target: 'term-approved', type: EDGE_TYPES.SEQUENTIAL_STEP },
    { id: 'e9', source: 'step-field-enquiry', target: 'term-deficiency-notice', type: EDGE_TYPES.CONDITIONAL_BRANCH, condition: 'unresolvedDiscrepancy' },
  ],
};

/**
 * Proposed Improved Workflow: Income Certificate (v1.1.0)
 * Uses instant API validation to bypass physical field enquiry for salaried applicants.
 */
export const WORKFLOW_INCOME_CERT_V2_PROPOSED = {
  ...WORKFLOW_INCOME_CERT_V1,
  id: 'wf-income-cert-v2-proposed',
  version: '1.1.0',
  title: 'Income Certificate (Proposed 2026 - Accelerated e-Kendra)',
  description: 'Fast-track path with pre-verified document registry and automated VAO routing.',
  statutorySlaDays: 14,
  nodes: [
    ...WORKFLOW_INCOME_CERT_V1.nodes.filter((n) => n.id !== 'step-field-enquiry'),
    {
      id: 'step-instant-verification',
      label: 'Automated Database Cross-Check (e-District Registry)',
      type: NODE_TYPES.SERVICE_STEP,
      estimatedDays: 1,
      requiresOfficeVisit: false,
    },
  ],
  edges: [
    { id: 'e1', source: 'step-online-intake', target: 'doc-identity', type: EDGE_TYPES.REQUIRES_DOCUMENT },
    { id: 'e2', source: 'step-online-intake', target: 'doc-address', type: EDGE_TYPES.REQUIRES_DOCUMENT },
    { id: 'e3', source: 'step-online-intake', target: 'doc-income-evidence', type: EDGE_TYPES.REQUIRES_DOCUMENT },
    { id: 'e4', source: 'step-online-intake', target: 'office-tahsil-scrutiny', type: EDGE_TYPES.PROCEEDS_TO_OFFICE },
    { id: 'e5-fast', source: 'step-online-intake', target: 'step-instant-verification', type: EDGE_TYPES.SEQUENTIAL_STEP },
    { id: 'e6-fast', source: 'step-instant-verification', target: 'step-revenue-inspector-signoff', type: EDGE_TYPES.SEQUENTIAL_STEP },
    { id: 'e7', source: 'step-revenue-inspector-signoff', target: 'step-tahsildar-approval', type: EDGE_TYPES.SEQUENTIAL_STEP },
    { id: 'e8', source: 'step-tahsildar-approval', target: 'term-approved', type: EDGE_TYPES.SEQUENTIAL_STEP },
  ],
};

/**
 * Defective Workflow with Anomaly / Dead End (v1.2.0 Defective)
 * Introduces an impossible document requirement with no issuing desk, and a dead-end state with no outbound transitions.
 */
export const WORKFLOW_INCOME_CERT_V2_DEFECTIVE = {
  ...WORKFLOW_INCOME_CERT_V1,
  id: 'wf-income-cert-v2-defective',
  version: '1.2.0-flawed',
  title: 'Income Certificate (Draft with Unintended Dead Ends)',
  description: 'Unpublished draft containing an impossible document requirement and an unresolvable counter trap.',
  statutorySlaDays: 21,
  nodes: [
    ...WORKFLOW_INCOME_CERT_V1.nodes,
    {
      id: 'doc-impossible-gazette',
      label: 'Rare Gazette Notification of Ancient Lineage',
      type: NODE_TYPES.DOCUMENT_REQUIREMENT,
      acceptableKeys: ['DOC_ANCIENT_GAZETTE_UNOBTAINABLE'],
      isMandatory: true,
    },
    {
      id: 'step-dead-end-counter',
      label: 'Special Vigilance Cell Physical Appearance',
      type: NODE_TYPES.SERVICE_STEP,
      estimatedDays: 14,
      requiresOfficeVisit: true,
    },
    {
      id: 'term-unresolved-dead-end',
      label: 'Indefinitely Suspended Application (Dead End)',
      type: NODE_TYPES.TERMINAL_STATE,
      terminalStatus: TERMINAL_STATUSES.DEAD_END_TERMINATION.id,
    },
  ],
  edges: [
    ...WORKFLOW_INCOME_CERT_V1.edges,
    // Step requires impossible document:
    { id: 'e-bad-1', source: 'step-online-intake', target: 'doc-impossible-gazette', type: EDGE_TYPES.REQUIRES_DOCUMENT },
    // Branch leading into a dead-end counter with no path to approval:
    { id: 'e-bad-2', source: 'step-revenue-inspector-signoff', target: 'step-dead-end-counter', type: EDGE_TYPES.SEQUENTIAL_STEP },
    { id: 'e-bad-3', source: 'step-dead-end-counter', target: 'term-unresolved-dead-end', type: EDGE_TYPES.SEQUENTIAL_STEP },
  ],
};

/**
 * Baseline Working Workflow: Street Vending Certificate (v1.0.0)
 */
export const WORKFLOW_STREET_VENDOR_V1 = {
  id: 'wf-street-vendor-v1',
  serviceId: 'street-vendor-certificate',
  version: '1.0.0',
  title: 'Street Vendor Certificate of Vending (Town Vending Committee)',
  description: 'Municipal statutory process under Street Vendors (Protection of Livelihood) Act.',
  initialStepId: 'step-vendor-application',
  statutorySlaDays: 30,
  nodes: [
    {
      id: 'step-vendor-application',
      label: 'Application with Vending Zone Preference',
      type: NODE_TYPES.SERVICE_STEP,
      estimatedDays: 2,
      requiresOfficeVisit: false,
    },
    {
      id: 'doc-vendor-id',
      label: 'Applicant Identity Proof',
      type: NODE_TYPES.DOCUMENT_REQUIREMENT,
      acceptableKeys: ['DOC_AADHAAR_SYNTHETIC', 'DOC_VOTER_ID_ORIGIN_STATE'],
      isMandatory: true,
    },
    {
      id: 'office-ward-health-desk',
      label: 'Ward Health & Sanitation Department',
      type: NODE_TYPES.OFFICE_DESK,
      department: 'Municipal Corporation',
      isAccessibleDesk: true,
    },
    {
      id: 'step-site-survey',
      label: 'Ward Inspector Natural Market Site Survey',
      type: NODE_TYPES.SERVICE_STEP,
      estimatedDays: 10,
      requiresOfficeVisit: false,
    },
    {
      id: 'step-tvc-deliberation',
      label: 'Town Vending Committee (TVC) Bi-Monthly Review',
      type: NODE_TYPES.SERVICE_STEP,
      estimatedDays: 14,
      requiresOfficeVisit: true,
    },
    {
      id: 'term-vendor-approved',
      label: 'Vending Certificate & ID Card Issued',
      type: NODE_TYPES.TERMINAL_STATE,
      terminalStatus: TERMINAL_STATUSES.APPROVED.id,
    },
  ],
  edges: [
    { id: 'ev1', source: 'step-vendor-application', target: 'doc-vendor-id', type: EDGE_TYPES.REQUIRES_DOCUMENT },
    { id: 'ev2', source: 'step-vendor-application', target: 'office-ward-health-desk', type: EDGE_TYPES.PROCEEDS_TO_OFFICE },
    { id: 'ev3', source: 'step-vendor-application', target: 'step-site-survey', type: EDGE_TYPES.SEQUENTIAL_STEP },
    { id: 'ev4', source: 'step-site-survey', target: 'step-tvc-deliberation', type: EDGE_TYPES.SEQUENTIAL_STEP },
    { id: 'ev5', source: 'step-tvc-deliberation', target: 'term-vendor-approved', type: EDGE_TYPES.SEQUENTIAL_STEP },
  ],
};

export const SEED_WORKFLOWS = [
  WORKFLOW_INCOME_CERT_V1,
  WORKFLOW_INCOME_CERT_V2_PROPOSED,
  WORKFLOW_INCOME_CERT_V2_DEFECTIVE,
  WORKFLOW_STREET_VENDOR_V1,
];
