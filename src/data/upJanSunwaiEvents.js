/**
 * Pilot seed records for the Uttar Pradesh Public Hearing and Jan Sunwai
 * preparation and follow-up workspace (#1002).
 *
 * Each record must carry a responsible authority, a dated official source,
 * a venue, eligibility information, and registration instructions. Records that
 * fail the contract are never shown as official appointments.
 *
 * The dates below are pilot fixtures. An editor must re-open the cited official
 * source and update `lastVerifiedDate` before relying on a listing. If an
 * authority changes or withdraws a notice, use the source-correction workflow
 * rather than silently editing a record.
 */

import {
  ISSUE_CATEGORIES,
  UP_HEARING_EVENT_TYPES,
  VERIFICATION_STATUS,
} from './upJanSunwaiContract.js';

const REVENUE = ISSUE_CATEGORIES.REVENUE_LAND.id;
const RATION = ISSUE_CATEGORIES.RATION_PDS.id;
const SANITATION = ISSUE_CATEGORIES.MUNICIPAL_SANITATION.id;
const WATER = ISSUE_CATEGORIES.WATER_SUPPLY.id;
const ROADS = ISSUE_CATEGORIES.ROADS_TRANSPORT.id;
const ELECTRICITY = ISSUE_CATEGORIES.ELECTRICITY.id;
const PENSION = ISSUE_CATEGORIES.PENSION_WELFARE.id;
const CERTIFICATES = ISSUE_CATEGORIES.CERTIFICATES.id;
const OTHER = ISSUE_CATEGORIES.OTHER.id;

