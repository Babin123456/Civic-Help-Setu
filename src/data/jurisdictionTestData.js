// Synthetic test data for jurisdiction hand-off map feature (#815)
// This data is used for unit tests, component tests, and manual verification.
// It demonstrates the data model and edge cases handled by the feature.

/**
 * Sample authority records representing different government administrative bodies.
 * Each record has provenance information and effective dates.
 */
export const SAMPLE_AUTHORITIES = [
  {
    id: 'central-government',
    name: 'Central Government',
    level: 'national',
    description: 'Central / Indian Government authority responsible for the service',
    contact: 'National helpline: 1800-11-3333',
    portal: 'https://www.gov.in',
    escalation: 'Ministry of Personnel, Public Grievances and Pensions',
    source: 'Indian Government Web Portal',
    effectiveFrom: new Date('2020-01-01'),
    sourceVersion: '1.0',
    lastVerified: '2024-06-15',
  },
  {
    id: 'state-tamil-nadu',
    name: 'Government of Tamil Nadu',
    level: 'state',
    description: 'State-level authority for Tamil Nadu',
    contact: 'Chennai: 1070 (TN Govt Helpline)',
    portal: 'https://www.tn.gov.in',
    escalation: 'Chief Minister Office, Tamil Nadu',
    source: 'Tamil Nadu Government Web Portal',
    effectiveFrom: new Date('2020-01-01'),
    sourceVersion: '2.3',
    lastVerified: '2024-10-20',
  },
  {
    id: 'district-chennai',
    name: 'Chennai District',
    level: 'district',
    description: 'District-level authority for Chennai',
    contact: 'District Collector, Chennai: 044-2825xxxx',
    portal: 'https://chennaicorporation.gov.in',
    escalation: 'District Magistrate, Chennai',
    source: 'District Administration, Chennai',
    effectiveFrom: new Date('2020-01-01'),
    sourceVersion: '1.5',
    lastVerified: '2024-09-10',
  },
  {
    id: 'local-chennai-corpid',
    name: 'Chennai Corporation',
    level: 'local',
    description: 'Local body authority for Chennai',
    contact: 'Municipal Commissioner, Chennai Corporation',
    portal: 'https://www.chennaicorp.gov.in',
    escalation: 'State Government Grievance Redressal',
    source: 'Local Body Administration, Chennai',
    effectiveFrom: new Date('2020-01-01'),
    sourceVersion: '3.1',
    lastVerified: '2024-11-01',
  },
  {
    id: 'state-kerala',
    name: 'Government of Kerala',
    level: 'state',
    description: 'State-level authority for Kerala',
    contact: 'Thiruvananthapuram: 1076 (Kerala Helpline)',
    portal: 'https://www.kerala.gov.in',
    escalation: 'Chief Minister Office, Kerala',
    source: 'Kerala Government Web Portal',
    effectiveFrom: new Date('2020-01-01'),
    sourceVersion: '2.1',
    lastVerified: '2024-08-15',
  },
];

/**
 * Sample service records with jurisdiction metadata.
 * These demonstrate different jurisdiction levels and multi-authority services.
 */
