/**
 * Civic Service Counter Journey Data (#843)
 *
 * Curated, reviewed counter sequences for a small set of services. This is a
 * demonstration dataset: the counters, office notes and document checkpoints
 * are illustrative and must be confirmed with the office before a visit.
 *
 * Invariants:
 * - A journey is a process order, never a live queue or token display.
 * - Every counter and checkpoint links to a source recorded in COUNTER_SOURCES.
 * - Effort bands are included only when a reviewed source supports them.
 * - No Aadhaar/PAN numbers, OTPs, passwords or document contents are stored;
 *   checkpoints only reference document *types* the citizen chooses to carry.
 */

export const COUNTER_JOURNEY_DATA_VERSION = '2026.11.18-r1';
export const COUNTER_JOURNEY_REVIEW_DATE = '2026-11-18';
export const COUNTER_JOURNEY_STALE_AFTER_DAYS = 365;

export const COUNTER_JOURNEY_DISCLAIMER =
  'Process order only. This simulator does not show a live queue, token number, waiting time or official application status.';

export const COUNTER_SOURCES = {
  'delhi-edistrict-revenue': {
    id: 'delhi-edistrict-revenue',
    title: 'Delhi eDistrict — Revenue Certificate Services',
    authority: 'Revenue Department, Government of NCT of Delhi',
    url: 'https://edistrict.delhigovt.nic.in',
    reviewedAt: '2026-10-30',
    official: true,
  },
  'delhi-rto-parivahan': {
    id: 'delhi-rto-parivahan',
    title: 'Parivahan Sewa — Driving Licence Services',
    authority: 'Ministry of Road Transport and Highways',
    url: 'https://parivahan.gov.in',
    reviewedAt: '2026-10-12',
    official: true,
  },
  'mea-passport-seva': {
    id: 'mea-passport-seva',
    title: 'Passport Seva — Application and Appointment Guidance',
    authority: 'Ministry of External Affairs',
    url: 'https://www.passportindia.gov.in',
    reviewedAt: '2026-10-18',
    official: true,
  },
  'office-reviewed-note': {
    id: 'office-reviewed-note',
    title: 'Reviewed office counter note (illustrative reviewer data)',
    authority: 'Civic Help Setu reviewer workspace',
    url: 'https://www.india.gov.in',
    reviewedAt: '2026-11-18',
    official: false,
  },
};

/**
 * Office references. The ids match the existing office directory so the
 * simulator stays consistent with Nearby Offices and the service catalogue.
 */
export const COUNTER_JOURNEY_OFFICES = {
  'delhi-south-collectorate': {
    id: 'delhi-south-collectorate',
    name: 'District Magistrate Office - South Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    officeType: 'Tehsil / Collectorate',
    sourceId: 'delhi-edistrict-revenue',
  },
  'delhi-rto-sarai-kale-khan': {
    id: 'delhi-rto-sarai-kale-khan',
    name: 'Regional Transport Office (RTO) - Sarai Kale Khan',
    city: 'New Delhi',
    state: 'Delhi',
    officeType: 'Regional Transport Office',
    sourceId: 'delhi-rto-parivahan',
  },
  'delhi-passport-herald-house': {
    id: 'delhi-passport-herald-house',
    name: 'Passport Seva Kendra - Herald House',
    city: 'New Delhi',
    state: 'Delhi',
    officeType: 'Passport Seva Kendra',
    sourceId: 'mea-passport-seva',
  },
};

/**
 * Document catalogue. `label` is what the citizen sees; the citizen only marks
 * that a document is available, never enters its number or contents.
 */
