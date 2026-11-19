import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import PublicToiletDirectory from './PublicToiletDirectory';
import ToiletCard from '../components/toilets/ToiletCard';
import ToiletDetailModal from '../components/toilets/ToiletDetailModal';
import ToiletIssueReportModal from '../components/toilets/ToiletIssueReportModal';
import ToiletCleaningLogModal from '../components/toilets/ToiletCleaningLogModal';
import ToiletMaintenanceModal from '../components/toilets/ToiletMaintenanceModal';
import ToiletRecommendationsCard from '../components/toilets/ToiletRecommendationsCard';
import {
  ToiletSkeleton,
  ToiletEmptyState,
  ToiletErrorState,
  ToiletStaleDataNotice,
  ToiletOfflineNotice,
  ToiletPermissionDeniedState,
} from '../components/toilets/ToiletStates';
import { resetToiletStorage } from '../services/publicToiletStorage';
import { ToastProvider } from '../context/ToastContext';
import { NetworkProvider } from '../context/NetworkContext';
import { SEED_PUBLIC_TOILETS } from '../data/publicToilets';

const renderDirectory = () => {
  return renderToString(
    <ToastProvider>
      <NetworkProvider>
        <PublicToiletDirectory />
      </NetworkProvider>
    </ToastProvider>
  );
};

