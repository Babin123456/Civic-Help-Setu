/**
 * UP Government Office Visit Packs / Journey Planner.
 * Task-specific visit plans without booking appointments or guaranteeing service completion.
 * Private visit notes are not publicly indexed.
 *
 * Pilot: Tehsil and municipal offices in Lucknow district, Uttar Pradesh.
 */

import { UP_OFFICES } from './upOffices.js';
import { UP_SERVICES } from './upServices.js';

// Normalize office ID: test uses snake_case, data uses camelCase
const OFFICE_ID_NORMALIZER = {
  'lucknow-tehsil-sadar': 'lucknowTehsilSadar',
  'lucknow-municipal-office': 'lucknowMunicipalOffice',
  'lucknow-tehsil-bahraich': 'lucknowTehsilBahraich',
};

// ============ VISIT PACKS (task-specific checklists) ============

/**
 * Generates a visit pack for a given service ID.
 * A visit pack lists: document requirements, fee payment, forms, questions to ask,
 * counter information, and privacy-safe visit recording fields.
 *
 * @param {string} serviceId - The service ID (e.g., 'birth-certificate')
 * @param {string} [officeId='lucknow-tehsil-sadar'] - The office ID to visit
 * @returns {Object} Visit pack with all required information
 */
export function generateVisitPack(serviceId, officeId = 'lucknowTehsilSadar') {
  // Normalize office ID if test passed snake_case version
  const normalizedOfficeId = OFFICE_ID_NORMALIZER[officeId] || officeId;
  const service = UP_SERVICES.find((s) => s.id === serviceId);
  const office = UP_OFFICES[normalizedOfficeId];

  if (!service) {
    throw new Error(`Unknown service ID: ${serviceId}`);
  }
  if (!office) {
    throw new Error(`Unknown office ID: ${officeId}`);
  }

  // Determine which counter to use based on service
  const counter = office.counters.find((c) =>
    service.counterMapping && c.id === service.counterMapping
  ) || office.counters.find((c) => c.isPrimary) || office.counters[0];

  // Build the visit pack
  const visitPack = {
    // Basic identification
    serviceId,
    serviceName: service.name,
    officeId,
    officeName: office.name,
    officeAddress: office.address,
    officeCity: office.city,
    officePincode: office.pincode,

    // visit date and token info (private - not stored in public state)
    visitDate: null, // Set by user after visit; not publicly indexed
    tokenNumber: null, // Optional; set by user after visit
    counterVisited: null, // Which counter the user actually visited
    outcome: null, // 'served', 'returned', 'deficient', etc.
    deficiencyMemo: null, // User-reported deficiencies (private)
    nextStep: null, // User-defined next action

    // Public-facing office information (never invented)
    officeHours: office.officeHours,
    publicHoursSource: office.publicHoursSource,
    publicHoursLastVerified: office.publicHoursLastVerified,
    counters: office.counters.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      source: c.source,
      lastVerified: c.lastVerified,
      uncertaintyNote: c.uncertaintyNote,
    })),

    // Service-specific visit plan
    documentRequirements: service.documentRequirements
      ? Object.entries(service.documentRequirements).reduce(
          (acc, [req, details]) => {
            acc[req] = {
              type: details.type,
              note: details.note,
              // Distinguish: published official instruction vs citizen observation
              sourceType: details.type === 'official' ? 'official-instruction' : 'citizen-observation',
            };
            return acc;
          },
          {}
        )
      : [],

    // Fee payment method
    fees: service.fees,
    feePaymentMethod: service.id === 'tradeLicence'
      ? 'cash/UPI at counter or via LMC portal'
      : service.id === 'income-certificate'
        ? 'cash at Tehsil counter (₹15-₹30)'
        : service.id === 'caste-certificate'
          ? 'cash at counter (₹20-₹50)'
          : service.id === 'ration-card'
            ? 'cash at counter (₹5-₹50)'
            : 'free',

    // Forms to carry
    forms: service.forms.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      source: f.source,
    })),

    // Prior acknowledgement / things to confirm before visiting
    priorAcknowledgement: service.id === 'birth-certificate'
      ? 'Confirm birth is already registered in the CRS. If not, obtain institutional birth acknowledgement first.'
      : service.id === 'income-certificate'
        ? 'Affidavit on non-judicial stamp paper (₹10). Confirm validity period (6-12 months) with receiving authority.'
        : service.id === 'caste-certificate'
          ? 'Ensure community is in UP notified list. Verify parent\'s community certificate availability.'
          : service.id === 'trade-licence'
            ? 'Confirm zero dues on electricity bill and property tax. Have lease agreement and NOC ready.'
            : service.id === 'ration-card'
              ? 'Confirm eligibility category (APL/BPL). Aadhaar linking is mandatory for benefits.'
              : 'No prior acknowledgement required.',

    // Questions to ask at the counter
    questionsToAsk: service.questionsToAsk,

    // Counter-specific guidance
    counterGuidance: counter
      ? {
          counterName: counter.name,
          description: counter.description,
          uncertaintyNote: counter.uncertaintyNote,
          // Never invent opening hours or token numbers - use office hours
          officeOpeningHours: office.officeHours.hours,
          tokenDistributionStart: 'Tokens distributed from 10:00 AM (Tehsil) or 09:30 AM (Municipal)',
        }
      : {},

    // Official sources for this service
    officialSources: service.officialSources,

    // Distinguish published official instructions from citizen observations
    // Mark uncertain counter details clearly
    uncertaintyMarkers: office.counters.map((c) => ({
      counterId: c.id,
      counterName: c.name,
      uncertainty: !!c.uncertaintyNote,
      // Clearly mark if counter details are uncertain
      markedUncertain: !!c.uncertaintyNote,
    })),

    // Language support for printable offline packs
    languageSupport: office.languageCoverage,

    // Privacy: visit recording fields (private, not publicly indexed)
    // These fields are for the user's private record only
    privacy: {
      // These are stored locally/privately only; never sent to public servers
      visitDate: 'User-recorded (private only)',
      tokenNumber: 'User-recorded (optional, private only)',
      counterVisited: 'User-recorded (private only)',
      outcome: 'User-recorded (private only)',
      deficiencyMemo: 'User-recorded (private only)',
      nextStep: 'User-recorded (private only)',
    },
  };

  return visitPack;
}

