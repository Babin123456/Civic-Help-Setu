import { describe, it, expect } from 'vitest';
import {
  evaluatePairwiseConvergence,
  analyzeSchemePortfolioConvergence,
  formatConvergenceReport,
  clusterSchemesByBenefitSector,
  CONVERGENCE_STATUS,
  SCHEME_CONVERGENCE_DISCLAIMER,
} from './civicSchemeConvergenceAnalyzerService.js';

describe('Civic Scheme Convergence Analyzer Service', () => {
  const pmKisan = {
    id: 'pm-kisan',
    name: 'PM-KISAN Samman Nidhi',
    level: 'CENTRAL',
    benefitType: 'CASH_TRANSFER',
  };

  const stateRythu = {
    id: 'rythu-bandhu',
    name: 'Rythu Bandhu Investment Support',
    level: 'STATE',
    benefitType: 'CASH_TRANSFER',
  };

  const pmJay = {
    id: 'pm-jay',
    name: 'Ayushman Bharat PM-JAY',
    level: 'CENTRAL',
    benefitType: 'HEALTH_INSURANCE',
  };

  const localScholarship = {
    id: 'state-scholarship',
    name: 'Post-Matric Scholarship Scheme',
    level: 'STATE',
    benefitType: 'EDUCATION_GRANT',
  };

  const mockCirculars = [
    {
      id: 'circ-01',
      title: 'State Agriculture Coordination Memo',
      orderNumber: 'AGR/2023/88',
      text: 'Farmers receiving PM-KISAN are eligible for Rythu Bandhu as a top-up supplement subject to landholding ceiling.',
    },
    {
      id: 'circ-02',
      title: 'Pension Non-Duplication Order',
      orderNumber: 'SOC/2024/12',
      text: 'Beneficiaries of old-age pension scheme A shall not be entitled to concurrently avail state disability pension B; mutually exclusive under Section 4.',
    },
  ];

  it('evaluates complementary schemes across different benefit sectors', () => {
    const res = evaluatePairwiseConvergence(pmKisan, pmJay, mockCirculars);
    expect(res.status).toBe(CONVERGENCE_STATUS.COMPLEMENTARY);
    expect(res.reason).toContain('different welfare dimensions');
  });

  it('identifies conditional top-up convergence with verified circular citation', () => {
    const res = evaluatePairwiseConvergence(pmKisan, stateRythu, mockCirculars);
    expect(res.status).toBe(CONVERGENCE_STATUS.CONDITIONAL);
    expect(res.citation).toBeDefined();
    expect(res.citation.orderNumber).toBe('AGR/2023/88');
  });

  it('identifies restricted schemes with statutory non-duplication clause', () => {
    const schemeA = { id: 'old-age-pension', name: 'old-age pension scheme A', level: 'STATE', benefitType: 'PENSION' };
    const schemeB = { id: 'state-disability', name: 'state disability pension B', level: 'STATE', benefitType: 'PENSION' };

    const res = evaluatePairwiseConvergence(schemeA, schemeB, mockCirculars);
    expect(res.status).toBe(CONVERGENCE_STATUS.RESTRICTED);
    expect(res.citation.orderNumber).toBe('SOC/2024/12');
  });

  it('treats undocumented overlap as UNKNOWN and never infers restriction from silence', () => {
    const schemeX = { id: 'housing-pmay', name: 'PMAY Urban', level: 'CENTRAL', benefitType: 'HOUSING' };
    const schemeY = { id: 'housing-state', name: 'State Awaas Yojana', level: 'STATE', benefitType: 'HOUSING' };

    const res = evaluatePairwiseConvergence(schemeX, schemeY, []); // Empty circular corpus
    expect(res.status).toBe(CONVERGENCE_STATUS.UNKNOWN);
    expect(res.reason).toContain('no published convergence or exclusion directive');
  });

  it('formats markdown advisory report cleanly', () => {
    const portfolio = [pmKisan, pmJay];
    const report = analyzeSchemePortfolioConvergence(portfolio, mockCirculars);
    const md = formatConvergenceReport(report);
    expect(md).toContain('# Civic Scheme Convergence Advisory');
    expect(md).toContain('COMPLEMENTARY');
    expect(md).toContain(SCHEME_CONVERGENCE_DISCLAIMER);
  });
});
