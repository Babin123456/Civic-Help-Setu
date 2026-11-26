/**
 * @file municipalBudgetData.js
 * @description Plain-language educational definitions, budget lifecycle stages,
 * glossary items, and sample ward budget allocations for municipal finance literacy.
 */

export const MUNICIPAL_BUDGET_GLOSSARY = [
  {
    term: 'Capital Expenditure (CapEx)',
    plainExplanation: 'Money spent on building or buying long-lasting public assets, such as storm water drains, roads, bridges, parks, and schools.',
    example: 'Constructing a new pedestrian skywalk or tarring a major arterial road.'
  },
  {
    term: 'Revenue Expenditure (OpEx)',
    plainExplanation: 'Day-to-day operational expenses needed to keep municipal services running, including sanitation worker salaries, electricity for streetlights, and diesel for garbage trucks.',
    example: 'Paying monthly electricity bills for ward street lighting.'
  },
  {
    term: 'Ward Committee Budget Allocation',
    plainExplanation: 'Discretionary or dedicated funds assigned specifically to each ward committee to address hyper-local civic issues like footpath repairs, streetlight fixes, and park maintenance.',
    example: 'Allocation of ₹25 Lakhs per ward for pothole filling and footpath repair voted by ward committee.'
  },
  {
    term: 'Tender / Work Order',
    plainExplanation: 'A public procurement contract awarded to a contractor to execute an approved civic project within a specified budget and timeline.',
    example: 'Tender issued for desilting roadside drains before monsoon season.'
  },
  {
    term: 'Utilization Ratio',
    plainExplanation: 'The percentage of allocated funds that were actually spent by the municipality during the financial year.',
    example: 'If ₹1 Crore was budgeted and ₹85 Lakhs was spent, the utilization ratio is 85%.'
  }
];

export const BUDGET_LIFECYCLE_STAGES = [
  {
    stage: 'PREPARATION_AND_CITIZEN_INPUT',
    name: '1. Budget Preparation & Citizen Consultations',
    description: 'Ward committees and citizen groups submit priorities; municipal departments aggregate estimates.',
    citizenAction: 'Participate in pre-budget ward sabhas and submit local infrastructure priorities.'
  },
  {
    stage: 'COUNCIL_APPROVAL',
    name: '2. Council Discussion & Approval',
    description: 'Elected municipal corporators and standing committees review, debate, and pass the budget document.',
    citizenAction: 'Track which ward demands were included in the approved budget book.'
  },
  {
    stage: 'ESTIMATES_AND_TENDERING',
    name: '3. Technical Estimates & Tendering',
    description: 'Engineers prepare estimates, issue tenders, and evaluate bids on the e-procurement portal.',
    citizenAction: 'Inspect tender notices to verify project scope and contractor eligibility.'
  },
  {
    stage: 'EXECUTION_AND_EXPENDITURE',
    name: '4. Project Execution & Payment',
    description: 'Contractor executes physical works; bills are verified and disbursed in milestones.',
    citizenAction: 'Inspect physical works against work order specifications.'
  },
  {
    stage: 'AUDIT_AND_SCRUTINY',
    name: '5. Social and Financial Audit',
    description: 'CAG / local fund audit checks accounts, and ward committees review completion quality.',
    citizenAction: 'Review social audit reports and seek accountability in ward committee meetings.'
  }
];

export const SAMPLE_WARD_BUDGETS = [
  {
    wardId: 'ka_blr_w143',
    wardNumber: 143,
    wardName: 'Jayanagar 1st Block',
    city: 'Bengaluru',
    fiscalYear: '2025-2026',
    totalAllocatedLakhs: 180,
    categories: [
      { category: 'Footpaths & Pedestrian Safety', allocatedLakhs: 60, spentLakhs: 48 },
      { category: 'Storm Water Drains & Desilting', allocatedLakhs: 45, spentLakhs: 42 },
      { category: 'Parks & Green Spaces', allocatedLakhs: 35, spentLakhs: 30 },
      { category: 'Street Lighting & Energy', allocatedLakhs: 20, spentLakhs: 18 },
      { category: 'Pothole & Road Patchwork', allocatedLakhs: 20, spentLakhs: 15 }
    ]
  }
];