export const JOURNEY_DOCUMENTS = {
  aadhaar: {
    id: 'aadhaar',
    label: 'Aadhaar card (original for sighting)',
    category: 'Identity',
    sensitivity: 'identity-reference',
    note: 'Carry the card. Do not type the Aadhaar number into this simulator.',
    sourceId: 'delhi-edistrict-revenue',
  },
  'address-proof': {
    id: 'address-proof',
    label: 'Address proof',
    category: 'Address',
    sensitivity: 'standard',
    note: 'A recent utility bill, rent agreement or another proof accepted by the office.',
    sourceId: 'delhi-edistrict-revenue',
  },
  'passport-photo': {
    id: 'passport-photo',
    label: 'Passport-size photograph',
    category: 'Photograph',
    sensitivity: 'standard',
    note: 'Keep spare copies; the office may ask for one for the application form.',
    sourceId: 'delhi-edistrict-revenue',
  },
  'income-proof': {
    id: 'income-proof',
    label: 'Income proof (salary slips / employer certificate / ITR)',
    category: 'Income',
    sensitivity: 'financial',
    note: 'Carry the original proof. The simulator stores only whether you marked it available.',
    sourceId: 'delhi-edistrict-revenue',
  },
  'income-affidavit': {
    id: 'income-affidavit',
    label: 'Income affidavit (alternative route)',
    category: 'Income',
    sensitivity: 'financial',
    note: 'Some offices accept a sworn affidavit when formal income proof is unavailable.',
    sourceId: 'office-reviewed-note',
  },
  'ration-card': {
    id: 'ration-card',
    label: 'Ration card (family details)',
    category: 'Household',
    sensitivity: 'standard',
    note: 'May be requested for family composition; confirm with the counter.',
    sourceId: 'office-reviewed-note',
  },
  'application-reference': {
    id: 'application-reference',
    label: 'Online application reference / acknowledgement',
    category: 'Reference',
    sensitivity: 'standard',
    note: 'The reference number printed after submitting the online form, if the service requires one.',
    sourceId: 'delhi-edistrict-revenue',
  },
  'acknowledgement-slip': {
    id: 'acknowledgement-slip',
    label: 'Counter acknowledgement slip',
    category: 'Reference',
    sensitivity: 'standard',
    note: 'Issued by the counter. Keep it safe; it is not an official approval.',
    sourceId: 'office-reviewed-note',
  },
  'learner-licence': {
    id: 'learner-licence',
    label: "Learner's licence",
    category: 'Transport',
    sensitivity: 'standard',
    note: 'Must be valid on the day of the driving test.',
    sourceId: 'delhi-rto-parivahan',
  },
  'age-proof': {
    id: 'age-proof',
    label: 'Age proof (birth certificate / PAN / school certificate)',
    category: 'Identity',
    sensitivity: 'identity-reference',
    note: 'Any one accepted age proof; originals may be inspected.',
    sourceId: 'delhi-rto-parivahan',
  },
  'medical-form-1a': {
    id: 'medical-form-1a',
    label: 'Medical certificate (Form 1A)',
    category: 'Medical',
    sensitivity: 'health',
    note: 'Required for some vehicle classes. The office decides whether it applies to you.',
    sourceId: 'delhi-rto-parivahan',
  },
  'self-declaration': {
    id: 'self-declaration',
    label: 'Self-declaration of fitness',
    category: 'Medical',
    sensitivity: 'health',
    note: 'Some private-vehicle applications use a self-declaration instead of Form 1A.',
    sourceId: 'delhi-rto-parivahan',
  },
  'vehicle-rc': {
    id: 'vehicle-rc',
    label: 'Vehicle registration certificate (test vehicle)',
    category: 'Transport',
    sensitivity: 'standard',
    note: 'The test vehicle must match the class you are applying for.',
    sourceId: 'delhi-rto-parivahan',
  },
  'arn-slip': {
    id: 'arn-slip',
    label: 'Appointment / ARN slip',
    category: 'Reference',
    sensitivity: 'standard',
    note: 'Printed from the Passport Seva portal after booking the slot.',
    sourceId: 'mea-passport-seva',
  },
  'dob-proof': {
    id: 'dob-proof',
    label: 'Date-of-birth proof',
    category: 'Identity',
    sensitivity: 'identity-reference',
    note: 'Birth certificate, PAN or school certificate; the portal lists accepted proofs.',
    sourceId: 'mea-passport-seva',
  },
  'affidavit-address': {
    id: 'affidavit-address',
    label: 'Address affidavit (alternative route)',
    category: 'Address',
    sensitivity: 'standard',
    note: 'May be considered when the address proof does not match the application.',
    sourceId: 'office-reviewed-note',
  },
  'police-verification-form': {
    id: 'police-verification-form',
    label: 'Police verification acknowledgement',
    category: 'Reference',
    sensitivity: 'standard',
    note: 'Track the visit through official channels; the simulator does not schedule it.',
    sourceId: 'mea-passport-seva',
  },
};

const checkpoint = (id, documentId, requirement, extra = {}) => ({
  id,
  documentId,
  label: JOURNEY_DOCUMENTS[documentId].label,
  requirement,
  sourceIds: extra.sourceIds || [JOURNEY_DOCUMENTS[documentId].sourceId],
  ...extra,
});