export const UP_JAN_SUNWAI_EVENTS = Object.freeze([
  {
    id: 'up-js-2026-12-08-lucknow',
    title: 'District Jan Sunwai — Lucknow',
    eventType: UP_HEARING_EVENT_TYPES.JAN_SUNWAI,
    authority: 'District Administration Lucknow',
    department: 'Collectorate, Lucknow',
    jurisdiction: {
      state: 'Uttar Pradesh',
      district: 'Lucknow',
      tehsil: 'Lucknow Sadar',
      localBody: 'Lucknow Nagar Nigam',
    },
    eventDate: '2026-12-08',
    startTime: '10:30',
    endTime: '14:00',
    venue: {
      name: 'Collectorate Auditorium, Lucknow',
      address: 'Kaiserbagh, Lucknow, Uttar Pradesh 226001',
      mode: 'IN_PERSON',
      onlineUrl: null,
    },
    eligibility: [
      'Residents of Lucknow district with a pending public grievance',
      'The published notice does not require an online appointment',
      'Carry a government photo ID for entry and verification',
    ],
    registration: {
      required: false,
      deadline: null,
      instructions:
        'Walk-in registration at the Collectorate Jan Sunwai desk from 09:30. Confirm the current desk location at the enquiry counter before joining the queue.',
      registrationUrl: null,
      fee: 'No fee is stated in the published notice.',
    },
    issueCategories: [REVENUE, RATION, WATER, SANITATION, ROADS, ELECTRICITY, PENSION, CERTIFICATES, OTHER],
    requiredDocuments: [
      'Printed copy of the official notice, or a screenshot showing its source URL',
      'Government photo ID (original for verification, plus one self-attested copy)',
      'A dated chronology of the matter and any prior complaint references you already hold',
      'Copies of documents that directly support the requested remedy',
    ],
    officialSource: {
      name: 'District Administration Lucknow — public notices',
      url: 'https://lucknow.nic.in/',
      publishedDate: '2026-11-17',
      sourceType: 'DISTRICT_PORTAL',
    },
    lastVerifiedDate: '2026-11-18',
    verificationStatus: VERIFICATION_STATUS.VERIFIED,
    verificationNote:
      'Pilot fixture: date, venue, eligibility, and walk-in instructions checked against the district portal notice. Re-check before travel; the authority may publish a corrigendum.',
    pilotFixture: true,
  },
  {
    id: 'up-js-2026-12-15-varanasi',
    title: 'Tehsil Diwas Public Hearing — Varanasi Sadar',
    eventType: UP_HEARING_EVENT_TYPES.TEHSIL_DIWAS,
    authority: 'Tehsil Sadar, Varanasi',
    department: 'Revenue Department, Uttar Pradesh',
    jurisdiction: {
      state: 'Uttar Pradesh',
      district: 'Varanasi',
      tehsil: 'Varanasi Sadar',
      localBody: null,
    },
    eventDate: '2026-12-15',
    startTime: '11:00',
    endTime: '15:00',
    venue: {
      name: 'Tehsil Sadar Meeting Hall, Varanasi',
      address: 'Kachehri Compound, Varanasi, Uttar Pradesh 221002',
      mode: 'IN_PERSON',
      onlineUrl: null,
    },
    eligibility: [
      'Residents of Tehsil Sadar (Varanasi) having unresolved revenue, demarcation, mutation, or civic complaints',
      'Open to all residents of the tehsil jurisdiction',
      'Identity verification required at token counter',
    ],
    registration: {
      required: false,
      deadline: null,
      instructions:
        'Token distribution begins at 10:00 AM at Counter 2. Submissions taken in order of arrival before the Sub-Divisional Magistrate.',
      registrationUrl: null,
      fee: 'No fee.',
    },
    issueCategories: [REVENUE, RATION, CERTIFICATES, OTHER],
    requiredDocuments: [
      'Government photo ID (Voter ID, Aadhaar, or Driving Licence)',
      'Photocopy of relevant land khatauni extract or mutation receipt',
      'Self-attested written submission outlining specific remedy sought',
    ],
    officialSource: {
      name: 'Varanasi District Portal — Tehsil Diwas Calendar',
      url: 'https://varanasi.nic.in/',
      publishedDate: '2026-11-15',
      sourceType: 'DISTRICT_PORTAL',
    },
    lastVerifiedDate: '2026-11-18',
    verificationStatus: VERIFICATION_STATUS.VERIFIED,
    verificationNote:
      'Verified against Varanasi district revenue circular. Timings confirmed for 3rd Tuesday hearing.',
    pilotFixture: true,
  },
  {
    id: 'up-js-2026-12-12-gorakhpur',
    title: 'Gorakhpur District Public Hearing — Jan Sunwai Diwas',
    eventType: UP_HEARING_EVENT_TYPES.JAN_SUNWAI,
    authority: 'District Magistrate Office, Gorakhpur',
    department: 'Collectorate, Gorakhpur',
    jurisdiction: {
      state: 'Uttar Pradesh',
      district: 'Gorakhpur',
      tehsil: 'Gorakhpur Sadar',
      localBody: 'Gorakhpur Municipal Corporation',
    },
    eventDate: '2026-12-12',
    startTime: '10:00',
    endTime: '13:30',
    venue: {
      name: 'Collectorate Jan Sunwai Bhavan',
      address: 'Civil Lines, Gorakhpur, Uttar Pradesh 273001',
      mode: 'IN_PERSON',
      onlineUrl: null,
    },
    eligibility: [
      'All residents of Gorakhpur district seeking grievance redressal',
      'Individual citizens or authorized community representatives',
    ],
    registration: {
      required: false,
      deadline: null,
      instructions:
        'Walk-in registration opens at 09:30 AM at the gate reception. Receipts stamped with entry serial number.',
      registrationUrl: null,
      fee: 'Free of charge.',
    },
    issueCategories: [REVENUE, RATION, WATER, SANITATION, ROADS, ELECTRICITY, PENSION, OTHER],
    requiredDocuments: [
      'Original ID proof and 2 self-attested photocopies',
      'Chronology of previous applications with departmental acknowledgement numbers',
      'Two sets of application letters addressed to DM Gorakhpur',
    ],
    officialSource: {
      name: 'Gorakhpur Collectorate Public Notice',
      url: 'https://gorakhpur.nic.in/',
      publishedDate: '2026-11-14',
      sourceType: 'DISTRICT_PORTAL',
    },
    lastVerifiedDate: '2026-11-17',
    verificationStatus: VERIFICATION_STATUS.VERIFIED,
    verificationNote: 'Confirmed with published monthly calendar.',
    pilotFixture: true,
  },
  {
    id: 'up-js-2026-12-20-prayagraj',
    title: 'Prayagraj Collectorate Jan Sunwai & Tehsil Day',
    eventType: UP_HEARING_EVENT_TYPES.JAN_SUNWAI,
    authority: 'District Administration Prayagraj',
    department: 'Revenue & Public Grievance Cell, Prayagraj',
    jurisdiction: {
      state: 'Uttar Pradesh',
      district: 'Prayagraj',
      tehsil: 'Sadar',
      localBody: 'Prayagraj Nagar Nigam',
    },
    eventDate: '2026-12-20',
    startTime: '10:00',
    endTime: '14:00',
    venue: {
      name: 'Sangam Sabhagar, Collectorate',
      address: 'Kutchery Road, Prayagraj, Uttar Pradesh 211002',
      mode: 'IN_PERSON',
      onlineUrl: null,
    },
    eligibility: [
      'Prayagraj district residents with pending administrative matters',
      'Citizens holding prior Jan Sunwai / IGRS portal grievance registration references',
    ],
    registration: {
      required: false,
      deadline: null,
      instructions: 'Citizens report directly to the Helpdesk at Sangam Sabhagar from 09:30 AM.',
      registrationUrl: null,
      fee: 'Free of charge.',
    },
    issueCategories: [REVENUE, WATER, SANITATION, ROADS, ELECTRICITY, PENSION, CERTIFICATES, OTHER],
    requiredDocuments: [
      'Prior IGRS / Jan Sunwai complaint number slip if previously filed',
      'Valid identity proof (Aadhaar/EPIC/PAN)',
      'Supporting documents in duplicate',
    ],
    officialSource: {
      name: 'District Administration Prayagraj Notices',
      url: 'https://prayagraj.nic.in/',
      publishedDate: '2026-11-16',
      sourceType: 'DISTRICT_PORTAL',
    },
    lastVerifiedDate: '2026-11-18',
    verificationStatus: VERIFICATION_STATUS.VERIFIED,
    verificationNote: 'Verified via Prayagraj district portal circular.',
    pilotFixture: true,
  },
  {
    id: 'up-js-2026-12-22-kanpur',
    title: 'Municipal & Tehsil Samadhan Diwas — Kanpur Nagar',
    eventType: UP_HEARING_EVENT_TYPES.TEHSIL_DIWAS,
    authority: 'Tehsil Kanpur Sadar',
    department: 'Revenue & Nagar Nigam Kanpur',
    jurisdiction: {
      state: 'Uttar Pradesh',
      district: 'Kanpur Nagar',
      tehsil: 'Kanpur Sadar',
      localBody: 'Kanpur Municipal Corporation',
    },
    eventDate: '2026-12-22',
    startTime: '10:30',
    endTime: '14:30',
    venue: {
      name: 'Tehsil Auditorium, Kanpur Sadar',
      address: 'VIP Road, Civil Lines, Kanpur, Uttar Pradesh 208001',
      mode: 'IN_PERSON',
      onlineUrl: null,
    },
    eligibility: [
      'Residents of Kanpur Nagar district',
      'Matters concerning municipal services, civic amenities, or land records',
    ],
    registration: {
      required: false,
      deadline: null,
      instructions: 'Register at the reception counter between 09:45 and 11:30 AM.',
      registrationUrl: null,
      fee: 'None.',
    },
    issueCategories: [REVENUE, RATION, SANITATION, WATER, ROADS, ELECTRICITY, OTHER],
    requiredDocuments: [
      'ID proof',
      'Municipal tax receipt or water bill if related to civic utilities',
      'Written submission with explicit requested relief',
    ],
    officialSource: {
      name: 'Kanpur Nagar Official District Notices',
      url: 'https://kanpurnagar.nic.in/',
      publishedDate: '2026-11-15',
      sourceType: 'DISTRICT_PORTAL',
    },
    lastVerifiedDate: '2026-11-18',
    verificationStatus: VERIFICATION_STATUS.VERIFIED,
    verificationNote: 'Official notification checked on Kanpur Nagar NIC portal.',
    pilotFixture: true,
  },
  {
    id: 'up-js-2026-10-15-lucknow-expired',
    title: 'Past District Jan Sunwai — Lucknow (October 2026)',
    eventType: UP_HEARING_EVENT_TYPES.JAN_SUNWAI,
    authority: 'District Administration Lucknow',
    department: 'Collectorate, Lucknow',
    jurisdiction: {
      state: 'Uttar Pradesh',
      district: 'Lucknow',
      tehsil: 'Lucknow Sadar',
      localBody: 'Lucknow Nagar Nigam',
    },
    eventDate: '2026-10-15',
    startTime: '10:30',
    endTime: '14:00',
    venue: {
      name: 'Collectorate Auditorium, Lucknow',
      address: 'Kaiserbagh, Lucknow, Uttar Pradesh 226001',
      mode: 'IN_PERSON',
      onlineUrl: null,
    },
    eligibility: ['Past pilot record for archive verification'],
    registration: {
      required: false,
      deadline: null,
      instructions: 'Past event completed.',
      registrationUrl: null,
      fee: 'None',
    },
    issueCategories: [REVENUE, OTHER],
    requiredDocuments: ['Historical record'],
    officialSource: {
      name: 'District Administration Lucknow archive',
      url: 'https://lucknow.nic.in/',
      publishedDate: '2026-10-01',
      sourceType: 'DISTRICT_PORTAL',
    },
    lastVerifiedDate: '2026-10-10',
    verificationStatus: VERIFICATION_STATUS.VERIFIED,
    verificationNote: 'Past fixture for verifying archive expiry query.',
    pilotFixture: true,
  },
]);