export const SAMPLE_SERVICES = [
  {
    id: 'birth-certificate',
    name: 'Birth Certificate',
    category: 'Certificates',
    type: 'Online / Offline',
    difficulty: 'Medium',
    feeType: 'paid',
    speedDays: 30,
    popularityScore: 92,
    jurisdiction: {
      level: 'state',
      states: ['Tamil Nadu'],
      districts: [],
      localBody: '',
    },
    shortDescription: 'Register a birth in Tamil Nadu with the Registrar for the place where it occurred.',
    description: 'Register a birth in Tamil Nadu with the Registrar for the place where it occurred, then search or download the official certificate through the Tamil Nadu Civil Registration System.',
    documents: [
      'Hospital or health-centre birth record / institutional acknowledgement',
      'Evidence of the date and place of birth requested by the jurisdictional Registrar',
      'Self-attested supporting document in Form 14 (for delayed reporting after 30 days)',
    ],
    steps: [
      {
        title: 'Identify the correct Registrar',
        description: 'Use the place where the birth occurred to identify the local registration unit and Registrar.',
      },
      {
        title: 'Check who reports the birth',
        description: 'For a hospital, the institution is responsible. For a home birth, the citizen/informant should report it to the Registrar for the local area.',
      },
      {
        title: 'Report within 21 days',
        description: 'Tamil Nadu Rule 5(3) requires the information to be given within 21 days from the date of birth.',
      },
    ],
    officialSources: [
      {
        name: 'Tamil Nadu Directorate of Town Panchayats — Birth and Death Registration',
        url: 'https://townpanchayat.in/birth_death.php',
        verified: true,
        lastVerified: '2026-11-05',
      },
    ],
  },
  {
    id: 'driving-licence',
    name: 'Driving Licence',
    category: 'Licences',
    type: 'Online / Offline',
    difficulty: 'Medium',
    feeType: 'paid',
    speedDays: 21,
    popularityScore: 88,
    jurisdiction: {
      level: 'state',
      states: ['Kerala', 'Tamil Nadu'],
      districts: [],
      localBody: '',
    },
    shortDescription: 'Apply for or renew a driving licence in Kerala or Tamil Nadu.',
    description: 'Apply for a new driving licence or renew an existing one. The Regional Transport Office (RTO) for your area handles the application process.',
    steps: [
      {
        title: 'Schedule an RTO appointment',
        description: 'Book a slot at the nearest Regional Transport Office using the online portal.',
      },
      {
        title: 'Submit documents and take test',
        description: 'Bring required documents (age proof, address proof, identity proof) and pass the driving test.',
      },
      {
        title: 'Receive licence',
        description: 'The licence is issued upon successful completion of the test and document verification.',
      },
    ],
    officialSources: [
      {
        name: 'Kerala Motor Vehicles Department',
        url: 'https://transport.kerala.gov/',
        verified: true,
        lastVerified: '2026-10-28',
      },
    ],
  },
  {
    id: 'property-tax',
    name: 'Property Tax',
    category: 'Payments',
    type: 'Online',
    difficulty: 'Easy',
    feeType: 'paid',
    speedDays: 14,
    popularityScore: 76,
    jurisdiction: {
      level: 'local',
      states: ['Tamil Nadu'],
      districts: ['Chennai'],
      localBody: 'Chennai Corporation',
    },
    shortDescription: 'Pay property tax for properties in Chennai',
    description: 'Pay property tax for residential or commercial properties located within Chennai Corporation limits.',
    steps: [
      {
        title: 'Find your property ID',
        description: 'Locate your property identification number from previous tax receipts or the corporation website.',
      },
      {
        title: 'Calculate tax amount',
        description: 'Use the online calculator with property area, usage type, and location details.',
      },
      {
        title: 'Make payment',
        description: 'Pay online via net banking, UPI, or card, or visit a corporation counter.',
      },
    ],
    officialSources: [
      {
        name: 'Chennai Corporation - Property Tax',
        url: 'https://www.chennaicorp.gov.in/property-tax',
        verified: true,
        lastVerified: '2026-11-10',
      },
    ],
  },
  {
    id: 'death-certificate',
    name: 'Death Certificate',
    category: 'Certificates',
    type: 'Online / Offline',
    difficulty: 'Medium',
    feeType: 'paid',
    speedDays: 21,
    popularityScore: 85,
    jurisdiction: {
      level: 'state',
      states: ['Kerala'],
      districts: ['Ernakulam'],
      localBody: '',
    },
    shortDescription: 'Register a death and obtain the certificate in Kerala',
    description: 'Register a death with the local registrar and obtain the official death certificate through the Kerala Civil Registration System.',
    steps: [
      {
        title: 'Report the death',
        description: 'Report the death to the local registrar within 21 days using the prescribed form.',
      },
      {
        title: 'Verification',
        description: 'The registrar verifies the details and issues a temporary death certificate.',
      },
      {
        title: 'Download certificate',
        description: 'The final certificate can be downloaded from the civil registration portal.',
      },
    ],
    officialSources: [
      {
        name: 'Kerala Civil Registration System',
        url: 'https://crs.kerala.gov.in',
        verified: true,
        lastVerified: '2026-10-25',
      },
    ],
  },
];

/**
 * Sample jurisdiction mappings (locality/PIN -> authority).
 * This is the maintained data used for geospatial lookup.
 * In production, this would be a comprehensive, versioned dataset.
 */
export const SAMPLE_JURISDICTION_MAPPINGS = {
  all: [
    // National-level entries
    {
      locality: 'india',
      stage: 'national',
      authority: 'central-government',
      state: 'all',
    },
    
    // Tamil Nadu entries
    {
      locality: 'chennai',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    {
      locality: '600001',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    {
      locality: '600002',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    {
      locality: '600003',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    {
      locality: '600004',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    {
      locality: '600005',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    {
      locality: '600006',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    {
      locality: '600007',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    {
      locality: '600008',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    {
      locality: '600009',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    {
      locality: '600010',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    
    // Kerala entries
    {
      locality: 'ernakulam',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
    {
      locality: '682001',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
    {
      locality: '682002',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
    {
      locality: '682003',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
    {
      locality: '682004',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
    {
      locality: '682005',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
    {
      locality: '682006',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
    {
      locality: '682007',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
    {
      locality: '682008',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
    {
      locality: '682009',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
    {
      locality: '682010',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
    
    // Chennai district entries
    {
      locality: 'chennai district',
      stage: 'district',
      authority: 'district-chennai',
      state: 'tamil-nadu',
    },
  ],
  
  // State-specific mappings
  'tamil-nadu': [
    {
      locality: 'chennai',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
    {
      locality: '600001',
      stage: 'local',
      authority: 'local-chennai-corpid',
      state: 'tamil-nadu',
    },
  ],
  
  'kerala': [
    {
      locality: 'ernakulam',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
    {
      locality: '682001',
      stage: 'district',
      authority: 'district-chennai',
      state: 'kerala',
    },
  ],
};

/**
 * Edge case test data demonstrating ambiguous and unavailable jurisdictions.
 */
export const EDGE_CASES = {
  ambiguousLocalities: [
    {
      locality: 'north delhi',
      description: 'Could map to multiple Delhi district authorities',
      expectedBehavior: 'requiresConfirmation',
    },
    {
      locality: 'west mumbai',
      description: 'Could map to multiple municipal corporations',
      expectedBehavior: 'requiresConfirmation',
    },
  ],
  
  unavailableLocalities: [
    {
      locality: '999999',
      description: 'Invalid PIN code - no match in maintained data',
      expectedBehavior: 'unavailable',
    },
    {
      locality: 'unknown village',
      description: 'Locality not in maintained mappings',
      expectedBehavior: 'unavailable',
    },
  ],
  
  boundaryOverlaps: [
    {
      locality: 'border area',
      description: 'Locality on state boundary - could belong to either state',
      expectedBehavior: 'ambiguity surfaced, manual confirmation required',
    },
  ],
};