/**
 * @file rtiStatutoryTimelineData.js
 * @description Statutory timeline rules, limitation periods, sections of the Right to Information Act, 2005,
 * and procedural next steps for delayed responses, transfer notices, and rejected RTI applications.
 */

export const RTI_STATUTORY_RULES = {
  STANDARD_PIO_RESPONSE_DAYS: 30, // Section 7(1)
  LIFE_AND_LIBERTY_PIO_HOURS: 48, // Section 7(1) proviso
  TRANSFER_UNDER_SECTION_6_3_DAYS: 5, // Section 6(3) transfer deadline
  FIRST_APPEAL_LIMITATION_DAYS: 30, // Section 19(1) - 30 days from expiry of PIO deadline or receipt of decision
  FIRST_APPEAL_CONDONATION_DAYS: 30, // Section 19(1) proviso - discretionary condonation of delay
  FIRST_APPEAL_DISPOSAL_DAYS: 30, // Section 19(6) standard disposal
  FIRST_APPEAL_DISPOSAL_EXTENDED_DAYS: 45 // Section 19(6) with recorded reasons
};

export const RTI_EVENT_TYPES = {
  APPLICATION_FILED: 'APPLICATION_FILED',
  APPLICATION_TRANSFERRED: 'APPLICATION_TRANSFERRED',
  INCOMPLETE_OR_UNSATISFACTORY_RESPONSE_RECEIVED: 'INCOMPLETE_OR_UNSATISFACTORY_RESPONSE_RECEIVED',
  EXORBITANT_FEE_DEMANDED: 'EXORBITANT_FEE_DEMANDED',
  REJECTION_NOTICE_RECEIVED: 'REJECTION_NOTICE_RECEIVED',
  NO_RESPONSE_DEEMED_REFUSAL: 'NO_RESPONSE_DEEMED_REFUSAL'
};

export const RTI_STATUTORY_CITATIONS = [
  {
    section: 'Section 7(1)',
    act: 'Right to Information Act, 2005',
    title: 'Disposal of Request',
    summary: 'The Central Public Information Officer or State Public Information Officer shall, as expeditiously as possible, and in any case within thirty days of the receipt of the request, either provide the information on payment of such fee as may be prescribed or reject the request for any of the reasons specified in sections 8 and 9.'
  },
  {
    section: 'Section 6(3)',
    act: 'Right to Information Act, 2005',
    title: 'Transfer to another Public Authority',
    summary: 'Where an application is made to a public authority requesting information held by another public authority, the application shall be transferred within five days from the date of receipt of the application, and the applicant informed immediately.'
  },
  {
    section: 'Section 7(2)',
    act: 'Right to Information Act, 2005',
    title: 'Deemed Refusal',
    summary: 'If the Public Information Officer fails to give a decision on the request for information within thirty days, the PIO shall be deemed to have refused the request.'
  },
  {
    section: 'Section 19(1)',
    act: 'Right to Information Act, 2005',
    title: 'First Appeal to FAA',
    summary: 'Any person who does not receive a decision within thirty days or is aggrieved by a decision of the PIO may within thirty days from the expiry of such period or from the receipt of such a decision prefer an appeal to the First Appellate Authority (FAA).'
  }
];