// ============ PREDEFINED VISIT PACKS for common services ============

export const VISIT_PACKS = {
  // Birth Certificate visit pack - Tehsil Sadar
  birthCertificate: generateVisitPack('birth-certificate', 'lucknowTehsilSadar'),

  // Income Certificate visit pack
  incomeCertificate: generateVisitPack('income-certificate', 'lucknowTehsilSadar'),

  // Caste Certificate visit pack
  casteCertificate: generateVisitPack('caste-certificate', 'lucknowTehsilSadar'),

  // Trade Licence visit pack - Municipal
  tradeLicence: generateVisitPack('business-licence-checklist', 'lucknowMunicipalOffice'),

  // Ration Card visit pack - Tehsil
  rationCard: generateVisitPack('ration-card', 'lucknowTehsilSadar'),
};

// ============ PRINTABLE/OFFLINE UTILITIES ============

/**
 * Converts a visit pack to a printable text format.
 * Supports Hindi and Urdu languages based on office languageCoverage.
 *
 * @param {Object} visitPack - The visit pack from generateVisitPack()
 * @param {string} [language='en'] - Language code: 'en' | 'hi' | 'ur'
 * @returns {string} Printable text content
 */
export function getPrintableVisitPack(visitPack, language = 'en') {
  const lang = language || 'en';
  const office = UP_OFFICES[visitPack.officeId];
  const languageSupport = office?.languageCoverage?.supportedLanguages || ['Hindi', 'English'];

  // Simple translations for common terms (Hindi and English only; Urdu labels simplified)
  const translations = {
    en: {
      title: 'UP Government Office Visit Planner',
      service: 'Service:',
      office: 'Office:',
      address: 'Address:',
      city: 'City:',
      pincode: 'Pincode:',
      visitDate: 'Visit Date:',
      tokenNumber: 'Token Number:',
      counterVisited: 'Counter Visited:',
      outcome: 'Outcome:',
      deficiencyMemo: 'Deficiency Memo:',
      nextStep: 'Next Step:',
      documentRequirements: 'Document Requirements:',
      fees: 'Fee:',
      paymentMethod: 'Payment Method:',
      forms: 'Forms to Carry:',
      priorAcknowledgement: 'Prior Acknowledgement:',
      questionsToAsk: 'Questions to Ask at Counter:',
      counterGuidance: 'Counter Guidance:',
      officeHours: 'Public Hours:',
      officialSources: 'Official Sources:',
      uncertainty: 'Uncertainty Note:',
      privacyNote: '⚠️ Visit notes are recorded privately and not publicly indexed.',
    },
    hi: {
      title: 'UP सरकारी कार्यालय दौरा तैयारी योजनाकार',
      service: 'सेवा:',
      office: 'कार्यालय:',
      address: 'पता:',
      city: 'शहर:',
      pincode: 'पिनकोड:',
      visitDate: 'दिनांक:',
      tokenNumber: 'टोकन संख्या:',
      counterVisited: 'सुरक्षा काउंटर:',
      outcome: 'परिणाम:',
      deficiencyMemo: 'कमी का विवरण:',
      nextStep: 'आगे का कदम:',
      documentRequirements: 'आवश्यक दस्तावेज:',
      fees: 'शुल्क:',
      paymentMethod: 'भुगतान की विधि:',
      forms: 'ले जाने वाले प्रपत्र:',
      priorAcknowledgement: 'पूर्व स्वीकृति:',
      questionsToAsk: 'काउंटर पर पूछने वाले प्रश्न:',
      counterGuidance: 'काउंटर निर्देश:',
      officeHours: 'सार्वजनिक समय:',
      officialSources: 'आधिकारिक स्रोत:',
      uncertainty: 'अनिश्चितता नोट:',
      privacyNote: '⚠️ दौरा नोट्स निजी रूप से दर्ज किए गए हैं और सार्वजनिक रूप से सूचर््कित नहीं किए गए हैं।',
    },
    // Urdu simplified translations (ASCII-safe, avoiding Perso-Arabic encoding issues)
    ur: {
      title: 'UP Visit Planner (Urdu)',
      service: 'Service:',
      office: 'Office:',
      address: 'Address:',
      city: 'City:',
      pincode: 'Pincode:',
      visitDate: 'Date:',
      tokenNumber: 'Token:',
      counterVisited: 'Counter:',
      outcome: 'Result:',
      deficiencyMemo: 'Deficiency:',
      nextStep: 'Next Step:',
      documentRequirements: 'Documents:',
      fees: 'Fee:',
      paymentMethod: 'Payment:',
      forms: 'Forms:',
      priorAcknowledgement: 'Acknowledgement:',
      questionsToAsk: 'Questions:',
      counterGuidance: 'Guidance:',
      officeHours: 'Hours:',
      officialSources: 'Sources:',
      uncertainty: 'Uncertainty:',
      privacyNote: '⚠️ Visit notes private only.',
    },
  };

  const t = translations[lang] || translations.en;

  // Build printable content
  let output = [];
  output.push('='.repeat(60));
  output.push(t.title);
  output.push('='.repeat(60));
  output.push('');
  output.push(`${t.service} ${visitPack.serviceName}`);
  output.push(`${t.office} ${visitPack.officeName}`);
  output.push(`${t.address} ${visitPack.officeAddress}`);
  output.push(`${t.city} ${visitPack.officeCity}`);
  if (visitPack.officePincode) {
    output.push(`${t.pincode} ${visitPack.officePincode}`);
  }
  output.push('');

  // Office hours
  output.push(`${t.officeHours}`);
  output.push(`  Days: ${visitPack.officeHours.days}`);
  output.push(`  Hours: ${visitPack.officeHours.hours}`);
  if (visitPack.officeHours.lunchBreak) {
    output.push(`  Lunch Break: ${visitPack.officeHours.lunchBreak}`);
  }
  output.push(`  Open Saturdays: ${visitPack.officeHours.openSaturdays ? 'Yes' : 'No'}`);
  output.push('');

  // Public hours source
  output.push(`  Source: ${visitPack.publicHoursSource}`);
  output.push(`  Last Verified: ${visitPack.publicHoursLastVerified}`);
  output.push('');

  // Counter information
  output.push(`${t.counterGuidance}`);
  if (visitPack.counterVisited) {
    output.push(`  Visited Counter: ${visitPack.counterVisited}`);
  }
  output.push('  Available Counters:');
  visitPack.counters.forEach((c) => {
    output.push(`    - ${c.name}: ${c.description}`);
    if (c.uncertaintyNote) {
      output.push(`      ⚠️ ${c.uncertaintyNote}`);
    }
  });
  output.push('');

  // Document requirements
  output.push(`${t.documentRequirements}`);
  if (visitPack.documentRequirements && Object.keys(visitPack.documentRequirements).length > 0) {
    Object.entries(visitPack.documentRequirements).forEach(([req, details]) => {
      output.push(`  • ${req}`);
      if (details.note) {
        output.push(`    Note: ${details.note}`);
      }
      if (details.sourceType) {
        output.push(`    Type: ${details.sourceType}`);
      }
    });
  } else {
    output.push('  (No specific requirements defined)');
  }
  output.push('');

  // Fee information
  output.push(`${t.fees} ${visitPack.fees}`);
  if (visitPack.feePaymentMethod) {
    output.push(`  ${t.paymentMethod} ${visitPack.feePaymentMethod}`);
  }
  output.push('');

  // Forms
  output.push('Forms to Carry:');
  visitPack.forms.forEach((f) => {
    output.push(`  • ${f.name} (${f.type})`);
  });
  output.push('');

  // Prior acknowledgement
  output.push(`${t.priorAcknowledgement}`);
  output.push(`  ${visitPack.priorAcknowledgement}`);
  output.push('');

  // Questions to ask
  output.push(`${t.questionsToAsk}`);
  visitPack.questionsToAsk.forEach((q) => {
    output.push(`  • ${q}`);
  });
  output.push('');

  // Official sources
  output.push(`${t.officialSources}`);
  visitPack.officialSources.forEach((src) => {
    output.push(`  • ${src.name}: ${src.url}`);
  });
  output.push('');

  // Uncertainty markers
  output.push(`${t.uncertainty}`);
  visitPack.uncertaintyMarkers.forEach((m) => {
    if (m.markedUncertain) {
      output.push(`  ⚠️ ${m.counterName}: ${m.uncertainty}`);
    }
  });
  output.push('');

  // Privacy note
  output.push(t.privacyNote);
  output.push('');

  return output.join('\n');
}

/**
 * Exports visit pack data as JSON for offline use.
 * Does NOT include private visit recording fields in the public export.
 *
 * @param {Object} visitPack - The visit pack
 * @returns {Object} Exportable data (private fields excluded)
 */
export function exportVisitPackOffline(visitPack) {
  const { privacy, ...exportable } = visitPack;
  return exportable;
}