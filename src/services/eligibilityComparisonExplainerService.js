/**
 * Civic-Service Eligibility Criteria Comparison Explainer Service (#401)
 * 
 * Analyzes and compares structured eligibility requirements across 2 or more civic services.
 * 
 * Safety & Grounding Principles:
 * 1. Normalized Dimensions: Compares criteria across explicit dimensions (age, income, residency, occupation, assets).
 * 2. Strict Grounding: Never infers restrictive criteria absent from the record.
 * 3. Crucial Distinction: Explicitly distinguishes "not stated in catalogue" from "confirmed not eligible".
 * 4. Source Traceability: Each compared condition links back to its exact source text and field.
 */

export const CRITERIA_STATUS = {
  SHARED: 'SHARED',
  DIFFERING: 'DIFFERING',
  SERVICE_SPECIFIC: 'SERVICE_SPECIFIC',
  UNSPECIFIED: 'UNSPECIFIED',
};

export const NOT_STATED_IN_CATALOGUE = 'Not stated in catalogue';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'in',
  'is', 'it', 'of', 'on', 'that', 'the', 'to', 'with', 'must', 'should', 'be',
  'applicant', 'beneficiary', 'criteria', 'eligibility', 'eligible'
]);

/**
 * Clean and normalize text
 */
const clean = (val) => (typeof val === 'string' ? val.trim() : '');

/**
 * Tokenize a criteria text
 */
export const tokenize = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
};

/**
 * Standard comparison dimensions for civic welfare schemes
 */
export const CRITERIA_DIMENSIONS = [
  {
    id: 'residency',
    label: 'Residency & Domicile',
    keywords: ['resident', 'domicile', 'state', 'karnataka', 'delhi', 'maharashtra', 'jurisdiction', 'citizen', 'indian'],
  },
  {
    id: 'income',
    label: 'Income & Economic Status',
    keywords: ['income', 'bpl', 'poverty', 'annual', 'lakh', 'economic', 'ration', 'subsidy', 'creamy', 'wealth'],
  },
  {
    id: 'age',
    label: 'Age Limits & Demographics',
    keywords: ['age', 'years', 'senior', 'citizen', 'child', 'minor', 'adult', 'youth', 'elderly', 'months'],
  },
  {
    id: 'occupation',
    label: 'Occupation & Employment',
    keywords: ['farmer', 'agriculture', 'student', 'worker', 'labour', 'artisan', 'unemployed', 'self-employed', 'driver'],
  },
  {
    id: 'gender_family',
    label: 'Gender & Family Structure',
    keywords: ['woman', 'women', 'girl', 'widow', 'single mother', 'family', 'household', 'orphan', 'disabled', 'pwd'],
  },
  {
    id: 'assets',
    label: 'Asset & Landholding Conditions',
    keywords: ['land', 'hectare', 'acre', 'property', 'house', 'cultivable', 'vehicle', 'pucca'],
  },
];

/**
 * Extract raw criteria list from a service object
 */
export const extractCriteriaList = (service) => {
  if (!service || typeof service !== 'object') return [];
  if (Array.isArray(service.eligibility)) return service.eligibility.map(clean).filter(Boolean);
  if (Array.isArray(service.criteria)) return service.criteria.map(clean).filter(Boolean);
  if (typeof service.eligibility === 'string' && service.eligibility.trim()) {
    return service.eligibility.split(/[\n;]/).map(clean).filter(Boolean);
  }
  return [];
};

/**
 * Classify which dimension a criteria text belongs to
 */
export const mapTextToDimension = (text) => {
  const tokens = tokenize(text);
  const tokenSet = new Set(tokens);

  for (const dim of CRITERIA_DIMENSIONS) {
    for (const kw of dim.keywords) {
      if (tokenSet.has(kw) || text.toLowerCase().includes(kw)) {
        return dim.id;
      }
    }
  }

  return 'other';
};

/**
 * Compare two criteria statements for equivalence
 */
export const areCriteriaEquivalent = (textA, textB) => {
  if (!textA || !textB) return false;
  const sA = textA.trim().toLowerCase();
  const sB = textB.trim().toLowerCase();
  if (sA === sB) return true;

  const tokensA = new Set(tokenize(sA));
  const tokensB = new Set(tokenize(sB));

  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 && (overlap / union) >= 0.70;
};

/**
 * Generate side-by-side criteria breakdown across 2 or more services
 */