export const UP_UNVERIFIED_EVENT_SUBMISSIONS = Object.freeze([
  {
    id: 'up-js-community-unverified-1',
    title: 'Unofficial Community Notice — Forwarded Jan Sunwai',
    eventType: UP_HEARING_EVENT_TYPES.PUBLIC_HEARING,
    authority: 'Unconfirmed Local Committee',
    department: 'Unknown',
    jurisdiction: {
      state: 'Uttar Pradesh',
      district: 'Lucknow',
      tehsil: 'Lucknow Sadar',
      localBody: null,
    },
    eventDate: '2026-12-25',
    startTime: '10:00',
    endTime: '12:00',
    venue: {
      name: 'Community Ground',
      address: 'Near Market, Lucknow',
      mode: 'IN_PERSON',
      onlineUrl: null,
    },
    eligibility: ['Unverified claim'],
    registration: {
      required: false,
      deadline: null,
      instructions: 'Gather at venue.',
      registrationUrl: null,
      fee: 'None',
    },
    issueCategories: [OTHER],
    requiredDocuments: ['None specified'],
    officialSource: {
      name: 'WhatsApp Forward',
      url: 'https://social.example.org/forwarded-notice',
      publishedDate: '2026-11-18',
      sourceType: 'COMMUNITY_REPORT',
    },
    lastVerifiedDate: null,
    verificationStatus: VERIFICATION_STATUS.PENDING_VERIFICATION,
    verificationNote: 'Unverified community report — not an official appointment.',
    pilotFixture: true,
  },
]);
