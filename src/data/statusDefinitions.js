export const STATUS_CATEGORIES = {
  REQUIREMENT: 'requirement',
  INTAKE_WINDOW: 'intakeWindow',
  APPLICATION: 'application',
  FEE: 'fee',
  ELIGIBILITY: 'eligibility',
};

export const STATUS_DEFINITIONS = {
  [STATUS_CATEGORIES.REQUIREMENT]: {
    required: {
      label: 'Official requirement',
      shortLabel: 'Required',
      description: 'This document is officially required for this service. You must provide it to complete your application.',
      whatItDoesNotMean: 'This does not guarantee approval of your application. Other eligibility criteria may apply.',
      nextSteps: 'Gather this document from the issuing authority. Ensure it is current and matches the specifications exactly.',
      category: STATUS_CATEGORIES.REQUIREMENT,
      platformStatus: true,
    },
    conditional: {
      label: 'Conditional requirement',
      shortLabel: 'Conditional',
      description: 'This document is required only when a specific condition applies to your situation. The condition will be stated alongside the document.',
      whatItDoesNotMean: 'This is not required for everyone. Do not obtain it unless the stated condition applies to you.',
      nextSteps: 'Check the condition carefully. If it applies to you, obtain the document. If not, you do not need it.',
      category: STATUS_CATEGORIES.REQUIREMENT,
      platformStatus: true,
    },
    optional: {
      label: 'Optional suggestion',
      shortLabel: 'Optional',
      description: 'This document is a helpful suggestion that may strengthen your application or speed up processing. It is not mandatory.',
      whatItDoesNotMean: 'You will not be rejected for not providing this document. It is not a requirement.',
      nextSteps: 'Consider providing it if easily available. Otherwise, you can proceed without it.',
      category: STATUS_CATEGORIES.REQUIREMENT,
      platformStatus: true,
    },
    unverified: {
      label: 'Not verified',
      shortLabel: 'Unverified',
      description: 'Our records do not confirm whether this document is required, optional, or conditional. This is a platform limitation, not a government determination.',
      whatItDoesNotMean: 'This does not mean the document is not required. It means Civic Help Setu does not have verified information about it.',
      nextSteps: 'Check the official government portal or contact the relevant department directly to confirm if this document is needed.',
      category: STATUS_CATEGORIES.REQUIREMENT,
      platformStatus: true,
    },
  },
  [STATUS_CATEGORIES.INTAKE_WINDOW]: {
    open: {
      label: 'Open',
      shortLabel: 'Open',
      description: 'Applications are currently being accepted for this intake round.',
      whatItDoesNotMean: 'This does not guarantee your application will be approved. It only means the window for submitting applications is open.',
      nextSteps: 'Prepare your documents and submit your application before the window closes.',
      category: STATUS_CATEGORIES.INTAKE_WINDOW,
      platformStatus: true,
    },
    upcoming: {
      label: 'Upcoming',
      shortLabel: 'Upcoming',
      description: 'This intake round has not started yet. The opening date is shown.',
      whatItDoesNotMean: 'You cannot apply before the opening date. This is not a pre-registration.',
      nextSteps: 'Note the opening date. Prepare your documents in advance so you can apply as soon as the window opens.',
      category: STATUS_CATEGORIES.INTAKE_WINDOW,
      platformStatus: true,
    },
    closed: {
      label: 'Closed',
      shortLabel: 'Closed',
      description: 'The application intake window for this round has ended. No new applications are being accepted.',
      whatItDoesNotMean: 'This does not mean the service is permanently unavailable. Another round may be announced later.',
      nextSteps: 'Check for future intake rounds. Monitor official notifications for the next application window.',
      category: STATUS_CATEGORIES.INTAKE_WINDOW,
      platformStatus: true,
    },
    unpublished: {
      label: 'Window not published',
      shortLabel: 'Not published',
      description: 'The official intake window dates have not been published by the government. Civic Help Setu has no verified schedule.',
      whatItDoesNotMean: 'This does not mean applications are closed. It means the schedule is not publicly available in our records.',
      nextSteps: 'Check the official department portal or the notice link (if provided) for the latest schedule.',
      category: STATUS_CATEGORIES.INTAKE_WINDOW,
      platformStatus: true,
    },
    'not confirmed': {
      label: 'Not confirmed',
      shortLabel: 'Not confirmed',
      description: 'The intake window is listed as open, but the information has not been recently verified by Civic Help Setu. The review date is missing or outdated.',
      whatItDoesNotMean: 'This is not an official government status. It reflects the freshness of Civic Help Setu\'s data only.',
      nextSteps: 'Verify the current status on the official government portal before making plans to apply.',
      category: STATUS_CATEGORIES.INTAKE_WINDOW,
      platformStatus: true,
    },
  },
  [STATUS_CATEGORIES.APPLICATION]: {
    submitted: {
      label: 'Submitted',
      shortLabel: 'Submitted',
      description: 'Your application has been received and is awaiting initial processing.',
      whatItDoesNotMean: 'This is a platform status tracking your application in Civic Help Setu. It is not an official government decision.',
      nextSteps: 'Wait for the department to begin review. Keep your reference ID safe for tracking.',
      category: STATUS_CATEGORIES.APPLICATION,
      platformStatus: true,
    },
    'in-progress': {
      label: 'In Progress',
      shortLabel: 'In Progress',
      description: 'Your application is actively being reviewed or processed by the department.',
      whatItDoesNotMean: 'This does not mean approval is imminent or guaranteed. Processing times vary.',
      nextSteps: 'Monitor for updates. Be prepared to respond if additional documents or information are requested.',
      category: STATUS_CATEGORIES.APPLICATION,
      platformStatus: true,
    },
    'action-required': {
      label: 'Action Required',
      shortLabel: 'Action Required',
      description: 'The department needs you to take a specific action (e.g., provide additional documents, attend verification, pay fees).',
      whatItDoesNotMean: 'This does not mean your application is rejected. It means a step is needed from you to continue.',
      nextSteps: 'Check the details of what is required. Complete the action promptly to avoid delays or closure of your application.',
      category: STATUS_CATEGORIES.APPLICATION,
      platformStatus: true,
    },
    completed: {
      label: 'Completed',
      shortLabel: 'Completed',
      description: 'The application process is complete. The final outcome (approval, rejection, certificate issued) should be available.',
      whatItDoesNotMean: 'This reflects the platform\'s tracking of your application stages. Confirm the official outcome with the department.',
      nextSteps: 'Collect your certificate, document, or decision letter. If rejected, review the reasons and consider appeal options.',
      category: STATUS_CATEGORIES.APPLICATION,
      platformStatus: true,
    },
  },
  [STATUS_CATEGORIES.FEE]: {
    published: {
      label: 'Published fee schedule',
      shortLabel: 'Published',
      description: 'The fee information comes from an official government gazette or notification that Civic Help Setu has on record.',
      whatItDoesNotMean: 'Fees may have changed since publication. Always confirm the current amount before paying.',
      nextSteps: 'Verify the exact amount on the official portal at the time of payment. Check for any applicable concessions.',
      category: STATUS_CATEGORIES.FEE,
      platformStatus: true,
    },
    free: {
      label: 'Free service',
      shortLabel: 'Free',
      description: 'This service has no government fee. It is free of charge as per official policy.',
      whatItDoesNotMean: 'This does not mean there are no costs at all (e.g., travel, document preparation, photography). It means no government fee.',
      nextSteps: 'Do not pay any agent or intermediary who claims a fee is required. Report any demands for payment.',
      category: STATUS_CATEGORIES.FEE,
      platformStatus: true,
    },
    unverified: {
      label: 'Unverified fee notice',
      shortLabel: 'Unverified',
      description: 'Civic Help Setu does not have a verified official fee schedule for this service. Any amounts shown are not confirmed.',
      whatItDoesNotMean: 'This does not mean the service is free. It means we cannot confirm the official fee from our records.',
      nextSteps: 'Check the official department portal or visit the office directly to confirm the current fee before making any payment.',
      category: STATUS_CATEGORIES.FEE,
      platformStatus: true,
    },
  },
  [STATUS_CATEGORIES.ELIGIBILITY]: {
    eligible: {
      label: 'Eligible',
      shortLabel: 'Eligible',
      description: 'Based on the information you provided, you appear to meet the eligibility criteria for this service.',
      whatItDoesNotMean: 'This is an automated assessment by Civic Help Setu, not an official government determination. Final eligibility is decided by the department.',
      nextSteps: 'Proceed with the application. Ensure all required documents are ready and match the eligibility criteria exactly.',
      category: STATUS_CATEGORIES.ELIGIBILITY,
      platformStatus: true,
    },
    conditional: {
      label: 'Conditionally Qualified (Action Required)',
      shortLabel: 'Conditional',
      description: 'You may be eligible if certain conditions are met or additional steps are completed. The specific conditions will be shown.',
      whatItDoesNotMean: 'This is not a guarantee of eligibility. It means eligibility depends on meeting the stated conditions.',
      nextSteps: 'Review the conditions carefully. Take the required actions or provide the missing information to qualify.',
      category: STATUS_CATEGORIES.ELIGIBILITY,
      platformStatus: true,
    },
    ineligible: {
      label: 'Ineligible',
      shortLabel: 'Ineligible',
      description: 'Based on the information provided, you do not currently meet the eligibility criteria for this service.',
      whatItDoesNotMean: 'This is an automated assessment by Civic Help Setu, not a final government decision. Rules may have exceptions or discretionary considerations.',
      nextSteps: 'Review the reasons shown. Consult the official guidelines or contact the department to confirm. You may qualify under different criteria.',
      category: STATUS_CATEGORIES.ELIGIBILITY,
      platformStatus: true,
    },
    unknown: {
      label: 'Unknown',
      shortLabel: 'Unknown',
      description: 'Civic Help Setu does not have enough information to assess your eligibility for this service.',
      whatItDoesNotMean: 'This does not mean you are ineligible. It means the platform cannot determine eligibility with the available data.',
      nextSteps: 'Provide more information if prompted, or check the official eligibility criteria directly on the government portal.',
      category: STATUS_CATEGORIES.ELIGIBILITY,
      platformStatus: true,
    },
  },
};

export const getStatusDefinition = (category, statusKey) => {
  const categoryDefs = STATUS_DEFINITIONS[category];
  if (!categoryDefs) return null;
  return categoryDefs[statusKey] || null;
};

export const getAllStatusKeys = (category) => {
  const categoryDefs = STATUS_DEFINITIONS[category];
  if (!categoryDefs) return [];
  return Object.keys(categoryDefs);
};

export const getPlatformStatusKeys = () => {
  const keys = [];
  Object.entries(STATUS_DEFINITIONS).forEach(([category, defs]) => {
    Object.keys(defs).forEach((key) => {
      if (defs[key].platformStatus) {
        keys.push({ category, key, ...defs[key] });
      }
    });
  });
  return keys;
};