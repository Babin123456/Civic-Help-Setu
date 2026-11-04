/**
 * Next Step Guide Service
 * Generates a plain-language, ordered next-step guide for a selected service
 * using only verified service fields already available in the application.
 */

const SOURCE_FIELDS = {
  OFFICIAL_SOURCE: 'officialSources',
  DOCUMENTS: 'documents',
  CONTACTS: 'contacts',
  STEPS: 'steps',
  ELIGIBILITY: 'eligibility',
  FEES: 'fees',
  PROCESSING_TIME: 'processingTime',
  WARNINGS: 'warnings',
};

/**
 * Generates a next-step guide from a service record.
 * Each step is traceable to a source field or marked as requiring confirmation.
 *
 * @param {Object} service - The service record
 * @returns {Object} The generated guide with steps and metadata
 */
export function generateNextStepGuide(service) {
  if (!service || typeof service !== 'object') {
    return createEmptyGuide('Service record is missing or invalid.');
  }

  const steps = [];
  let hasAnySourceData = false;

  // Step 1: Official application link
  const officialSource = getFirstVerifiedSource(service);
  if (officialSource) {
    hasAnySourceData = true;
    steps.push({
      order: steps.length + 1,
      title: 'Visit the official application portal',
      description: `Go to ${officialSource.name} to start your application.`,
      sourceField: SOURCE_FIELDS.OFFICIAL_SOURCE,
      sourceLabel: officialSource.name,
      officialUrl: officialSource.url,
      needsConfirmation: false,
    });
  } else {
    steps.push({
      order: steps.length + 1,
      title: 'Find the official application portal',
      description:
        'No verified official source is available in our records. Search for the official government portal for this service or contact the department directly.',
      sourceField: null,
      sourceLabel: 'Confirmation needed',
      officialUrl: null,
      needsConfirmation: true,
      confirmationReason: 'No officialSources field with verified URL found in service record.',
    });
  }

  // Step 2: Required documents
  if (service.documents && service.documents.length > 0) {
    hasAnySourceData = true;
    const docList = service.documents.slice(0, 5).join(', ');
    const moreCount = service.documents.length - 5;
    const moreText = moreCount > 0 ? ` and ${moreCount} more` : '';
    steps.push({
      order: steps.length + 1,
      title: 'Gather required documents',
      description: `Prepare the following: ${docList}${moreText}.`,
      sourceField: SOURCE_FIELDS.DOCUMENTS,
      sourceLabel: `documents (${service.documents.length} listed)`,
      officialUrl: null,
      needsConfirmation: false,
    });
  } else {
    steps.push({
      order: steps.length + 1,
      title: 'Confirm required documents with the department',
      description:
        'Document requirements are not listed in our records. Contact the responsible department or check the official portal to confirm what documents you need.',
      sourceField: null,
      sourceLabel: 'Confirmation needed',
      officialUrl: null,
      needsConfirmation: true,
      confirmationReason: 'No documents array found in service record.',
    });
  }

  // Step 3: Service instructions/steps
  if (service.steps && service.steps.length > 0) {
    hasAnySourceData = true;
    service.steps.forEach((step, index) => {
      steps.push({
        order: steps.length + 1,
        title: step.title || `Step ${index + 1}`,
        description: step.description || '',
        sourceField: SOURCE_FIELDS.STEPS,
        sourceLabel: `steps[${index}] - ${step.title || `Step ${index + 1}`}`,
        officialUrl: null,
        needsConfirmation: false,
      });
    });
  } else {
    steps.push({
      order: steps.length + 1,
      title: 'Confirm application steps with the department',
      description:
        'Application steps are not documented in our records. Check the official portal or contact the department for the current procedure.',
      sourceField: null,
      sourceLabel: 'Confirmation needed',
      officialUrl: null,
      needsConfirmation: true,
      confirmationReason: 'No steps array found in service record.',
    });
  }

  // Step 4: Contact details
  const contacts = getValidContacts(service);
  if (contacts.length > 0) {
    hasAnySourceData = true;
    const primaryContact = contacts[0];
    steps.push({
      order: steps.length + 1,
      title: 'Contact the department for assistance',
      description: `Reach out to ${primaryContact.typeLabel} via ${primaryContact.methodLabel}: ${primaryContact.value}.`,
      sourceField: SOURCE_FIELDS.CONTACTS,
      sourceLabel: `contacts[${primaryContact.type} - ${primaryContact.method}]`,
      officialUrl: primaryContact.href,
      needsConfirmation: !primaryContact.isVerified,
      confirmationReason: primaryContact.isVerified ? null : 'Contact not recently verified.',
    });
  } else {
    steps.push({
      order: steps.length + 1,
      title: 'Find department contact information',
      description:
        'No verified contact details are available in our records. Check the official portal or search for the department\'s helpdesk or grievance channel.',
      sourceField: null,
      sourceLabel: 'Confirmation needed',
      officialUrl: null,
      needsConfirmation: true,
      confirmationReason: 'No valid contacts array found in service record.',
    });
  }

  // Step 5: Eligibility check (if available)
  if (service.eligibility && service.eligibility.length > 0) {
    hasAnySourceData = true;
    steps.push({
      order: steps.length + 1,
      title: 'Verify your eligibility',
      description: `Check if you meet the criteria: ${service.eligibility.join('; ')}.`,
      sourceField: SOURCE_FIELDS.ELIGIBILITY,
      sourceLabel: `eligibility (${service.eligibility.length} criteria)`,
      officialUrl: null,
      needsConfirmation: false,
    });
  }

  // Step 6: Fees (if available)
  if (service.fees) {
    hasAnySourceData = true;
    steps.push({
      order: steps.length + 1,
      title: 'Check applicable fees',
      description: `Fee information: ${service.fees}. Verify the current amount on the official portal before applying.`,
      sourceField: SOURCE_FIELDS.FEES,
      sourceLabel: 'fees',
      officialUrl: null,
      needsConfirmation: false,
    });
  }

  // Step 7: Processing time (if available)
  if (service.processingTime) {
    hasAnySourceData = true;
    steps.push({
      order: steps.length + 1,
      title: 'Note the expected processing time',
      description: `Typical processing time: ${service.processingTime}. Actual time may vary.`,
      sourceField: SOURCE_FIELDS.PROCESSING_TIME,
      sourceLabel: 'processingTime',
      officialUrl: null,
      needsConfirmation: false,
    });
  }

  // Step 8: Important warnings (if available)
  if (service.warnings && service.warnings.length > 0) {
    hasAnySourceData = true;
    steps.push({
      order: steps.length + 1,
      title: 'Review important notes',
      description: service.warnings.join(' '),
      sourceField: SOURCE_FIELDS.WARNINGS,
      sourceLabel: `warnings (${service.warnings.length} notes)`,
      officialUrl: null,
      needsConfirmation: false,
    });
  }

  // Final summary step
  steps.push({
    order: steps.length + 1,
    title: 'Submit your application and track progress',
    description:
      'Complete the application on the official portal. Save your reference number to track the status. If you encounter issues, use the contact information above to reach the department.',
    sourceField: null,
    sourceLabel: 'General guidance',
    officialUrl: null,
    needsConfirmation: false,
  });

  const traceableSteps = steps.filter((s) => s.sourceField && !s.needsConfirmation).length;
  const confirmationSteps = steps.filter((s) => s.needsConfirmation).length;

  return {
    serviceId: service.id,
    serviceName: service.name,
    generatedAt: new Date().toISOString(),
    hasData: hasAnySourceData,
    steps,
    summary: {
      totalSteps: steps.length,
      traceableSteps,
      confirmationSteps,
      hasOfficialSource: !!officialSource,
      hasDocuments: !!(service.documents && service.documents.length > 0),
      hasSteps: !!(service.steps && service.steps.length > 0),
      hasContacts: contacts.length > 0,
    },
  };
}

