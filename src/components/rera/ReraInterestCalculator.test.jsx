import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ReraInterestCalculator from './ReraInterestCalculator.jsx';
import { RERA_RELIEF_TYPE } from '../../services/reraDisputeService.js';

describe('ReraInterestCalculator Component (#858 follow-up)', () => {
  it('renders input controls and statutory explanation', () => {
    const html = renderToStaticMarkup(
      <ReraInterestCalculator
        committedPossessionDate="2023-01-01"
        gracePeriodMonths={3}
        totalAgreementCostInr={6000000}
        totalPaidInr={5000000}
        annualInterestRate={10.75}
        reliefType={RERA_RELIEF_TYPE.POSSESSION_DELAY_INTEREST}
      />
    );

    expect(html).toContain('RERA Section 18 Statutory Delay Interest &amp; Refund Calculator');
    expect(html).toContain('Committed Possession Date');
    expect(html).toContain('Grace Period (Months)');
    expect(html).toContain('Total Amount Paid by You (Rs.)');
    expect(html).toContain('Statutory Annual Interest Rate (%)');
    expect(html).toContain('Option B: Stay in Project &amp; Claim Delay Compensation');
    expect(html).toContain('Option A: Withdraw from Project &amp; Demand Full Refund');
  });

  it('renders calculation summary with delay duration and monthly compensation', () => {
    const html = renderToStaticMarkup(
      <ReraInterestCalculator
        committedPossessionDate="2022-01-01"
        gracePeriodMonths={0}
        totalAgreementCostInr={5000000}
        totalPaidInr={4000000}
        annualInterestRate={10.75}
        reliefType={RERA_RELIEF_TYPE.POSSESSION_DELAY_INTEREST}
      />
    );

    expect(html).toContain('Statutory Calculation Summary');
    expect(html).toContain('DELAYED BY');
    expect(html).toContain('Monthly Compensation Owed');
    expect(html).toContain('Accrued Delay Interest to Date');
    expect(html).toContain('Section 18(1) Second Proviso');
  });

  it('renders withdrawal refund summary when Option A is selected', () => {
    const html = renderToStaticMarkup(
      <ReraInterestCalculator
        committedPossessionDate="2023-01-01"
        gracePeriodMonths={0}
        totalAgreementCostInr={6000000}
        totalPaidInr={5000000}
        annualInterestRate={10.75}
        reliefType={RERA_RELIEF_TYPE.WITHDRAWAL_REFUND}
      />
    );

    expect(html).toContain('Total Refund Claimable (Principal + Interest)');
    expect(html).toContain('Section 18(1) First Proviso');
  });
});
