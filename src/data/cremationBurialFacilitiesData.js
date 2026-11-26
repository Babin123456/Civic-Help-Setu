/**
 * @file cremationBurialFacilitiesData.js
 * @description Verified directory of municipal electric crematoria, gas crematoria, traditional grounds,
 * and burial grounds with published statutory fee schedules, operating timings, and required bereavement documentation.
 */

export const MUNICIPAL_CREMATION_FACILITIES = [
  {
    id: 'fac_ka_blr_harishchandra_ghat',
    jurisdictionId: 'IN-KA-BLR',
    city: 'Bengaluru',
    facilityName: 'Harishchandra Ghat Electric Crematorium',
    facilityType: 'ELECTRIC_CREMATORIUM',
    address: 'Near Malleshwaram 18th Cross, Bengaluru, Karnataka 560003',
    contactNumber: '080-23371900',
    administeringAuthority: 'Bruhat Bengaluru Mahanagara Palike (BBMP) Health Wing',
    operatingTimings: '08:00 AM - 08:00 PM (Emergency slots 24x7 with medical officer approval)',
    publishedFeeINR: 250, // Standard nominal municipal user charge (free for BPL cardholders)
    isBplFree: true,
    accessibility: {
      stepFreeHearseAccess: true,
      wheelchairRampsAvailable: true,
      coveredWaitingHall: true
    },
    onlineBookingPortalUrl: 'https://bbmp.gov.in/crematorium-booking',
    lastVerifiedDate: '2026-03-01'
  },
  {
    id: 'fac_dl_nigambodh_ghat',
    jurisdictionId: 'IN-DL-MCD',
    city: 'Delhi',
    facilityName: 'Nigambodh Ghat Cremation Grounds',
    facilityType: 'HYBRID_CNG_WOOD',
    address: 'Ring Road, Kashmere Gate, New Delhi 110006',
    contactNumber: '011-23860074',
    administeringAuthority: 'Municipal Corporation of Delhi (MCD)',
    operatingTimings: '07:00 AM - 10:00 PM',
    publishedFeeINR: 500, // CNG furnace rate; wood stacks charged at regulated forest depot rate
    isBplFree: true,
    accessibility: {
      stepFreeHearseAccess: true,
      wheelchairRampsAvailable: true,
      coveredWaitingHall: true
    },
    onlineBookingPortalUrl: 'https://mcdonline.nic.in/cremation',
    lastVerifiedDate: '2026-02-28'
  }
];

export const MANDATORY_BEREAVEMENT_DOCUMENTS = [
  {
    documentName: 'Medical Certificate of Cause of Death (MCCD - Form 4 / 4A)',
    issuingAuthority: 'Hospital treating physician or registered MBBS medical practitioner',
    importance: 'Mandatory before any crematorium or burial ground permits entry.'
  },
  {
    documentName: 'Police No Objection Certificate (NOC) / Panchnama',
    issuingAuthority: 'Local Police Station (Jurisdictional SHO)',
    importance: 'Mandatory ONLY in cases of unnatural death, accident, poisoning, suicide, or post-mortem cases.'
  },
  {
    documentName: 'Identity Proof of Deceased & Informant/Next of Kin',
    issuingAuthority: 'Government (Aadhaar, Voter ID, or Passport)',
    importance: 'Required to enter details in the municipal cremation register for subsequent Death Certificate issuance.'
  }
];