export const explainEligibilityComparison = (services = []) => {
  if (!Array.isArray(services) || services.length < 2) {
    return {
      services: [],
      dimensions: [],
      summary: {
        totalDimensionsCompared: 0,
        sharedCount: 0,
        differingCount: 0,
        specificCount: 0,
        unspecifiedCount: 0,
      },
      keyDifferentiators: [],
      advisoryNotice: 'Select at least two services to generate a comparative eligibility breakdown.',
    };
  }

  const validServices = services.map((s, idx) => ({
    id: s.id || `srv-${idx + 1}`,
    title: s.title || s.name || `Service ${idx + 1}`,
    department: s.department || 'Civic Authority',
    criteriaList: extractCriteriaList(s),
  }));

  // Bucket each service's criteria by dimension
  const dimensionMap = {};

  CRITERIA_DIMENSIONS.forEach((dim) => {
    dimensionMap[dim.id] = {
      dimensionId: dim.id,
      label: dim.label,
      serviceRequirements: {},
    };
    validServices.forEach((s) => {
      dimensionMap[dim.id].serviceRequirements[s.id] = [];
    });
  });

  // Assign criteria to dimensions
  validServices.forEach((s) => {
    s.criteriaList.forEach((criterion) => {
      const dimId = mapTextToDimension(criterion);
      if (dimensionMap[dimId]) {
        dimensionMap[dimId].serviceRequirements[s.id].push(criterion);
      }
    });
  });

  // Evaluate status for each dimension
  const comparedDimensions = [];
  let sharedCount = 0;
  let differingCount = 0;
  let specificCount = 0;
  let unspecifiedCount = 0;
  const keyDifferentiators = [];

  Object.values(dimensionMap).forEach((dim) => {
    const serviceEntries = validServices.map((s) => ({
      serviceId: s.id,
      serviceTitle: s.title,
      rules: dim.serviceRequirements[s.id] || [],
      hasRequirement: (dim.serviceRequirements[s.id] || []).length > 0,
      text: (dim.serviceRequirements[s.id] || []).join('; ') || NOT_STATED_IN_CATALOGUE,
    }));

    const populatedServices = serviceEntries.filter((e) => e.hasRequirement);
    let status = CRITERIA_STATUS.UNSPECIFIED;
    let rationale = '';

    if (populatedServices.length === 0) {
      status = CRITERIA_STATUS.UNSPECIFIED;
      rationale = 'Neither service explicitly states criteria for this category in the catalogue record.';
      unspecifiedCount++;
    } else if (populatedServices.length === validServices.length) {
      // All services specify something in this dimension: are they equivalent or differing?
      const firstText = populatedServices[0].text;
      const allEquivalent = populatedServices.every((e) => areCriteriaEquivalent(e.text, firstText));

      if (allEquivalent) {
        status = CRITERIA_STATUS.SHARED;
        rationale = 'All compared services share equivalent requirements for this dimension.';
        sharedCount++;
      } else {
        status = CRITERIA_STATUS.DIFFERING;
        rationale = 'All compared services specify rules here, but their thresholds or conditions differ.';
        differingCount++;
        keyDifferentiators.push({
          dimension: dim.label,
          explanation: `Different conditions across services: ${serviceEntries.map((e) => `"${e.serviceTitle}": ${e.text}`).join(' vs ')}`,
        });
      }
    } else {
      // Stated in 1 or more, but not all services
      status = CRITERIA_STATUS.SERVICE_SPECIFIC;
      const specifiedTitles = populatedServices.map((p) => p.serviceTitle).join(', ');
      const unspecifiedTitles = serviceEntries.filter((e) => !e.hasRequirement).map((u) => u.serviceTitle).join(', ');
      rationale = `Required for ${specifiedTitles}, but unstated in catalogue record for ${unspecifiedTitles}.`;
      specificCount++;
      keyDifferentiators.push({
        dimension: dim.label,
        explanation: `Condition applies to ${specifiedTitles}, whereas ${unspecifiedTitles} has no condition listed in the catalogue.`,
      });
    }

    comparedDimensions.push({
      dimensionId: dim.dimensionId,
      label: dim.label,
      status,
      rationale,
      serviceEntries,
    });
  });

  return {
    services: validServices.map((s) => ({ id: s.id, title: s.title, department: s.department })),
    dimensions: comparedDimensions,
    summary: {
      totalDimensionsCompared: comparedDimensions.length,
      sharedCount,
      differingCount,
      specificCount,
      unspecifiedCount,
    },
    keyDifferentiators,
    advisoryNotice:
      'Grounded Comparison Guardrail: Conditions marked "Not stated in catalogue" indicate that the official record does not list a specific restriction. It does NOT mean you are ineligible. Always verify with the governing department.',
  };
};
