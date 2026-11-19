import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import AddressChangePlanner from './AddressChangePlanner';
import RecordDetailModal from '../components/addressChange/RecordDetailModal';
import AddressChangePrintReportModal from '../components/addressChange/AddressChangePrintReportModal';
import AddressChangeEmptyState from '../components/addressChange/AddressChangeEmptyState';
import AddressChangeErrorState from '../components/addressChange/AddressChangeErrorState';
import AddressChangeSkeleton from '../components/addressChange/AddressChangeSkeleton';
import { ToastProvider } from '../context/ToastContext';
import { VERIFIED_ADDRESS_CHANGE_RECORDS } from '../data/addressChangeRecords';
import { filterRecordsForPlan, sortRecordsByDependency, calculatePlanReadiness } from '../services/addressChangeService';

describe('AddressChangePlanner & Components (#725)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    });
  });

  const renderPlanner = () => {
    return renderToStaticMarkup(
      <MemoryRouter>
        <ToastProvider>
          <AddressChangePlanner />
        </ToastProvider>
      </MemoryRouter>
    );
  };

  it('renders planner title, non-transactional guardrail, and step wizard', () => {
    const html = renderPlanner();

    expect(html).toContain('Civic Moving-Home Address-Change Action Planner');
    expect(html).toContain('Non-Transactional Planning Guardrail:');
    expect(html).toContain('Step 1: Choose Your Relocation Scope');
    expect(html).toContain('Step 2: Select Records to Update');
    expect(html).toContain('Address Update Action Plan');
    expect(html).toContain('Aadhaar Identity &amp; Address Record Update');
    expect(html).toContain('Delete My Checklist Data');
  });

  it('isolates official instructions from editorial explanations in RecordDetailModal', () => {
    const aadhaarRecord = VERIFIED_ADDRESS_CHANGE_RECORDS.find((r) => r.id === 'aadhaar-address-update');
    expect(aadhaarRecord).toBeTruthy();

    const html = renderToStaticMarkup(
      <RecordDetailModal record={aadhaarRecord} onClose={() => {}} />
    );

    // Official instructions section
    expect(html).toContain('Official Government Notice / Gazette Text');
    expect(html).toContain('Regulation 3 of the Aadhaar (Enrolment and Update) Regulations, 2016');
    expect(html).toContain('Effective Date:');
    expect(html).toContain('Last Verified:');

    // Editorial tips section
    expect(html).toContain('Civic Help Setu Editorial Tip &amp; Practical Guidance');
    expect(html).toContain('Always update Aadhaar as your very first step when moving');

    // Accepted proofs
    expect(html).toContain('Accepted Proof of Address (POA) &amp; Evidence');
    expect(html).toContain('Registered Rent / Lease Agreement');
  });

  it('displays explicit unverified/unavailable notice without guessing requirements (#725 Req 7)', () => {
    const rationRecord = VERIFIED_ADDRESS_CHANGE_RECORDS.find((r) => r.id === 'ration-card-address-transfer');
    expect(rationRecord.unavailableData.isUnavailable).toBe(true);

    const html = renderToStaticMarkup(
      <RecordDetailModal record={rationRecord} onClose={() => {}} />
    );

    expect(html).toContain('Unverified / State-Dependent Gaps (No Assumptions Made)');
    expect(html).toContain(rationRecord.unavailableData.reason);
  });

  it('renders clean printable report without credential fields', () => {
    const records = VERIFIED_ADDRESS_CHANGE_RECORDS.slice(0, 3);
    const planState = {
      moveType: 'inter_state',
      originState: 'Maharashtra',
      destinationState: 'Karnataka',
      items: {
        'aadhaar-address-update': {
          status: 'submitted',
          acknowledgementRef: 'URN-9988776655',
          submissionDate: '2026-03-01',
          completedProofs: ['Registered Rent / Lease Agreement'],
        },
      },
    };
    const readiness = calculatePlanReadiness(records, planState.items);

    const html = renderToStaticMarkup(
      <AddressChangePrintReportModal
        records={records}
        planState={planState}
        readiness={readiness}
        onClose={() => {}}
      />
    );

    expect(html).toContain('Printable Address Change Action Plan');
    expect(html).toContain('Scope: <strong>Inter-State (Relocating Across States)</strong>');
    expect(html).toContain('URN-9988776655');
    expect(html).toContain('Registered Rent / Lease Agreement');
    // Ensure no password input fields or sensitive token dumps
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain('biometricToken');
    expect(html).not.toContain('aadhaarNumber');
  });

  it('renders empty, error, and skeleton loading states properly', () => {
    const emptyHtml = renderToStaticMarkup(
      <AddressChangeEmptyState onResetSearch={() => {}} />
    );
    expect(emptyHtml).toContain('No Address Update Records Found');

    const errorHtml = renderToStaticMarkup(
      <AddressChangeErrorState error={new Error('Storage failure test')} onRetry={() => {}} />
    );
    expect(errorHtml).toContain('Unable to Load Address Planner Data');
    expect(errorHtml).toContain('Storage failure test');

    const skeletonHtml = renderToStaticMarkup(<AddressChangeSkeleton />);
    expect(skeletonHtml).toContain('aria-busy="true"');
  });

  it('supports jurisdiction switching and dependency sorting', () => {
    const sameCity = filterRecordsForPlan(VERIFIED_ADDRESS_CHANGE_RECORDS, { moveType: 'same_city' });
    const interState = filterRecordsForPlan(VERIFIED_ADDRESS_CHANGE_RECORDS, { moveType: 'inter_state' });

    expect(sameCity.length).toBeGreaterThan(0);
    expect(interState.length).toBeGreaterThan(0);

    const sorted = sortRecordsByDependency(interState);
    expect(sorted[0].id).toBe('aadhaar-address-update');
  });
});

