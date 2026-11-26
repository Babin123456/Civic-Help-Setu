/**
 * @file civicServiceUncertaintyNavigatorService.js
 * @description Intelligent civic service guidance agent featuring explicit uncertainty detection.
 * When citizen requests are ambiguous, across conflicting jurisdictions, or lack authoritative backing,
 * it avoids hallucinating advice and routes to clarifying questionnaires or human help desks.
 */

export class CivicServiceUncertaintyNavigatorService {
  constructor(options = {}) {
    this.confidenceThreshold = options.confidenceThreshold || 0.75;
    this.knownJurisdictions = ['IN-KA', 'IN-DL', 'IN-MH', 'IN-TN', 'IN-UP', 'IN-CENTRAL'];
    this.serviceCatalog = [
      {
        serviceId: 'srv_birth_cert_ka',
        title: 'Application for Birth Certificate (Karnataka - e-Janma)',
        jurisdictionId: 'IN-KA',
        keywords: ['birth', 'certificate', 'janma', 'karnataka', 'bangalore', 'bbmp'],
        officialPortalUrl: 'https://ejanma.karnataka.gov.in',
        authority: 'Directorate of Economics and Statistics, Karnataka'
      },
      {
        serviceId: 'srv_income_cert_dl',
        title: 'Issuance of Income Certificate (Delhi - e-District)',
        jurisdictionId: 'IN-DL',
        keywords: ['income', 'certificate', 'delhi', 'revenue', 'sdm'],
        officialPortalUrl: 'https://edistrict.delhigovt.nic.in',
        authority: 'Revenue Department, Govt of NCT of Delhi'
      },
      {
        serviceId: 'srv_passport_fresh_central',
        title: 'Fresh Passport Application (Passport Seva)',
        jurisdictionId: 'IN-CENTRAL',
        keywords: ['passport', 'tatkal', 'ministry of external affairs', 'rpo'],
        officialPortalUrl: 'https://passportindia.gov.in',
        authority: 'CPV Division, Ministry of External Affairs, Govt of India'
      }
    ];
  }

  /**
   * Evaluates citizen query, detects ambiguity, and routes with explicit uncertainty handling.
   */
  navigate(query, citizenContext = {}) {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return {
        status: 'INVALID_QUERY',
        recommendation: null,
        uncertainty: { isUncertain: true, reason: 'Empty query received' }
      };
    }

    const q = query.toLowerCase().trim();
    const detectedJurisdiction = citizenContext.jurisdictionId || this.extractJurisdiction(q);

    // 1. Check for extreme brevity or missing context
    if (q.split(/\s+/).length <= 2 && !q.includes('passport')) {
      return {
        status: 'AMBIGUOUS_INPUT',
        uncertainty: {
          isUncertain: true,
          score: 0.9,
          reason: 'Query is overly brief. Service and state jurisdiction are ambiguous.'
        },
        clarificationNeeded: {
          questions: [
            'Which specific service are you looking for (e.g. Birth Certificate, Caste Certificate, Land Records)?',
            'In which Indian state or union territory do you reside?'
          ]
        },
        escalation: {
          canEscalateToHuman: true,
          helpline: '1800-11-CIVIC'
        }
      };
    }

    // 2. Search catalog matches
    const scoredMatches = this.serviceCatalog.map(item => {
      let score = 0;
      item.keywords.forEach(kw => {
        if (q.includes(kw)) score += 0.25;
      });

      if (detectedJurisdiction && item.jurisdictionId === detectedJurisdiction) {
        score += 0.35;
      }

      return {
        service: item,
        score: Math.min(score, 1.0)
      };
    }).sort((a, b) => b.score - a.score);

    const bestMatch = scoredMatches[0];

    // 3. Uncertainty evaluation
    if (!bestMatch || bestMatch.score < this.confidenceThreshold) {
      return {
        status: 'UNCERTAIN_ROUTING',
        uncertainty: {
          isUncertain: true,
          score: 1.0 - (bestMatch?.score || 0),
          reason: 'No authoritative civic rule matched query with high confidence.'
        },
        candidateServices: scoredMatches.filter(m => m.score > 0.2).map(m => ({
          serviceId: m.service.serviceId,
          title: m.service.title,
          jurisdictionId: m.service.jurisdictionId,
          confidence: Number(m.score.toFixed(2))
        })),
        escalation: {
          canEscalateToHuman: true,
          notice: 'Routing to citizen service desk for human triage.'
        }
      };
    }

    // 4. Confident route
    return {
      status: 'CONFIDENT_GUIDANCE',
      uncertainty: {
        isUncertain: false,
        score: Number((1.0 - bestMatch.score).toFixed(2))
      },
      recommendedService: {
        serviceId: bestMatch.service.serviceId,
        title: bestMatch.service.title,
        jurisdictionId: bestMatch.service.jurisdictionId,
        authority: bestMatch.service.authority,
        officialPortalUrl: bestMatch.service.officialPortalUrl,
        confidence: Number(bestMatch.score.toFixed(2))
      }
    };
  }

  extractJurisdiction(text) {
    if (text.includes('karnataka') || text.includes('bangalore') || text.includes('bengaluru')) return 'IN-KA';
    if (text.includes('delhi') || text.includes('new delhi')) return 'IN-DL';
    if (text.includes('maharashtra') || text.includes('mumbai') || text.includes('pune')) return 'IN-MH';
    return null;
  }
}

export const defaultServiceNavigator = new CivicServiceUncertaintyNavigatorService();
