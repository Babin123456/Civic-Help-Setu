/**
 * @file childProtectionOfficialData.js
 * @description Official Indian child protection statutory authorities (Child Welfare Committees - CWC,
 * District Child Protection Units - DCPU, Special Juvenile Police Units - SJPU, and 1098 / 112 emergency helplines).
 * Strictly forbids creating a public missing-child posting board or collecting children's personal/photo details.
 */

export const NATIONAL_CHILD_PROTECTION_FRAMEWORK = {
  CHILDLINE_EMERGENCY: {
    helplineNumber: '1098', // National emergency toll-free 24/7 service (now integrated with 112 under Mission Vatsalya)
    unifiedEmergencyNumber: '112',
    administeringMinistry: 'Ministry of Women and Child Development (MWCD), Govt. of India',
    portalUrl: 'https://trackchild.gov.in',
    khoyaPayaPortalUrl: 'https://khoyapaya.gov.in',
    governingAct: 'Juvenile Justice (Care and Protection of Children) Act, 2015 & POCSO Act, 2012'
  },
  LEGAL_MANDATE_SECTION_74: {
    rule: 'Section 74 of the Juvenile Justice Act, 2015 strictly prohibits the disclosure of identity, photograph, name, address, or school of any child in conflict with law or child in need of care and protection in any public media or web platform.',
    penalty: 'Punishable with imprisonment up to six months or fine or both.'
  }
};

export const STATUTORY_DISTRICT_AUTHORITIES = [
  {
    jurisdictionId: 'IN-KA-BLR',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    cwc: {
      name: 'Child Welfare Committee (CWC-1 & CWC-2) Bengaluru Urban',
      officeAddress: 'Government Girls Children Home Campus, Dr. M.H. Marigowda Road, Near Dairy Circle, Bengaluru 560029',
      contactPhone: '080-26560000',
      email: 'cwc-bengaluruurban@karnataka.gov.in',
      statutoryRole: 'Bench of Magistrates with judicial powers regarding care, protection, and rehabilitation of children.'
    },
    dcpu: {
      name: 'District Child Protection Unit (DCPU) Bengaluru',
      nodalOfficer: 'District Child Protection Officer (DCPO)',
      officeAddress: 'Department of Women & Child Development, M.S. Building, Bengaluru',
      contactPhone: '080-22355555'
    },
    policeSpecialUnit: 'Special Juvenile Police Unit (SJPU) - Commission of Police Office, Infantary Road'
  },
  {
    jurisdictionId: 'IN-DL-CENTRAL',
    state: 'Delhi (NCT)',
    district: 'Central Delhi',
    cwc: {
      name: 'Child Welfare Committee (CWC-V) Central Delhi',
      officeAddress: 'Kasturba Niketan Complex, Lajpat Nagar-II, New Delhi 110024',
      contactPhone: '011-29831000',
      email: 'cwc5-delhi@nic.in',
      statutoryRole: 'Autonomous district magistrate committee under Juvenile Justice Act.'
    },
    dcpu: {
      name: 'District Child Protection Unit (DCPU) Central',
      nodalOfficer: 'District Child Protection Officer',
      officeAddress: '1, Canning Lane, K.G. Marg, New Delhi 110001',
      contactPhone: '011-23381111'
    },
    policeSpecialUnit: 'Delhi Police Missing Persons Squad (Crime Branch) - Kotwali, Daryaganj'
  }
];
