/**
 * grievanceClassificationService.js
 *
 * Classifies civic complaints and grievances into authoritative municipal and state
 * departments, explaining administrative jurisdiction, specifying evidence to gather,
 * and mapping statutory SLA resolution timelines and escalation ladders.
 */

export const GRIEVANCE_CATEGORIES = {
  ROADS_AND_INFRASTRUCTURE: 'ROADS_AND_INFRASTRUCTURE',
  MUNICIPAL_SANITATION: 'MUNICIPAL_SANITATION',
  WATER_AND_SEWERAGE: 'WATER_AND_SEWERAGE',
  ELECTRICITY_AND_POWER: 'ELECTRICITY_AND_POWER',
  PUBLIC_TRANSPORT: 'PUBLIC_TRANSPORT',
  HEALTH_AND_FOOD_SAFETY: 'HEALTH_AND_FOOD_SAFETY',
  REVENUE_AND_LAND: 'REVENUE_AND_LAND',
  AMBIGUOUS_MULTI_DEPARTMENT: 'AMBIGUOUS_MULTI_DEPARTMENT',
};

const DEPARTMENT_ROUTING_RULES = [
  {
    category: GRIEVANCE_CATEGORIES.ROADS_AND_INFRASTRUCTURE,
    keywords: ['pothole', 'broken road', 'footpath', 'flyover', 'asphalt', 'divider', 'street paving', 'speed breaker', 'tar', 'culvert'],
    department: 'Public Works Department (PWD) / Municipal Road Cell',
    jurisdictionLevel: 'Local Urban Local Body / State PWD for Highways',
    whyThisDepartment:
      'PWD and Municipal Road Engineering divisions are statutorily responsible for maintaining road surfaces, filling hazardous potholes, and repairing damaged pedestrian footpaths.',
    slaDays: 7,
    urgency: 'Medium to High (High if pothole causes vehicle accidents)',
    evidenceToGather: [
      'Clear wide-angle photograph of the damaged road showing nearby landmarks or shop boards.',
      'Close-up photo of the pothole depth with an object (like a water bottle) for scale.',
      'Exact Google Maps geo-coordinates or street cross-junction name.',
      'Date when the damage was first observed or if prior complaints were ignored.',
    ],
    escalationLadder: [
      'Junior Engineer (Roads)',
      'Assistant Executive Engineer (Sub-division)',
      'Executive Engineer (Divisional PWD)',
      'State Public Grievance Redressal Portal / CM Helpline',
    ],
    officialPortals: [
      { name: 'Central CPGRAMS', url: 'https://pgportal.gov.in' },
      { name: 'Meri Sadak (PMGSY Rural Roads)', url: 'http://omms.nic.in' },
    ],
  },
  {
    category: GRIEVANCE_CATEGORIES.MUNICIPAL_SANITATION,
    keywords: ['garbage', 'waste', 'trash', 'dumping', 'stray dogs', 'stray cattle', 'dead animal', 'mosquito', 'fumigation', 'open drain', 'cleanliness', 'littering'],
    department: 'Municipal Solid Waste & Public Health Engineering Department',
    jurisdictionLevel: 'Municipal Ward / Zonal Health Officer',
    whyThisDepartment:
      'Urban local bodies and Municipal Corporations hold the constitutional mandate under the 12th Schedule for conservancy, door-to-door garbage collection, and epidemic prevention.',
    slaDays: 2,
    urgency: 'High (Immediate public health hazard)',
    evidenceToGather: [
      'Photo of uncollected waste heap or overflowing community bin.',
      'Ward number and specific locality landmark.',
      'Time duration the garbage has remained uncollected (e.g., > 48 hours).',
      'Name of the private sanitation concessionaire if designated in your ward.',
    ],
    escalationLadder: [
      'Ward Sanitation Inspector (SI)',
      'Zonal Health Officer (ZHO)',
      'Additional Municipal Commissioner (Sanitation)',
      'State Urban Development Directorate',
    ],
    officialPortals: [
      { name: 'Swachhata Mobile App (MoHUA)', url: 'https://swachhbharatmission.gov.in' },
      { name: 'CPGRAMS Urban Affairs', url: 'https://pgportal.gov.in' },
    ],
  },
  {
    category: GRIEVANCE_CATEGORIES.WATER_AND_SEWERAGE,
    keywords: ['water supply', 'dirty water', 'contaminated tap', 'no water', 'pipeline burst', 'low pressure', 'sewer overflow', 'manhole', 'drainage blockage', 'water tanker'],
    department: 'City Water Supply & Sewerage Board / Jal Board',
    jurisdictionLevel: 'Sub-Divisional Water Supply Office',
    whyThisDepartment:
      'Water Supply and Sewerage undertakings manage bulk water treatment, potable piped distribution, and underground sewer mains.',
    slaDays: 3,
    urgency: 'Critical (Severe contamination or complete water cutoff)',
    evidenceToGather: [
      'Consumer Connection / Consumer ID (RR number or K-Number) printed on your water bill.',
      'Clear bottle sample photo displaying discoloured or muddy tap water.',
      'Photo/Video of sewage overflowing onto the public street or residential compound.',
      'Date and daily timing when water pressure completely drops.',
    ],
    escalationLadder: [
      'Assistant Engineer (Water Supply Maintenance)',
      'Executive Engineer (Water Distribution Zone)',
      'Chief Engineer (Operations)',
      'Consumer Grievance Redressal Forum (CGRF)',
    ],
    officialPortals: [
      { name: 'Jal Jeevan Mission Citizen Portal', url: 'https://ejalshakti.gov.in' },
      { name: 'Central CPGRAMS Water Resources', url: 'https://pgportal.gov.in' },
    ],
  },
  {
    category: GRIEVANCE_CATEGORIES.ELECTRICITY_AND_POWER,
    keywords: ['power cut', 'electricity', 'voltage fluctuation', 'transformer', 'dangling wire', 'electric shock', 'meter fast', 'inflated bill', 'load shedding', 'sparking'],
    department: 'State Electricity Distribution Company (DISCOM)',
    jurisdictionLevel: 'Sub-Divisional Electricity Distribution Office',
    whyThisDepartment:
      'State electricity supply distribution utilities (DISCOMs) are statutorily accountable under the Electricity Act 2003 for uninterrupted transmission, transformer maintenance, and safety.',
    slaDays: 1, // 24 hours standard
    urgency: 'Emergency (if live wire or sparking); Moderate (if billing)',
    evidenceToGather: [
      'Consumer Account / CA Number from your latest electricity bill.',
      'Photo of meter reading and serial number on the physical meter box.',
      'Geo-tagged photo of dangling live wires or sparking transformer.',
      'Log of dates, duration, and frequency of unscheduled power cuts.',
    ],
    escalationLadder: [
      'DISCOM 24x7 Customer Helpline (1912)',
      'Assistant Engineer (Operations & Maintenance)',
      'Consumer Grievance Redressal Forum (CGRF)',
      'State Electricity Ombudsman',
    ],
    officialPortals: [
      { name: 'National 1912 Power Helpline', url: 'https://powermin.gov.in' },
      { name: 'CPGRAMS Ministry of Power', url: 'https://pgportal.gov.in' },
    ],
  },
  {
    category: GRIEVANCE_CATEGORIES.PUBLIC_TRANSPORT,
    keywords: ['bus', 'city bus', 'auto overcharging', 'traffic signal', 'metro', 'bus stop', 'conductor', 'rash driving', 'fare refused', 'rto inspector'],
    department: 'State Road Transport Corporation (SRTC) / Regional Transport Office (RTO)',
    jurisdictionLevel: 'Depot Manager / Traffic Police Commissionerate',
    whyThisDepartment:
      'Public transport utilities manage bus scheduling and staff conduct, while the RTO and Traffic Police enforce meter fares, permit compliance, and traffic lights.',
    slaDays: 5,
    urgency: 'Medium',
    evidenceToGather: [
      'Vehicle registration number (e.g., bus number plate or auto/taxi registration).',
      'Route number, boarding bus stop name, and destination.',
      'Time of incident and physical passenger bus ticket copy.',
      'Video/Photo or audio recording of fare refusal or meter tampering if safely recorded.',
    ],
    escalationLadder: [
      'Depot Manager / Bus Terminal In-charge',
      'Divisional Controller (SRTC)',
      'Regional Transport Officer (Enforcement)',
      'State Transport Commissioner',
    ],
    officialPortals: [
      { name: 'Parivahan Sewa Grievance', url: 'https://parivahan.gov.in' },
      { name: 'Traffic Police E-Grievance', url: 'https://pgportal.gov.in' },
    ],
  },
  {
    category: GRIEVANCE_CATEGORIES.HEALTH_AND_FOOD_SAFETY,
    keywords: ['hospital', 'phc', 'doctor absent', 'medicine shortage', 'food poisoning', 'adulteration', 'restaurant dirty', 'expired medicine'],
    department: 'District Health Officer (DHO) / Food Safety and Standards Authority (FSSAI)',
    jurisdictionLevel: 'District Chief Medical Officer / Food Safety Officer',
    whyThisDepartment:
      'The District Health Department oversees public hospital staff and drug availability, while FSSAI regulates hygiene standards and food adulteration.',
    slaDays: 3,
    urgency: 'High (Immediate patient risk or food contamination outbreak)',
    evidenceToGather: [
      'Hospital registration slip (OPD ticket) or chemist bill.',
      'Batch number and expiry date photo of substandard medicine or food package.',
      'Name of the government PHC, hospital, or commercial food establishment.',
      'Medical consultation notes or lab test report if food poisoning occurred.',
    ],
    escalationLadder: [
      'Medical Superintendent of the Hospital',
      'District Chief Medical Officer (CMO)',
      'State Director of Health Services',
      'State Human Rights Commission (SHRC)',
    ],
    officialPortals: [
      { name: 'FSSAI Consumer Grievance Portal', url: 'https://foscos.fssai.gov.in' },
      { name: 'CPGRAMS Health & Family Welfare', url: 'https://pgportal.gov.in' },
    ],
  },
  {
    category: GRIEVANCE_CATEGORIES.REVENUE_AND_LAND,
    keywords: ['patta', 'mutation', 'encroachment', 'tehsildar', 'bribe', 'revenue inspector', 'land dispute', 'sub registrar', 'stamp duty'],
    department: 'Revenue Department / Sub-Divisional Magistrate (SDM)',
    jurisdictionLevel: 'Tehsil / Taluk Office & District Collectorate',
    whyThisDepartment:
      'The Revenue Department is the statutory custodian of agricultural land records, title mutation, and government land boundaries.',
    slaDays: 15,
    urgency: 'Medium',
    evidenceToGather: [
      'Survey number, village name, and Khata number of the land parcel.',
      'Application acknowledgment number for pending mutation or title copy.',
      'Sale deed or registered document copy.',
      'Written communication or notice received from the Tehsildar.',
    ],
    escalationLadder: [
      'Tehsildar / Taluk Revenue Officer',
      'Sub-Divisional Magistrate (SDM) / Revenue Divisional Officer (RDO)',
      'District Magistrate (Collector / DC)',
      'State Land Revenue Appellate Tribunal',
    ],
    officialPortals: [
      { name: 'State Bhulekh / Land Records Portal', url: 'https://pgportal.gov.in' },
      { name: 'Central CPGRAMS Land Resources', url: 'https://pgportal.gov.in' },
    ],
  },
];

