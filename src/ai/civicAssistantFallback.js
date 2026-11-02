/**
 * Structured, context-aware fallback for the civic assistant when it cannot
 * verify an answer.
 *
 * Safety rules:
 * - Never fabricate a department, URL, deadline, or application status.
 * - Only recombine data already present in the service catalogue and the
 *   verified office directory.
 * - Always surface an in-app catalogue search, a nearby-office lookup when a
 *   relevant office exists, and the official department source.
 */

import { CIVIC_OFFICES } from '../data/locationOffices';

export const NATIONAL_PORTAL = {
  name: 'National Government Services Portal (Services.india.gov.in)',
  url: 'https://services.india.gov.in',
  verified: true,
};

const DOMAINS = [
  {
    id: 'certificates',
    keywords: ['birth', 'death', 'certificate', 'caste', 'income', 'domicile', 'residence', 'tehsil', 'collectorate', 'municipal', 'registrar'],
    serviceIds: ['birth-certificate', 'income-certificate', 'caste-certificate', 'voter-id'],
    categoryLabels: ['Certificates', 'Revenue & Certificates', 'Certificates & Municipal'],
  },
  {
    id: 'transport',
    keywords: ['drive', 'driving', 'license', 'licence', 'rto', 'vehicle', 'motor', 'transport', 'road', 'learner'],
    serviceIds: ['driving-license'],
    categoryLabels: ['Transport & Driving', 'Transport'],
  },
  {
    id: 'identity',
    keywords: ['aadhaar', 'uidai', 'biometric', 'passport', 'pan', 'tax', 'income tax', 'voter', 'epic'],
    serviceIds: ['aadhaar-card', 'pan-card', 'passport', 'voter-id'],
    categoryLabels: ['Identity', 'Identity & Aadhaar', 'Passport & Travel', 'Taxation & Identity'],
  },
  {
    id: 'social-welfare',
    keywords: ['ration', 'food', 'pension', 'widow', 'disability', 'subsidy', 'nfsa', 'ration card'],
    serviceIds: ['ration-card', 'pension-scheme'],
    categoryLabels: ['Social Welfare'],
  },
  {
    id: 'employment',
    keywords: ['pf', 'epf', 'provident', 'withdrawal', 'epfo', 'uan', 'pension'],
    serviceIds: ['pf-withdrawal'],
    categoryLabels: ['Employment'],
  },
  {
    id: 'business',
    keywords: ['udyam', 'msme', 'enterprise', 'business', 'registration'],
    serviceIds: ['udyam-registration'],
    categoryLabels: ['Business'],
  },
  {
    id: 'agriculture',
    keywords: ['kisan', 'farmer', 'agriculture', 'pm kisan', 'land holding'],
    serviceIds: ['pm-kisan'],
    categoryLabels: ['Agriculture'],
  },
  {
    id: 'complaints',
    keywords: ['grievance', 'complaint', 'cpgrams', 'consumer', '1915'],
    serviceIds: ['public-grievance'],
    categoryLabels: ['Complaints', 'Grievance & Consumer Help'],
  },
];

