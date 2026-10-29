import { logDiagnostic } from '../utils/diagnostics';
const STORAGE_KEY = 'civicbridge_eligibility_assessments';

export const SCHEME_EVALUATION_RULES = [
  {
    id: 'pm-kisan',
    name: 'PM Kisan Samman Nidhi',
    category: 'Agriculture',
    benefit: '₹6,000 per year direct income support in 3 equal installments.',
    evaluate: (profile) => {
      const isFarmer = profile.employment === 'farmer';
      const ownsLand = Boolean(profile.ownsAgriculturalLand);
      const income = Number(profile.annualIncome) || 0;

      if (!isFarmer && !ownsLand) {
        return {
          status: 'ineligible',
          reason: 'Scheme is exclusively reserved for small and marginal landholding farmer families.',
          missingPrerequisites: ['Cultivable agricultural land registered in applicant name'],
          actionLink: '/services/pm-kisan',
        };
      }

      if (income > 800000) {
        return {
          status: 'ineligible',
          reason: 'Institutional landholders and high-income income-tax payers are excluded from PM-Kisan.',
          missingPrerequisites: [],
          actionLink: '/services/pm-kisan',
        };
      }

      if (ownsLand && !profile.hasAadhaar) {
        return {
          status: 'conditional',
          reason: 'Landholding criteria met, but mandatory Aadhaar OTP e-KYC is required to receive direct benefit transfers.',
          missingPrerequisites: ['Aadhaar linked to bank account (e-KYC)'],
          actionLink: '/services/aadhaar-card',
        };
      }

      return {
        status: 'eligible',
        reason: 'You qualify as an eligible agricultural cultivator with landholding below threshold.',
        requiredDocuments: ['Aadhaar Card', 'Land Record (Khatauni / Patta)', 'Active Bank Passbook'],
        actionLink: '/services/pm-kisan',
      };
    },
  },
  {
    id: 'ration-card',
    name: 'NFSA Food Security (Ration Card)',
    category: 'Social Welfare',
    benefit: 'Subsidized food grains (rice, wheat, coarse grains) under National Food Security Act.',
    evaluate: (profile) => {
      const income = Number(profile.annualIncome) || 0;
      const isLowIncome = income <= 250000;
      const isBPL = income <= 100000;

      if (income > 300000) {
        return {
          status: 'ineligible',
          reason: `Annual family income (₹${income.toLocaleString('en-IN')}) exceeds statutory state limits for Priority Household / BPL grain subsidies.`,
          missingPrerequisites: [],
          actionLink: '/services/ration-card',
        };
      }

      if (!profile.hasIncomeCertificate) {
        return {
          status: 'conditional',
          reason: 'Income level qualifies, but an official Tehsildar Income Certificate is required to verify household bracket.',
          missingPrerequisites: ['Income Certificate from Revenue Department'],
          actionLink: '/services/income-certificate',
        };
      }

      return {
        status: 'eligible',
        reason: isBPL
          ? 'You qualify for Antyodaya Anna Yojana (AAY) deepest subsidy bracket.'
          : 'You qualify for Priority Household (PHH) subsidized monthly rations.',
        requiredDocuments: ['Family Head Aadhaar', 'Address Proof', 'Income Certificate', 'Family Group Photograph'],
        actionLink: '/services/ration-card',
      };
    },
  },
  {
    id: 'scholarship-post-matric',
    name: 'Post-Matric Student Scholarship',
    category: 'Education',
    benefit: '100% tuition reimbursement and monthly maintenance stipend for higher education.',
    evaluate: (profile) => {
      const isStudent = profile.isStudent;
      const category = profile.category;
      const income = Number(profile.annualIncome) || 0;

      if (!isStudent) {
        return {
          status: 'ineligible',
          reason: 'Applicant must be currently enrolled in a recognized university or polytechnic institution.',
          missingPrerequisites: ['Active college / university enrollment'],
          actionLink: '/services',
        };
      }

      if (income > 250000) {
        return {
          status: 'ineligible',
          reason: 'Family annual income must not exceed ₹2.5 Lakhs as per National Scholarship Portal guidelines.',
          missingPrerequisites: [],
          actionLink: '/services',
        };
      }

      if (['SC', 'ST', 'OBC', 'EWS'].includes(category)) {
        return {
          status: 'eligible',
          reason: `Eligible under ${category} state welfare quota with family income below ₹2.5L.`,
          requiredDocuments: ['Caste / Community Certificate', 'Income Certificate', 'College Fee Receipt', 'Aadhaar Card'],
          actionLink: '/services/income-certificate',
        };
      }

      return {
        status: 'conditional',
        reason: 'General category students require EWS certification and above 75% marks in previous examination.',
        missingPrerequisites: ['EWS Certificate'],
        actionLink: '/services/income-certificate',
      };
    },
  },
  {
    id: 'driving-license',
    name: 'Permanent Driving License (RTO)',
    category: 'Transport',
    benefit: 'Official state authorization to operate private and commercial motor vehicles.',
    evaluate: (profile) => {
      const age = Number(profile.age) || 0;

      if (age < 18) {
        return {
          status: 'ineligible',
          reason: `Minimum statutory age for regular motor vehicle license is 18 years. (Applicant is ${age} years).`,
          missingPrerequisites: ['Attaining minimum age of 18 years'],
          actionLink: '/services/driving-license',
        };
      }

      if (!profile.hasLearnerLicense) {
        return {
          status: 'conditional',
          reason: 'You meet the age criteria, but must hold a valid Learner License for at least 30 days before taking the driving test.',
          missingPrerequisites: ['Learner License (held for 30+ days)'],
          actionLink: '/services/driving-license',
        };
      }

      return {
        status: 'eligible',
        reason: 'Age and prerequisite learner period satisfied. Ready for RTO track test slot booking.',
        requiredDocuments: ['Learner License Reference', 'Proof of Age', 'Address Proof', 'Vehicle matching class for test'],
        actionLink: '/services/driving-license',
      };
    },
  },
  {
    id: 'udyam-registration',
    name: 'Udyam MSME Enterprise Registration',
    category: 'Business',
    benefit: 'Access to priority sector bank loans, collateral-free credit (CGTMSE), and tender exemptions.',
    evaluate: (profile) => {
      const isSelfEmployed = profile.employment === 'self-employed' || profile.employment === 'business';

      if (!profile.hasAadhaar || !profile.hasPan) {
        return {
          status: 'conditional',
          reason: 'Both personal Aadhaar and business/proprietor PAN are mandatory for zero-cost digital Udyam verification.',
          missingPrerequisites: ['Valid PAN Card', 'Aadhaar Card with mobile OTP linked'],
          actionLink: '/services/pan-card',
        };
      }

      return {
        status: 'eligible',
        reason: 'Identity credentials satisfy MSME Ministry e-registration prerequisites. Instant digital certificate.',
        requiredDocuments: ['Aadhaar Number', 'PAN Card', 'Bank IFSC and Account Number'],
        actionLink: '/services/udyam-registration',
      };
    },
  },
  {
    id: 'passport',
    name: 'New Passport (Tatkaal / Normal)',
    category: 'Identity',
    benefit: 'Standard 36/60 page booklet for international citizen travel.',
    evaluate: (profile) => {
      const age = Number(profile.age) || 0;

      if (!profile.hasAadhaar) {
        return {
          status: 'conditional',
          reason: 'Passport applications require verified address proof; Aadhaar provides the fastest paperless verification.',
          missingPrerequisites: ['Valid Aadhaar / Voter ID'],
          actionLink: '/services/aadhaar-card',
        };
      }

      return {
        status: 'eligible',
        reason: 'Citizenship and demographic prerequisites satisfied for Passport Seva appointment.',
        requiredDocuments: ['Proof of Address (Aadhaar/Utility)', 'Proof of Date of Birth (Birth Cert/PAN)', 'Non-ECR Proof (10th marksheet)'],
        actionLink: '/services/passport',
      };
    },
  },
];

export const evaluateAllSchemes = (profile) => {
  return SCHEME_EVALUATION_RULES.map((scheme) => {
    const verdict = scheme.evaluate(profile);
    return {
      schemeId: scheme.id,
      schemeName: scheme.name,
      category: scheme.category,
      benefit: scheme.benefit,
      ...verdict,
    };
  });
};

export const getSavedAssessments = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    logDiagnostic('Failed to parse assessments', err);
    return [];
  }
};

export const saveAssessment = (profile, evaluations) => {
  const all = getSavedAssessments();
  const eligibleCount = evaluations.filter((e) => e.status === 'eligible').length;
  const conditionalCount = evaluations.filter((e) => e.status === 'conditional').length;

  const newEntry = {
    id: `eval-${Date.now()}`,
    date: new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    profileSummary: {
      age: profile.age,
      annualIncome: profile.annualIncome,
      category: profile.category,
      employment: profile.employment,
      state: profile.state,
    },
    eligibleCount,
    conditionalCount,
    totalEvaluated: evaluations.length,
    results: evaluations,
  };

  const updated = [newEntry, ...all];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return newEntry;
};

export const deleteAssessment = (id) => {
  const all = getSavedAssessments();
  const updated = all.filter((a) => a.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
};
