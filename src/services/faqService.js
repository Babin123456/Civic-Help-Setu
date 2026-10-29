/**
 * FAQ Service: Searches and matches FAQs from the civic knowledge base
 * and manages user feedback/votes on helpfulness.
 */
import { FAQ_DATABASE } from '../data/faq_database.js';
import { logDiagnostic } from '../utils/diagnostics';

const FAQ_VOTES_KEY = 'civicbridge_faq_votes';

// Specific high-frequency civic FAQs to enrich services
const CURATED_SERVICE_FAQS = {
  'passport': [
    {
      id: 'faq-pass-1',
      question: 'Can I apply under Tatkaal scheme if I do not have a verification certificate?',
      answer: 'Yes. Under revised Passport Rules, Annexure F (Verification Certificate) is no longer mandatory for Tatkaal. You can submit any 3 eligible identity documents (e.g., Aadhaar, PAN card, Voter ID, Service ID) along with standard address proof.',
      category: 'Tatkaal & Urgency'
    },
    {
      id: 'faq-pass-2',
      question: 'Is police verification required before passport dispatch for renewals?',
      answer: 'For standard renewal of passports within 3 years of expiry where personal particulars remain unchanged, post-police verification or no police verification is granted at the discretion of the Regional Passport Office.',
      category: 'Police Verification'
    },
    {
      id: 'faq-pass-3',
      question: 'What should I do if my current address differs from the address on my Aadhaar?',
      answer: 'You must provide a valid secondary proof of current address (such as a registered rent agreement, active utility bill, or bank passbook with photo) and specify your current residential tenure in Form No. 1.',
      category: 'Address & Documents'
    }
  ],
  'pan-card': [
    {
      id: 'faq-pan-1',
      question: 'How long does it take to receive an e-PAN vs a physical plastic card?',
      answer: 'Instant e-PAN via Aadhaar OTP is generated in 10-15 minutes. A physical embossed PVC card is printed by Protean (NSDL) / UTIITSL and dispatched via India Post Speed Post within 7 to 14 business days.',
      category: 'Timeline & Delivery'
    },
    {
      id: 'faq-pan-2',
      question: 'Can I update my surname on PAN card without changing my PAN number?',
      answer: 'Yes. Your 10-digit alphanumeric Permanent Account Number remains permanent for life. Use Form 49A (Correction in Existing PAN) to update surname, father\'s name, or photograph while retaining the same PAN.',
      category: 'Corrections'
    }
  ],
  'driving-license': [
    {
      id: 'faq-dl-1',
      question: 'How many days after obtaining a Learner\'s License can I take the Driving Skill Test?',
      answer: 'You can book your permanent driving test slot after a mandatory waiting period of 30 days from the date of issuance of the Learner\'s License, up to a maximum of 180 days (6 months).',
      category: 'Test & Eligibility'
    },
    {
      id: 'faq-dl-2',
      question: 'Is physical submission of documents needed under Sarathi Parivahan faceless services?',
      answer: 'In states offering Aadhaar-authenticated Faceless RTO services, no physical visit is needed for Learner\'s License or address change. However, permanent Driving License test requires physical presence at the Automated Driving Test Track.',
      category: 'Faceless Services'
    }
  ]
};

/**
 * Returns tailored FAQs for a given civic service
 */
export const getFaqsForService = (service) => {
  if (!service) return [];

  const results = [];
  const serviceId = service.id || '';
  const serviceName = (service.name || '').toLowerCase();
  const category = (service.category || '').toLowerCase();

  // 1. Add curated FAQs if available for this specific service
  if (CURATED_SERVICE_FAQS[serviceId]) {
    results.push(...CURATED_SERVICE_FAQS[serviceId]);
  }

  // 2. Extract keywords from service name and category
  const stopWords = new Set(['for', 'the', 'new', 'in', 'and', 'card', 'of', 'to', 'a', 'an']);
  const searchTerms = `${serviceName} ${category}`
    .split(/[\s-]+/)
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length > 2 && !stopWords.has(t));

  // 3. Search FAQ_DATABASE
  if (FAQ_DATABASE && Array.isArray(FAQ_DATABASE)) {
    const matchedFromDb = [];
    for (const item of FAQ_DATABASE) {
      if (!item || !item.keywords) continue;
      
      const matchScore = searchTerms.reduce((score, term) => {
        return item.keywords.includes(term) ? score + 1 : score;
      }, 0);

      if (matchScore >= 1) {
        matchedFromDb.push({
          id: `db-faq-${matchedFromDb.length + 1}-${item.title.substring(0, 10).replace(/\s+/g, '')}`,
          question: item.title,
          answer: item.summary,
          category: service.category || 'General Procedure',
          suggestions: item.suggestions || [],
          score: matchScore
        });
      }
      if (matchedFromDb.length >= 6) break;
    }

    // Sort by match relevance and take top 4
    matchedFromDb.sort((a, b) => b.score - a.score);
    results.push(...matchedFromDb.slice(0, 4));
  }

  // 4. Fallback if no matching FAQs found
  if (results.length === 0) {
    results.push(
      {
        id: 'faq-default-1',
        question: `What are the primary documents needed to apply for ${service.name}?`,
        answer: 'You will need Proof of Identity (Aadhaar, Voter ID, Passport), Proof of Address (Utility bill, Rent agreement), and 2 passport-size photographs.',
        category: 'Documents'
      },
      {
        id: 'faq-default-2',
        question: `How can I track my application status for ${service.name}?`,
        answer: 'You can use the official reference number provided at submission on the department portal, or enter your token number in the Civic Help Setu Tracking Dashboard.',
        category: 'Tracking'
      },
      {
        id: 'faq-default-3',
        question: `What is the standard turnaround time for ${service.name}?`,
        answer: `Processing usually takes between 7 to 30 working days depending on state administration schedules and verification stages.`,
        category: 'Processing Time'
      }
    );
  }

  return results;
};

/**
 * Get stored votes map { [faqId]: 'helpful' | 'not-helpful' }
 */
export const getUserFaqVotes = () => {
  try {
    return JSON.parse(localStorage.getItem(FAQ_VOTES_KEY) || '{}');
  } catch {
    return {};
  }
};

/**
 * Record user vote for a FAQ
 */
export const voteFaqHelpful = (faqId, isHelpful) => {
  try {
    const votes = getUserFaqVotes();
    votes[faqId] = isHelpful ? 'helpful' : 'not-helpful';
    localStorage.setItem(FAQ_VOTES_KEY, JSON.stringify(votes));
    return votes;
  } catch (e) {
    logDiagnostic('Error saving FAQ vote:', e);
    return {};
  }
};