const matchDomain = (q) => {
  let best = null;
  let bestScore = 0;

  for (const domain of DOMAINS) {
    let score = 0;
    for (const keyword of domain.keywords) {
      if (q.includes(keyword)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = domain;
    }
  }

  return bestScore > 0 ? best : null;
};

const matchServices = (activeServices, domain) => {
  const hints = new Set(domain.serviceIds);
  const labels = new Set(domain.categoryLabels.map((l) => l.toLowerCase()));

  return activeServices.filter((s) => {
    if (hints.has(s.id)) return true;
    if (s.category && labels.has(s.category.toLowerCase())) return true;
    if (s.department && domain.keywords.some((k) => s.department.toLowerCase().includes(k))) return true;
    return false;
  });
};

const matchOffices = (offices, domain, matchedServiceIds) => {
  const hints = new Set(domain.serviceIds);
  const labels = new Set(domain.categoryLabels.map((l) => l.toLowerCase()));

  return offices.filter((o) => {
    if (o.serviceIds && o.serviceIds.some((id) => hints.has(id))) return true;
    if (matchedServiceIds.some((id) => o.serviceIds && o.serviceIds.includes(id))) return true;
    if (o.category && labels.has(o.category.toLowerCase())) return true;
    return false;
  });
};

const pickOfficialSource = (matchedServices) => {
  for (const svc of matchedServices) {
    const sources = Array.isArray(svc.officialSources) ? svc.officialSources : [];
    const verified = sources.find((src) => src && src.verified === true);
    if (verified) return verified;
    if (sources[0]) return sources[0];
  }
  return NATIONAL_PORTAL;
};

/**
 * Builds a structured fallback response when the assistant cannot verify an
 * answer. Returns a response object compatible with the assistant message
 * shape used by `askCivicAssistant` and `askGroundedCivicAssistant`.
 *
 * @param {string} query - The user's question
 * @param {Object} options
 * @param {Array} options.activeServices - Active service catalogue records
 * @param {Array} options.offices - Verified office directory (defaults to CIVIC_OFFICES)
 * @param {boolean} options.timeout - Whether the assistant request timed out
 * @returns {Object}
 */
export const buildCivicAssistantFallback = (query, options = {}) => {
  const { activeServices = [], offices = CIVIC_OFFICES, timeout = false } = options;
  const q = (query || '').toLowerCase().trim();

  const domain = matchDomain(q);
  const matchedServices = domain ? matchServices(activeServices, domain) : [];
  const matchedServiceIds = matchedServices.map((s) => s.id);
  const nearbyOffices = domain ? matchOffices(offices, domain, matchedServiceIds) : [];
  const officialSource = matchedServices.length > 0 ? pickOfficialSource(matchedServices) : NATIONAL_PORTAL;

  const catalogueSearch = matchedServices.slice(0, 3).map((svc) => ({
    name: svc.name,
    id: svc.id,
    category: svc.category,
    suggestion: `Search the service catalogue for ${svc.name}`,
    route: `/services/${svc.id}`,
  }));

  const officeLookup = nearbyOffices.slice(0, 3).map((office) => ({
    name: office.name,
    type: office.type,
    city: office.city,
    state: office.state,
    phone: office.contact ? office.contact.phone : null,
    helpline: office.contact ? office.contact.helpline : null,
    portalUrl: office.contact ? office.contact.portalUrl : null,
    directionsUrl: office.directionsUrl || null,
  }));

  const domainSpecificPrompt = domain
    ? `Try rephrasing your question to name the specific ${domain.id} service or document you need (for example: "${catalogueSearch[0]?.suggestion || 'a service catalogue search'}").`
    : 'Try rephrasing your question to name a specific government service, certificate, or department.';

  const retryPrompts = [
    'Try again',
    'Rephrase your question',
    domainSpecificPrompt,
    'Browse the service catalogue directly',
  ];

  const summaryParts = [
    `I could not verify an answer for "${query || ''}".`,
    'Civic-Help-Setu does not invent departments, URLs, deadlines, or application statuses.',
  ];

  if (catalogueSearch.length > 0) {
    summaryParts.push(`You can search the in-app service catalogue for: ${catalogueSearch.map((c) => c.name).join(', ')}.`);
  }
  if (officeLookup.length > 0) {
    summaryParts.push(`A nearby ${officeLookup[0].type.toLowerCase()} office lookup is available below.`);
  }
  summaryParts.push(`You can also check the official source: ${officialSource.name}.`);

  return {
    status: 'unverified',
    grounded: false,
    serviceId: null,
    timeout,
    data: {
      title: 'I could not verify an answer',
      summary: summaryParts.join(' '),
      missingInformationNotice:
        'No verified government guideline or catalogue record was found for this specific question. Do not treat any suggested link as an eligibility decision.',
      catalogueSearch,
      nearbyOffices: officeLookup,
      officialSource,
      retryPrompts,
    },
    suggestions: retryPrompts,
  };
};