describe('PublicToiletDirectory Workspace & UI Components (#758)', () => {
  beforeEach(() => {
    resetToiletStorage();
  });

  it('renders directory heading, municipal badge, and initial seeded toilet facilities', () => {
    const html = renderDirectory();
    expect(html).toContain('Public Toilet Availability &amp; Maintenance Directory');
    expect(html).toContain('Verified Municipal Service');
    expect(html).toContain('Koramangala 5th Block Community Sanitation Complex');
    expect(html).toContain('MG Road Metro Station North Concourse Restrooms');
    expect(html).toContain('Connaught Place Central Park She-Toilet Complex');
  });

  it('renders search and multi-facet accessibility filter controls', () => {
    const html = renderDirectory();
    expect(html).toContain('Search &amp; Facility Filters');
    expect(html).toContain('Search by Name, Ward or Landmark');
    expect(html).toContain('Wheelchair Ramp &amp; Grab Bars');
    expect(html).toContain('Gender-Neutral / Third-Gender');
    expect(html).toContain('Baby Diaper Station');
    expect(html).toContain('Sanitary Napkin Dispenser');
    expect(html).toContain('Running Water Confirmed');
  });

  it('renders ToiletCard with non-color status badges, accessibility tags, and factual timestamps', () => {
    const facility = SEED_PUBLIC_TOILETS[0];
    const html = renderToString(
      <ToastProvider>
        <ToiletCard facility={facility} isOperator={false} />
      </ToastProvider>
    );

    expect(html).toContain('Koramangala 5th Block Community Sanitation Complex');
    expect(html).toContain('Open Now');
    expect(html).toContain('Free Public Facility');
    expect(html).toContain('Accessible Ramp');
    expect(html).toContain('All-Gender / Neutral');
    expect(html).toContain('Baby Care');
    expect(html).toContain('Details &amp; Hours');
    expect(html).toContain('Report Issue');
  });

  it('renders ToiletCard in operator mode with staff actions', () => {
    const facility = SEED_PUBLIC_TOILETS[0];
    const html = renderToString(
      <ToastProvider>
        <ToiletCard facility={facility} isOperator={true} />
      </ToastProvider>
    );

    expect(html).toContain('Log Cleaning');
    expect(html).toContain('Maintenance');
  });

  it('renders ToiletDetailModal with operating hours schedule and quality audit', () => {
    const facility = SEED_PUBLIC_TOILETS[0];
    const html = renderToString(
      <ToastProvider>
        <ToiletDetailModal facility={facility} onClose={() => {}} />
      </ToastProvider>
    );

    expect(html).toContain('Operating Hours &amp; Schedule');
    expect(html).toContain('Accessibility &amp; Fixture Specifications');
    expect(html).toContain('Factual Verification &amp; Quality Audit');
    expect(html).toContain('Swachh Survekshan ULB Field Inspection Wing');
    expect(html).toContain('Audit Quality Score:');
  });

  it('renders ToiletIssueReportModal with zero-PII advisory and category selector', () => {
    const facility = SEED_PUBLIC_TOILETS[0];
    const html = renderToString(
      <ToastProvider>
        <ToiletIssueReportModal facility={facility} onClose={() => {}} />
      </ToastProvider>
    );

    expect(html).toContain('Report Issue or Cleanliness Observation');
    expect(html).toContain('Zero-PII Notice: Do not include phone numbers, names, or private information.');
    expect(html).toContain('Issue Category');
    expect(html).toContain('Severity');
  });

  it('renders ToiletCleaningLogModal with statutory verification checklist', () => {
    const facility = SEED_PUBLIC_TOILETS[0];
    const html = renderToString(
      <ToastProvider>
        <ToiletCleaningLogModal facility={facility} onClose={() => {}} />
      </ToastProvider>
    );

    expect(html).toContain('Log Supervisor Sanitation Run');
    expect(html).toContain('Statutory Cleaning Verification Checklist');
    expect(html).toContain('Water supply &amp; overhead cistern level verified');
    expect(html).toContain('Floor scrubbed &amp; phenolic disinfectant applied');
    expect(html).toContain('Liquid hand soap &amp; consumables refilled');
  });

  it('renders ToiletMaintenanceModal with closure controls and work orders', () => {
    const facility = SEED_PUBLIC_TOILETS[3]; // Dadar facility with maintenance
    const html = renderToString(
      <ToastProvider>
        <ToiletMaintenanceModal facility={facility} onClose={() => {}} />
      </ToastProvider>
    );

    expect(html).toContain('Operator Maintenance &amp; Closure Controls');
    expect(html).toContain('Temporary Emergency / Overhaul Closure');
    expect(html).toContain('Maintenance Tickets');
  });

  it('renders ToiletRecommendationsCard with explainable AI source fields and human controls', () => {
    const recommendations = [
      {
        id: 'rec-test-01',
        title: 'Sanitation Sweep Overdue',
        severity: 'high',
        summary: 'Facility has not had an audited cleaning event for 6 hours.',
        suggestedAction: 'Dispatch sanitation team immediately.',
        rulesetVersion: '1.0.0-deterministic',
        executionTimestamp: new Date().toISOString(),
        explainability: {
          influencingFields: ['facility.status', 'facility.lastCleanedAt'],
          observedValue: '6 hours since last log',
          thresholdRule: 'Exceeded statutory 4-hour threshold',
        },
      },
    ];

    const html = renderToString(
      <ToastProvider>
        <ToiletRecommendationsCard recommendations={recommendations} />
      </ToastProvider>
    );

    expect(html).toContain('Bounded Sanitation Intelligence &amp; Operational Insights');
    expect(html).toContain('Sanitation Sweep Overdue');
    expect(html).toContain('PRIORITY');
    expect(html).toContain('facility.status, facility.lastCleanedAt');
    expect(html).toContain('Accept Recommendation');
    expect(html).toContain('Modify Action');
    expect(html).toContain('Dismiss');
  });

  it('renders the 6 mandatory UI states cleanly', () => {
    const skeletonHtml = renderToString(<ToiletSkeleton />);
    expect(skeletonHtml).toContain('Loading public sanitation facilities');

    const emptyHtml = renderToString(<ToiletEmptyState onReset={() => {}} />);
    expect(emptyHtml).toContain('No Facilities Match Your Filters');

    const errorHtml = renderToString(<ToiletErrorState error="Connection timeout" onRetry={() => {}} />);
    expect(errorHtml).toContain('Unable to Load Sanitation Data');
    expect(errorHtml).toContain('Connection timeout');

    const staleHtml = renderToString(<ToiletStaleDataNotice lastSynced={new Date().toISOString()} />);
    expect(staleHtml).toContain('Last synchronized with municipal registry');

    const offlineHtml = renderToString(<ToiletOfflineNotice />);
    expect(offlineHtml).toContain('Offline Mode:');

    const deniedHtml = renderToString(<ToiletPermissionDeniedState message="Operator clearance required." />);
    expect(deniedHtml).toContain('Restricted Action');
    expect(deniedHtml).toContain('Operator clearance required.');
  });
});
