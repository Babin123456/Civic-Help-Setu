/**
 * @file schoolFeeRegulatoryData.js
 * @description State-level School Fee Regulatory Committees (SFRC), statutory acts (e.g., UP, Maharashtra, Tamil Nadu),
 * standard fee heads, and verified education grievance escalation portals.
 */

export const STATE_SCHOOL_FEE_REGULATORS = [
  {
    state: 'IN-UP',
    stateName: 'Uttar Pradesh',
    actName: 'Uttar Pradesh Self-Financed Independent Schools (Fee Regulation) Act, 2018',
    committeeName: 'District Fee Regulatory Committee (DFRC)',
    chairperson: 'District Magistrate (DM) / Chief Development Officer',
    keyRules: [
      'Annual fee hike capped at Consumer Price Index (CPI) + 5% of tuition fee.',
      'Schools cannot force parents to buy books, uniforms, or stationery from specific vendors.',
      'Capitation fees or admission development donations are strictly prohibited.'
    ],
    complaintPortalUrl: 'https://madhyamikshiksha.upsdc.gov.in',
    appealAuthority: 'State Level Appellate Authority (chaired by retired High Court Judge)'
  },
  {
    state: 'IN-MH',
    stateName: 'Maharashtra',
    actName: 'Maharashtra Educational Institutions (Regulation of Fee) Act, 2011',
    committeeName: 'Divisional Fee Regulatory Committee (DFRC)',
    chairperson: 'Retired District Judge',
    keyRules: [
      'Fee revision permitted only once in two years with prior approval of Executive Parent-Teacher Association (EPTA).',
      'At least 76% of parents in general body must consent if hike exceeds approved slabs.',
      'Detailed audited account submission mandatory.'
    ],
    complaintPortalUrl: 'https://education.maharashtra.gov.in',
    appealAuthority: 'Divisional Commissioner / State Fee Revision Committee'
  },
  {
    state: 'IN-DL',
    stateName: 'Delhi (NCT)',
    actName: 'Delhi School Education Act & Rules (DSEAR), 1973',
    committeeName: 'Directorate of Education (DoE) Fee Scrutiny Cell',
    chairperson: 'Director of Education, GNCTD',
    keyRules: [
      'Private unaided schools operating on DDA allotted land cannot hike fees without prior DoE audit sanction.',
      'No fees under capitation or caution money exceeding statutory limits.'
    ],
    complaintPortalUrl: 'https://edudel.nic.in',
    appealAuthority: 'Delhi School Education Advisory Board'
  }
];

export const STANDARD_FEE_HEADS = [
  'Tuition Fee',
  'Annual Registration / Admission Fee',
  'Computer & Science Laboratory Fee',
  'Library Fee',
  'Sports & Extracurricular Activities Fee',
  'Development Fund',
  'Examination Fee',
  'Transportation Fee (Optional)'
];
