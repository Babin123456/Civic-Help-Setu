/**
 * Citizen Profile Civic Entitlement Readiness & Document Gap Analyzer.
 *
 * Compares a citizen's profile metadata and vault records against statutory
 * eligibility criteria to compute an overall Civic Readiness Score (0-100%)
 * and identify missing foundational certificates required for public welfare delivery.
 */

export const ESSENTIAL_CIVIC_CREDENTIALS = [
  {
    id: 'aadhaar',
    label: 'Aadhaar / National Identity Proof',
    category: 'identity',
    weight: 25,
    matchKeywords: ['aadhaar', 'uid', 'identity'],
  },
  {
    id: 'pan',
    label: 'PAN Card / Tax Identifier',
    category: 'finance',
    weight: 15,
    matchKeywords: ['pan', 'tax', 'incometax'],
  },
  {
    id: 'voter',
    label: 'Voter ID (EPIC) / Electoral Proof',
    category: 'identity',
    weight: 15,
    matchKeywords: ['voter', 'epic', 'election'],
  },
  {
    id: 'income',
    label: 'Income Certificate (Revenue Authority)',
    category: 'welfare',
    weight: 20,
    matchKeywords: ['income', 'salary', 'tehsildar', 'revenue'],
  },
  {
    id: 'domicile',
    label: 'Domicile / Residence Certificate',
    category: 'residence',
    weight: 15,
    matchKeywords: ['domicile', 'residence', 'nativity'],
  },
  {
    id: 'ration',
    label: 'Ration Card / Food Security Proof',
    category: 'welfare',
    weight: 10,
    matchKeywords: ['ration', 'pds', 'food security', 'bpl'],
  },
];

/**
 * Checks if a specific required credential is held within the citizen's vault documents.
 */
function isCredentialInVault(credential, vaultDocuments = []) {
  if (!Array.isArray(vaultDocuments) || vaultDocuments.length === 0) return false;
  return vaultDocuments.some((doc) => {
    const name = (doc.name || '').toLowerCase();
    const type = (doc.type || '').toLowerCase();
    const cat = (doc.category || '').toLowerCase();
    return credential.matchKeywords.some(
      (kw) => name.includes(kw) || type.includes(kw) || cat.includes(kw)
    );
  });
}

/**
 * Assesses overall civic entitlement readiness score.
 */
export function assessCivicReadiness(profile = {}, vaultDocuments = []) {
  const docs = Array.isArray(vaultDocuments) ? vaultDocuments : [];

  let achievedWeight = 0;
  const verifiedCredentials = [];
  const missingCredentials = [];

  for (const cred of ESSENTIAL_CIVIC_CREDENTIALS) {
    const present = isCredentialInVault(cred, docs);
    if (present) {
      achievedWeight += cred.weight;
      verifiedCredentials.push({
        id: cred.id,
        label: cred.label,
        category: cred.category,
      });
    } else {
      missingCredentials.push({
        id: cred.id,
        label: cred.label,
        category: cred.category,
      });
    }
  }

  // Profile completion bonus: name + state + city adds up to 5 points
  const hasBasicProfile = profile.state && profile.city;
  const overallScore = Math.min(100, achievedWeight + (hasBasicProfile ? 5 : 0));

  let tier = 'INITIAL';
  let tierLabel = 'Basic / Incomplete Dossier';
  let tierColor = '#ef4444';

  if (overallScore >= 80) {
    tier = 'SCHEME_READY';
    tierLabel = 'Civic Scheme Ready';
    tierColor = '#10b981';
  } else if (overallScore >= 50) {
    tier = 'MODERATE';
    tierLabel = 'Moderate / Core Identity Ready';
    tierColor = '#f59e0b';
  }

  const recommendations = missingCredentials.slice(0, 3).map((m) => {
    if (m.id === 'income') {
      return 'Obtain an Income Certificate from your local Tehsil office to unlock subsidy schemes.';
    }
    if (m.id === 'domicile') {
      return 'Upload a Domicile/Residence proof to qualify for state-specific educational reservations.';
    }
    if (m.id === 'voter') {
      return 'Link your Voter ID to fulfill secondary photo identity criteria.';
    }
    return `Upload or link your ${m.label} in the Digital Vault.`;
  });

  return {
    overallScore,
    tier,
    tierLabel,
    tierColor,
    verifiedCount: verifiedCredentials.length,
    missingCount: missingCredentials.length,
    totalCount: ESSENTIAL_CIVIC_CREDENTIALS.length,
    verifiedCredentials,
    missingCredentials,
    recommendations,
  };
}