export const COUNTER_JOURNEYS = [
  {
    id: 'income-certificate-delhi-south',
    serviceId: 'income-certificate',
    officeId: 'delhi-south-collectorate',
    title: 'Income Certificate — counter sequence',
    reviewedAt: COUNTER_JOURNEY_REVIEW_DATE,
    dataVersion: COUNTER_JOURNEY_DATA_VERSION,
    processNote:
      'The order below follows the reviewed Delhi eDistrict guidance. Offices may combine or reorder counters; confirm at the help desk.',
    sourceIds: ['delhi-edistrict-revenue', 'office-reviewed-note'],
    counters: [
      {
        id: 'help-desk',
        order: 1,
        title: 'Help desk and form issuance',
        purpose: 'Confirm the service, collect the application form and ask which counter handles verification.',
        guidance:
          'Reviewed guidance asks applicants to submit the application with identity and address proof. The help desk issues the form; it does not approve the certificate.',
        sourceIds: ['delhi-edistrict-revenue'],
        dependsOn: [],
        effortBand: null,
        checkpoints: [
          checkpoint('help-aadhaar', 'aadhaar', 'REQUIRED'),
          checkpoint('help-address', 'address-proof', 'REQUIRED'),
          checkpoint('help-photo', 'passport-photo', 'OPTIONAL'),
        ],
      },
      {
        id: 'verification',
        order: 2,
        title: 'Document verification counter',
        purpose: 'An officer checks identity, address and income evidence before the fee stage.',
        guidance:
          'Income proof is central to this service. If the usual proof is unavailable, ask the counter whether the reviewed affidavit route applies before paying any fee.',
        sourceIds: ['delhi-edistrict-revenue', 'office-reviewed-note'],
        dependsOn: ['help-desk'],
        effortBand: {
          band: 'MEDIUM',
          label: 'Medium process effort',
          basis:
            'Reviewed guidance separates document verification from certificate issuance. This is a process-complexity band, not a waiting-time estimate.',
          sourceIds: ['delhi-edistrict-revenue'],
        },
        checkpoints: [
          checkpoint('verify-aadhaar', 'aadhaar', 'REQUIRED'),
          checkpoint('verify-address', 'address-proof', 'REQUIRED'),
          checkpoint('verify-income', 'income-proof', 'REQUIRED', {
            missingBranch: {
              id: 'income-affidavit-desk',
              title: 'Affidavit desk (missing income proof)',
              purpose:
                'Ask the verification officer whether an income affidavit is accepted for your application before paying the fee.',
              guidance:
                'The reviewed office note lists an affidavit route as a possible alternative. It is not guaranteed; the officer decides.',
              requires: ['income-affidavit'],
              repeatVisit: true,
              sourceIds: ['office-reviewed-note'],
            },
          }),
          checkpoint('verify-ration', 'ration-card', 'CONDITIONAL', {
            condition: 'The application is for a household and the officer asks for family details.',
            conditionKey: 'householdDetailsRequired',
          }),
        ],
      },
      {
        id: 'fee-counter',
        order: 3,
        title: 'Fee and receipt counter',
        purpose: 'Pay the applicable fee and keep the receipt for the issuance counter.',
        guidance:
          'Fees and payment channels are set by the office. This simulator does not calculate a fee or show a payment status.',
        sourceIds: ['delhi-edistrict-revenue'],
        dependsOn: ['verification'],
        effortBand: null,
        checkpoints: [
          checkpoint('fee-reference', 'application-reference', 'CONDITIONAL', {
            condition: 'The office asked you to apply online first.',
            conditionKey: 'onlineReferenceRequired',
          }),
        ],
      },
      {
        id: 'issuance',
        order: 4,
        title: 'Certificate issuance counter',
        purpose: 'Show the fee receipt and counter acknowledgement, then follow the office collection process.',
        guidance:
          'The issuance counter works from the verified application. A counter acknowledgement is not an official approval and does not guarantee same-day issuance.',
        sourceIds: ['delhi-edistrict-revenue', 'office-reviewed-note'],
        dependsOn: ['verification', 'fee-counter'],
        effortBand: null,
        checkpoints: [
          checkpoint('issue-ack', 'acknowledgement-slip', 'REQUIRED', {
            sourceIds: ['office-reviewed-note'],
          }),
        ],
      },
    ],
  },
  {
    id: 'driving-licence-delhi-rto',
    serviceId: 'driving-license',
    officeId: 'delhi-rto-sarai-kale-khan',
    title: 'Driving Licence — counter sequence',
    reviewedAt: COUNTER_JOURNEY_REVIEW_DATE,
    dataVersion: COUNTER_JOURNEY_DATA_VERSION,
    processNote:
      'The sequence follows the reviewed Parivahan guidance for a permanent licence. Test slots and vehicle classes are handled by the RTO.',
    sourceIds: ['delhi-rto-parivahan', 'office-reviewed-note'],
    counters: [
      {
        id: 'learner-check',
        order: 1,
        title: 'Learner licence check',
        purpose: 'Verify that the learner licence is valid and the application class matches it.',
        guidance:
          'The learner licence must be valid when the permanent licence application is made. Keep age proof available for inspection.',
        sourceIds: ['delhi-rto-parivahan'],
        dependsOn: [],
        effortBand: null,
        checkpoints: [
          checkpoint('learner-check-doc', 'learner-licence', 'REQUIRED'),
          checkpoint('learner-age', 'age-proof', 'REQUIRED'),
          checkpoint('learner-aadhaar', 'aadhaar', 'REQUIRED'),
        ],
      },
      {
        id: 'medical-counter',
        order: 2,
        title: 'Medical / fitness counter',
        purpose: 'Submit the medical evidence that applies to the vehicle class, or the accepted self-declaration.',
        guidance:
          'Some classes require Form 1A. Ask the counter which route applies to you; this simulator does not decide medical fitness.',
        sourceIds: ['delhi-rto-parivahan'],
        dependsOn: ['learner-check'],
        effortBand: null,
        checkpoints: [
          checkpoint('medical-form', 'medical-form-1a', 'CONDITIONAL', {
            condition: 'The vehicle class requires a medical certificate.',
            conditionKey: 'medicalFormRequired',
            missingBranch: {
              id: 'medical-certificate-desk',
              title: 'Medical certificate desk (missing Form 1A)',
              purpose: 'Get the required medical certificate from an authorised doctor before the test.',
              guidance:
                'The RTO guidance requires Form 1A for the classes it lists. The simulator cannot guess whether it applies to you.',
              requires: ['medical-form-1a'],
              repeatVisit: true,
              sourceIds: ['delhi-rto-parivahan'],
            },
          }),
          checkpoint('medical-self', 'self-declaration', 'CONDITIONAL', {
            condition: 'The application is for a private vehicle and the counter accepts a self-declaration.',
            conditionKey: 'selfDeclarationAccepted',
          }),
        ],
      },
      {
        id: 'fee-slot',
        order: 3,
        title: 'Fee and slot counter',
        purpose: 'Pay the applicable fee and confirm the test slot recorded by the RTO.',
        guidance:
          'Slot availability is controlled by the RTO portal or counter. This simulator does not display live slots or waiting times.',
        sourceIds: ['delhi-rto-parivahan'],
        dependsOn: ['learner-check', 'medical-counter'],
        effortBand: null,
        checkpoints: [
          checkpoint('slot-reference', 'application-reference', 'REQUIRED'),
        ],
      },
      {
        id: 'driving-test',
        order: 4,
        title: 'Driving test track',
        purpose: 'Attend the driving test with a vehicle of the correct class.',
        guidance:
          'Bring the learner licence and the test vehicle documents. The RTO decides the test outcome; this simulator does not predict it.',
        sourceIds: ['delhi-rto-parivahan'],
        dependsOn: ['fee-slot'],
        effortBand: null,
        checkpoints: [
          checkpoint('test-rc', 'vehicle-rc', 'REQUIRED'),
          checkpoint('test-learner', 'learner-licence', 'REQUIRED'),
        ],
      },
      {
        id: 'licence-dispatch',
        order: 5,
        title: 'Licence dispatch / collection',
        purpose: 'Follow the RTO instruction for collecting the licence or tracking dispatch.',
        guidance:
          'Dispatch timelines are not shown here. Use the official RTO channel to check the status of the licence.',
        sourceIds: ['delhi-rto-parivahan'],
        dependsOn: ['driving-test'],
        effortBand: null,
        checkpoints: [
          checkpoint('dispatch-ack', 'acknowledgement-slip', 'REQUIRED', {
            sourceIds: ['office-reviewed-note'],
          }),
        ],
      },
    ],
  },
  {
    id: 'passport-delhi-psk',
    serviceId: 'passport',
    officeId: 'delhi-passport-herald-house',
    title: 'Passport — counter sequence',
    reviewedAt: COUNTER_JOURNEY_REVIEW_DATE,
    dataVersion: COUNTER_JOURNEY_DATA_VERSION,
    processNote:
      'The sequence follows the reviewed Passport Seva guidance for an appointment at a Passport Seva Kendra. Police verification is handled outside the counter board.',
    sourceIds: ['mea-passport-seva', 'office-reviewed-note'],
    counters: [
      {
        id: 'appointment-check',
        order: 1,
        title: 'Appointment and ARN verification',
        purpose: 'Confirm the appointment and the application reference number (ARN) at the entry desk.',
        guidance:
          'The appointment slip and ARN come from the Passport Seva portal. This simulator does not book, reschedule or show live appointment slots.',
        sourceIds: ['mea-passport-seva'],
        dependsOn: [],
        effortBand: null,
        checkpoints: [
          checkpoint('appointment-arn', 'arn-slip', 'REQUIRED'),
          checkpoint('appointment-aadhaar', 'aadhaar', 'REQUIRED'),
        ],
      },
      {
        id: 'document-verification',
        order: 2,
        title: 'Document verification counter',
        purpose: 'An officer checks identity, address and date-of-birth evidence.',
        guidance:
          'The portal lists the accepted proofs. If the address proof does not match the application, ask the officer about the reviewed affidavit route before leaving the counter.',
        sourceIds: ['mea-passport-seva', 'office-reviewed-note'],
        dependsOn: ['appointment-check'],
        effortBand: {
          band: 'MEDIUM',
          label: 'Medium process effort',
          basis:
            'Reviewed Passport Seva guidance separates verification from biometric enrolment. This is not a waiting-time estimate.',
          sourceIds: ['mea-passport-seva'],
        },
        checkpoints: [
          checkpoint('verify-address-proof', 'address-proof', 'REQUIRED', {
            missingBranch: {
              id: 'address-affidavit-desk',
              title: 'Address affidavit desk (mismatched address proof)',
              purpose: 'Ask the officer whether an address affidavit is accepted for this application.',
              guidance:
                'The reviewed office note lists an affidavit route as a possible alternative. It is not guaranteed.',
              requires: ['affidavit-address'],
              repeatVisit: true,
              sourceIds: ['office-reviewed-note'],
            },
          }),
          checkpoint('verify-dob', 'dob-proof', 'REQUIRED'),
          checkpoint('verify-photo', 'passport-photo', 'OPTIONAL'),
        ],
      },
      {
        id: 'biometrics',
        order: 3,
        title: 'Biometric enrolment',
        purpose: 'Provide photographs and biometrics as directed by the Passport Seva Kendra staff.',
        guidance:
          'The PSK captures biometrics on site. The simulator does not store biometric data and has no live counter status.',
        sourceIds: ['mea-passport-seva'],
        dependsOn: ['document-verification'],
        effortBand: null,
        checkpoints: [],
      },
      {
        id: 'police-verification',
        order: 4,
        title: 'Police verification scheduling',
        purpose: 'Follow the instruction for police verification, if the application requires it.',
        guidance:
          'Police verification is scheduled by the authorities. This simulator does not show a police visit time or guarantee an outcome.',
        sourceIds: ['mea-passport-seva'],
        dependsOn: ['biometrics'],
        effortBand: null,
        checkpoints: [
          checkpoint('police-form', 'police-verification-form', 'OPTIONAL'),
        ],
      },
      {
        id: 'passport-dispatch',
        order: 5,
        title: 'Dispatch / collection',
        purpose: 'Track dispatch through the official Passport Seva channel.',
        guidance:
          'Dispatch and delivery timelines are not reproduced here. Use the official portal for status.',
        sourceIds: ['mea-passport-seva'],
        dependsOn: ['police-verification'],
        effortBand: null,
        checkpoints: [],
      },
    ],
  },
];

export const getCounterJourneyById = (journeyId) =>
  COUNTER_JOURNEYS.find((journey) => journey.id === journeyId) || null;

export const getCounterJourneysForService = (serviceId) =>
  COUNTER_JOURNEYS.filter((journey) => journey.serviceId === serviceId);

export const getCounterSource = (sourceId) => COUNTER_SOURCES[sourceId] || null;

export const getCounterDocument = (documentId) => JOURNEY_DOCUMENTS[documentId] || null;

export const getJourneyOffice = (officeId) => COUNTER_JOURNEY_OFFICES[officeId] || null;

export default COUNTER_JOURNEYS;
