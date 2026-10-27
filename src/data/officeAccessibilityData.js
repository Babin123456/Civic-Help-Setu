/**
 * Public-Service Office Accessibility & Needs Dataset (#144)
 *
 * Provides verified accessibility facility audits, source verification dates,
 * and pre-visit confirmation questions for Indian public facilitation offices.
 */

export const ACCESSIBILITY_FEATURE_CATALOG = [
  {
    id: 'step_free_access',
    title: 'Step-Free Entrance & Ramp',
    description: 'Graded wheelchair ramp with dual handrails at the public entrance.',
    confirmationQuestion: 'Is the wheelchair ramp currently unobstructed and open for citizen access today?',
    category: 'mobility',
  },
  {
    id: 'elevators',
    title: 'Accessible Elevator / Lift',
    description: 'Elevator accommodating wheelchairs with braille and auditory announcements.',
    confirmationQuestion: 'Are all office counters on the ground floor, or is the elevator in operational condition?',
    category: 'mobility',
  },
  {
    id: 'accessible_counters',
    title: 'Priority / Accessible Counter',
    description: 'Dedicated low-height counter or priority token lane for PwD and senior citizens.',
    confirmationQuestion: 'Which specific counter number is assigned for priority facilitation of PwD or elderly citizens?',
    category: 'service',
  },
  {
    id: 'accessible_washrooms',
    title: 'Accessible Restroom / Toilet',
    description: 'Wheelchair-accessible unisex restroom with grab bars and wide door swing.',
    confirmationQuestion: 'Is an accessible washroom unlocked and available within the citizen facilitation block?',
    category: 'facility',
  },
  {
    id: 'tactile_paving',
    title: 'Tactile Guidance Flooring',
    description: 'Tactile surface path from the main gate to the enquiry desk for visually impaired visitors.',
    confirmationQuestion: 'Are guiding volunteers or tactile signages available at the reception desk?',
    category: 'sensory',
  },
  {
    id: 'assistive_listening',
    title: 'Sign Language / Language Assistant',
    description: 'Support personnel trained in basic Indian Sign Language (ISL) or language facilitation.',
    confirmationQuestion: 'Can an office assistant or helpdesk personnel assist with reading forms and documents?',
    category: 'communication',
  },
  {
    id: 'companion_seating',
    title: 'Priority Seating & Rest Area',
    description: 'Designated shaded seating for waiting citizens and accompanying caregivers.',
    confirmationQuestion: 'Is indoor priority seating available near the biometric or verification counters?',
    category: 'facility',
  },
  {
    id: 'accessible_parking',
    title: 'Designated PwD Parking Bay',
    description: 'Reserved vehicle parking slot within 30 meters of the main entrance ramp.',
    confirmationQuestion: 'Can an accessible vehicle with a disabled passenger drop off directly at the ramp entrance?',
    category: 'mobility',
  },
];

export const OFFICE_ACCESSIBILITY_RECORDS = [
  {
    officeId: 'delhi-south-collectorate',
    officeName: 'District Magistrate Office - South Delhi',
    lastAuditedDate: '2026-09-15', // Fresh (< 180 days)
    auditedBy: 'Department of Empowerment of Persons with Disabilities (DEPwD)',
    officialSource: {
      name: 'Sugamya Bharat Abhiyan (Accessible India Campaign)',
      url: 'https://accessibleindia.gov.in',
      verified: true,
    },
    features: {
      step_free_access: { status: 'verified_available', notes: 'Permanent masonry ramp with handrails at gate #2' },
      accessible_counters: { status: 'verified_available', notes: 'Counter #1 dedicated for senior citizens and Divyangjan' },
      accessible_parking: { status: 'verified_available', notes: '2 marked parking bays near main gate' },
      accessible_washrooms: { status: 'verified_available', notes: 'Ground floor accessible toilet near reception' },
      elevators: { status: 'verified_unavailable', notes: 'Single-storey facilitation block, no elevator required' },
      // tactile_paving, assistive_listening, companion_seating -> unverified!
    },
  },
  {
    officeId: 'delhi-rto-sarai-kale-khan',
    officeName: 'Regional Transport Office (RTO) - Sarai Kale Khan',
    lastAuditedDate: '2024-05-10', // Stale (> 180 days!)
    auditedBy: 'Delhi State Advisory Board on Disability',
    officialSource: {
      name: 'Delhi Transport Department Accessibility Audit',
      url: 'https://transport.delhi.gov.in',
      verified: true,
    },
    features: {
      step_free_access: { status: 'verified_available', notes: 'Metal ramp at automated driving track entrance' },
      accessible_counters: { status: 'verified_available', notes: 'Separate window for medical fitness and senior licenses' },
      accessible_washrooms: { status: 'verified_unavailable', notes: 'Renovation pending, narrow doorway' },
    },
  },
  {
    officeId: 'bengaluru-koramangala-passport',
    officeName: 'Passport Seva Kendra (PSK) - Koramangala',
    lastAuditedDate: '2026-09-20', // Fresh
    auditedBy: 'Ministry of External Affairs PSK Quality Cell',
    officialSource: {
      name: 'Passport Seva Accessibility Standards',
      url: 'https://www.passportindia.gov.in',
      verified: true,
    },
    features: {
      step_free_access: { status: 'verified_available', notes: 'Elevator and ramp from parking basement' },
      elevators: { status: 'verified_available', notes: 'Braille buttons and voice floor announcements' },
      accessible_counters: { status: 'verified_available', notes: 'Counter A1 with lowered desk for wheelchair applicants' },
      accessible_washrooms: { status: 'verified_available', notes: 'Dedicated accessible washroom with emergency pull cord' },
      companion_seating: { status: 'verified_available', notes: 'Air-conditioned priority waiting rows with wheelchair bays' },
      tactile_paving: { status: 'verified_available', notes: 'Continuous tactile tiles from entry gate to Token Counter' },
    },
  },
  {
    officeId: 'mumbai-bandra-collectorate',
    officeName: 'Suburban Collectorate - Bandra East',
    lastAuditedDate: '2024-02-01', // Stale (> 180 days!)
    auditedBy: 'Maharashtra PWD Accessibility Inspection',
    officialSource: {
      name: 'Maharashtra Revenue Department Facilities Directory',
      url: 'https://mumbaisuburban.gov.in',
      verified: true,
    },
    features: {
      step_free_access: { status: 'verified_available', notes: 'Ramp available at administrative block entrance' },
      elevators: { status: 'verified_available', notes: 'Passenger lift to 2nd floor tehsildar office' },
    },
  },
];
