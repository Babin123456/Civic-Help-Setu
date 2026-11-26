import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import EligibilitySimulationWorkspace from './EligibilitySimulationWorkspace.jsx';
import OfficialGuidanceDisclaimer from './OfficialGuidanceDisclaimer.jsx';
import ConditionAuditTree from './ConditionAuditTree.jsx';
import CounterfactualPathCard from './CounterfactualPathCard.jsx';

describe('EligibilitySimulationWorkspace UI components', () => {
  describe('OfficialGuidanceDisclaimer', () => {
    it('renders statutory non-determination warning', () => {
      const html = renderToStaticMarkup(<OfficialGuidanceDisclaimer />);
      expect(html).toContain('Not an Official Legal Determination');
      expect(html).toContain('STATUTORY NOTICE');
    });
  });

  describe('ConditionAuditTree', () => {
    it('renders satisfied, unsatisfied, and boundary condition states with citations', () => {
      const mockCriteria = [
        {
          id: 'crit-1',
          label: 'Income Ceiling Condition',
          state: 'satisfied',
          detail: 'Income is ₹2,00,000.',
          citation: { authority: 'Ministry of Agriculture', orderNo: 'ORD-101' },
        },
        {
          id: 'crit-2',
          label: 'Aadhaar e-KYC',
          state: 'unsatisfied',
          detail: 'Aadhaar not linked.',
          citation: { authority: 'UIDAI', orderNo: 'DBT-55' },
        },
      ];

      const html = renderToStaticMarkup(<ConditionAuditTree criteria={mockCriteria} />);
      expect(html).toContain('Income Ceiling Condition');
      expect(html).toContain('Statutory Requirement Satisfied');
      expect(html).toContain('Aadhaar e-KYC');
      expect(html).toContain('Requirement Not Currently Met');
      expect(html).toContain('Ministry of Agriculture');
    });
  });

  describe('CounterfactualPathCard', () => {
    it('renders actionable counterfactual suggestions with difficulty badge', () => {
      const mockCf = {
        id: 'cf-test',
        targetStatus: 'ELIGIBLE',
        difficulty: 'easy',
        summary: 'Link Aadhaar card for DBT verification.',
        changes: [
          {
            field: 'hasAadhaar',
            from: false,
            to: true,
            description: 'Link Aadhaar card with bank account.',
            actionLink: '/services/aadhaar-guide',
          },
        ],
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <CounterfactualPathCard counterfactual={mockCf} onApply={() => {}} />
        </MemoryRouter>
      );

      expect(html).toContain('What-If Recourse Scenario');
      expect(html).toContain('Direct / Document Action');
      expect(html).toContain('Outcome: ELIGIBLE');
      expect(html).toContain('Link Aadhaar card with bank account.');
      expect(html).toContain('Apply Scenario to Live Simulator');
    });
  });

  describe('EligibilitySimulationWorkspace', () => {
    it('renders the complete workspace slice with scheme selector and what-if inputs', () => {
      const initial = {
        annualIncome: 300000,
        employment: 'farmer',
        ownsAgriculturalLand: true,
        hasAadhaar: true,
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <EligibilitySimulationWorkspace initialProfile={initial} />
        </MemoryRouter>
      );

      expect(html).toContain('Select Statutory Scheme / Civic Rule Graph to Simulate');
      expect(html).toContain('Hypothetical What-If Inputs');
      expect(html).toContain('Simulation Outcome');
      expect(html).toContain('Detailed Condition Audit Trace');
      expect(html).toContain('Not an Official Legal Determination');
    });
  });
});