/**
 * Curated realistic sample complaints for testing & interactive demonstration.
 */
export const SAMPLE_GRIEVANCES = [
  {
    id: 'sample-pothole',
    label: 'Damaged Potholes on Main Street',
    text: 'Huge deep pothole on MG Road near the metro pillar 42. Two two-wheelers skidded yesterday. Road asphalt completely eroded.',
  },
  {
    id: 'sample-garbage',
    label: 'Uncollected Garbage Heap',
    text: 'Garbage dumping site in Ward 12 has not been cleared for 4 days. Foul smell and stray dogs tearing open plastic waste.',
  },
  {
    id: 'sample-water',
    label: 'Contaminated Muddy Drinking Water',
    text: 'Tap water supply coming completely brown and muddy for the past 3 days. Pipeline seems to have leaked near the sewer line.',
  },
  {
    id: 'sample-electricity',
    label: 'Sparks and Low Voltage from Transformer',
    text: 'Severe voltage fluctuation in our residential block. Transformer near street 4 is making loud humming and sparking sounds.',
  },
  {
    id: 'sample-bus',
    label: 'Bus Route Cancellation & Overcharging',
    text: 'Bus route 204 skipped scheduled morning stops. Auto drivers outside railway station charging 300 rupees without running meter.',
  },
];