/**
 * Creates an empty guide for missing/invalid service records.
 */
function createEmptyGuide(reason) {
  return {
    serviceId: null,
    serviceName: 'Unknown Service',
    generatedAt: new Date().toISOString(),
    hasData: false,
    steps: [
      {
        order: 1,
        title: 'Service information unavailable',
        description: reason,
        sourceField: null,
        sourceLabel: 'Error',
        officialUrl: null,
        needsConfirmation: true,
        confirmationReason: reason,
      },
    ],
    summary: {
      totalSteps: 1,
      traceableSteps: 0,
      confirmationSteps: 1,
      hasOfficialSource: false,
      hasDocuments: false,
      hasSteps: false,
      hasContacts: false,
    },
  };
}

/**
 * Gets the first verified official source from the service record.
 */
function getFirstVerifiedSource(service) {
  if (!service.officialSources || !Array.isArray(service.officialSources)) {
    return null;
  }
  const verified = service.officialSources.find((s) => s.verified === true && s.url);
  if (verified) return verified;
  const anyWithUrl = service.officialSources.find((s) => s.url);
  return anyWithUrl || null;
}

/**
 * Gets valid contacts from the service record using the contact directory service logic.
 */
function getValidContacts(service) {
  if (!service.contacts || !Array.isArray(service.contacts)) {
    return [];
  }

  const CONTACT_TYPES = [
    { id: 'department', label: 'Responsible department' },
    { id: 'helpdesk', label: 'Helpdesk' },
    { id: 'grievance', label: 'Formal grievance channel' },
  ];

  const CONTACT_METHODS = [
    { id: 'phone', label: 'Phone' },
    { id: 'email', label: 'Email' },
    { id: 'web', label: 'Website' },
  ];

  const EMAIL_RE = /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/;
  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  const isHttpUrl = (value) => {
    try {
      const parsed = new URL(String(value || '').trim());
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const isPhone = (value) => {
    const text = String(value || '').trim();
    if (!/^\+?[\d\s\-().]+$/.test(text)) return false;
    const digits = text.replace(/\D/g, '');
    return digits.length >= 3 && digits.length <= 15;
  };

  const parseIsoDate = (value) => {
    if (typeof value !== 'string' || !ISO_DATE_RE.test(value.trim())) return null;
    const text = value.trim();
    const date = new Date(`${text}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10) === text ? date : null;
  };

  const now = new Date();
  const CONTACT_EXPIRY_DAYS = 365;

  return service.contacts
    .filter((c) => c && typeof c === 'object')
    .map((c) => {
      const errors = {};
      const value = String(c.value || '').trim();

      if (!CONTACT_TYPES.map((t) => t.id).includes(c.type)) errors.type = 'Invalid type';
      if (!CONTACT_METHODS.map((m) => m.id).includes(c.method)) errors.method = 'Invalid method';

      if (!value) {
        errors.value = 'Required';
      } else if (c.method === 'phone' && !isPhone(value)) {
        errors.value = 'Invalid phone';
      } else if (c.method === 'email' && !EMAIL_RE.test(value)) {
        errors.value = 'Invalid email';
      } else if (c.method === 'web' && !isHttpUrl(value)) {
        errors.value = 'Invalid URL';
      }

      if (!String(c.sourceUrl || '').trim() || !isHttpUrl(c.sourceUrl)) {
        errors.sourceUrl = 'Invalid source URL';
      }

      let verifiedOn = null;
      if (String(c.lastVerified || '').trim()) {
        verifiedOn = parseIsoDate(c.lastVerified);
      }

      const isValid = Object.keys(errors).length === 0;
      let isVerified = false;
      if (isValid && verifiedOn) {
        const ageDays = Math.floor((now.getTime() - verifiedOn.getTime()) / 86400000);
        if (ageDays >= 0 && ageDays <= CONTACT_EXPIRY_DAYS) {
          isVerified = true;
        }
      }

      let href = null;
      if (isValid) {
        if (c.method === 'phone' && isPhone(value)) {
          href = `tel:${value.replace(/[^\d+]/g, '')}`;
        } else if (c.method === 'email' && EMAIL_RE.test(value)) {
          href = `mailto:${value}`;
        } else if (c.method === 'web' && isHttpUrl(value)) {
          href = value;
        }
      }

      const typeInfo = CONTACT_TYPES.find((t) => t.id === c.type);
      const methodInfo = CONTACT_METHODS.find((m) => m.id === c.method);

      return {
        type: c.type,
        method: c.method,
        value,
        typeLabel: typeInfo ? typeInfo.label : 'Contact',
        methodLabel: methodInfo ? methodInfo.label : 'Contact',
        href,
        isVerified,
        isValid,
        lastVerified: c.lastVerified,
        sourceUrl: c.sourceUrl,
      };
    })
    .filter((c) => c.isValid);
}

export { SOURCE_FIELDS };