/**
 * Classifies a civic grievance description and recommends the responsible department.
 *
 * @param {string} grievanceText - Citizen's description of the problem
 * @param {Object} [options] - Optional jurisdiction or location filters
 * @returns {Object} Structured classification, department recommendation, SLA, and checklist
 */
export function classifyGrievance(grievanceText = '', options = {}) {
  const safeText = String(grievanceText || '').trim().toLowerCase();

  if (!safeText) {
    return {
      isValid: false,
      reason: 'No complaint description provided.',
      recommendation: null,
    };
  }

  // Score each rule based on keyword matches
  const matchResults = [];

  DEPARTMENT_ROUTING_RULES.forEach((rule) => {
    let score = 0;
    const matchedKeywords = [];

    rule.keywords.forEach((kw) => {
      if (safeText.includes(kw)) {
        score += kw.includes(' ') ? 15 : 10; // Give higher weight to multi-word phrases
        matchedKeywords.push(kw);
      }
    });

    if (score > 0) {
      matchResults.push({
        rule,
        score,
        matchedKeywords,
      });
    }
  });

  // Sort descending by score
  matchResults.sort((a, b) => b.score - a.score);

  // If no keywords match at all, return graceful fallback
  if (matchResults.length === 0) {
    return {
      isValid: true,
      category: GRIEVANCE_CATEGORIES.AMBIGUOUS_MULTI_DEPARTMENT,
      confidence: 30,
      department: 'Centralized Public Grievance Redressal System (CPGRAMS) / District Collectorate',
      jurisdictionLevel: 'District Magistrate / General Administration',
      whyThisDepartment:
        'Your grievance involves generalized administrative issues or terminology that cuts across multiple utility boards. Filing via the central district portal ensures automated inter-departmental dispatch.',
      slaDays: 14,
      urgency: 'Medium',
      evidenceToGather: [
        'Detailed chronological sequence of dates and events.',
        'Names and designations of any government officials contacted previously.',
        'Copies of earlier receipts, letters, or acknowledgment tokens.',
        'Clear statement of the specific relief or resolution demanded.',
      ],
      escalationLadder: [
        'District Grievance Officer',
        'Chief Minister Helpline / Jan Samvaad (1076 / 1902)',
        'Lokayukta / State Vigilance Commission',
      ],
      officialPortals: [
        { name: 'Central CPGRAMS Portal', url: 'https://pgportal.gov.in' },
      ],
      isAmbiguous: true,
    };
  }

  // Check if multiple categories have close high scores (multi-department dispute)
  const topMatch = matchResults[0];
  const secondMatch = matchResults[1];
  const isMultiDepartment = Boolean(secondMatch && secondMatch.score >= 10 && secondMatch.score >= topMatch.score * 0.3);

  const topRule = topMatch.rule;
  const confidence = Math.min(95, Math.max(50, topMatch.score * 4));

  return {
    isValid: true,
    category: topRule.category,
    confidence,
    department: topRule.department,
    jurisdictionLevel: topRule.jurisdictionLevel,
    whyThisDepartment: topRule.whyThisDepartment,
    matchedKeywords: topMatch.matchedKeywords,
    slaDays: topRule.slaDays,
    urgency: topRule.urgency,
    evidenceToGather: topRule.evidenceToGather,
    escalationLadder: topRule.escalationLadder,
    officialPortals: topRule.officialPortals,
    isMultiDepartment,
    secondaryDepartment: isMultiDepartment ? secondMatch.rule.department : null,
    secondaryNotice: isMultiDepartment
      ? `This issue also touches upon ${secondMatch.rule.department} (${secondMatch.matchedKeywords.join(', ')}). You may need to copy this grievance to both authorities.`
      : null,
  };
}
