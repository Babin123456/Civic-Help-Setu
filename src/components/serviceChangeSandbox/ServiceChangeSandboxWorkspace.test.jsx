import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ServiceChangeLoading,
  ServiceChangeEmpty,
  ServiceChangeError,
  ServiceChangeBlocked,
  ServiceChangePermissionDenied
} from './ServiceChangeStates';
import { SnapshotSelector } from './SnapshotSelector';
import { ComparisonResults } from './ComparisonResults';
import { listStagingSnapshots, listServiceVersions, listSyntheticJourneyPatterns } from '../../data/civicServiceChangeSandboxData.js';

const snapshots = listStagingSnapshots();
const serviceVersions = listServiceVersions();
const journeyPatterns = listSyntheticJourneyPatterns();
const snapshot = snapshots[0];

const fakeResult = {
  snapshot: {
    id: 'snapshot-income-certificate-v2-rollout',
    title: 'Income Certificate v2 rollout (optional bank statement)',
    status: 'reviewing',
    fromVersionId: 'svc-income-certificate-v1',
    toVersionId: 'svc-income-certificate-v2',
    productionWriteBlocked: true,
    humanApproved: false
  },
  baseline: {
    completionRate: 0.88,
    validationFailureRate: 0.06,
    accessibilityIssues: 0,
    documentDropOffRate: 0.12,
    averageCompletionTimeSeconds: 240
  },
  proposed: {
    completionRate: 0.85,
    validationFailureRate: 0.07,
    accessibilityIssues: 0,
    documentDropOffRate: 0.14,
    averageCompletionTimeSeconds: 260
  },
  comparison: {
    recommendation: 'proceed-with-caution',
    reasoning: 'Minor completion dip and longer completion time; optional step adds friction but no accessibility regression.',
    completionDelta: -0.03,
    validationFailureDelta: 0.01,
    accessibilityIssuesDelta: 0,
    completionTimeDeltaSeconds: 20,
    documentDropOffDelta: 0.02
  },
  reproducibility: { seed: 20261122, schemaVersion: 'civic-service-change-sandbox-v1', dataVersion: '2026-11-22' },
  isStale: false,
  disclaimer: 'Shadow-traffic comparison output is illustrative and untrusted.',
  untrusted: true,
  requiresHumanReview: true,
  journeyRuns: {
    baseline: [
      {
        journeyPatternId: 'journey-income-certificate-complete',
        serviceVersionId: 'svc-income-certificate-v1',
        replayCount: 1000,
        completionRate: 0.88,
        validationFailureRate: 0.06,
        accessibilityIssues: 0,
        documentDropOffRate: 0.12,
        averageCompletionTimeSeconds: 240,
        errors: [],
        illustrative: true,
        noCitizenData: true
      }
    ],
    proposed: [
      {
        journeyPatternId: 'journey-income-certificate-complete',
        serviceVersionId: 'svc-income-certificate-v2',
        replayCount: 1000,
        completionRate: 0.85,
        validationFailureRate: 0.07,
        accessibilityIssues: 0,
        documentDropOffRate: 0.14,
        averageCompletionTimeSeconds: 260,
        errors: [],
        illustrative: true,
        noCitizenData: true
      }
    ]
  }
};

describe('ServiceChange states', () => {
  it('renders loading state', () => {
    const html = renderToStaticMarkup(<ServiceChangeLoading />);
    expect(html).toContain('Preparing shadow-traffic run');
  });

  it('renders empty state', () => {
    const html = renderToStaticMarkup(<ServiceChangeEmpty />);
    expect(html).toContain('No snapshot selected');
  });

  it('renders error state with message and retry', () => {
    const html = renderToStaticMarkup(<ServiceChangeError message="Boom" onRetry={() => {}} />);
    expect(html).toContain('Sandbox error');
    expect(html).toContain('Boom');
    expect(html).toContain('Retry');
  });

  it('renders blocked state', () => {
    const html = renderToStaticMarkup(<ServiceChangeBlocked message="Production writes blocked" onRetry={() => {}} />);
    expect(html).toContain('Production writes blocked');
    expect(html).toContain('Retry after unblocking');
  });

  it('renders permission denied state', () => {
    const html = renderToStaticMarkup(<ServiceChangePermissionDenied />);
    expect(html).toContain('Authentication required');
  });
});

describe('SnapshotSelector static markup', () => {
  it('renders snapshot, version, pattern, replay and run controls', () => {
    const html = renderToStaticMarkup(
      <SnapshotSelector
        snapshots={snapshots}
        serviceVersions={serviceVersions}
        journeyPatterns={journeyPatterns}
        onParametersChange={() => {}}
        defaultSnapshotId={snapshot.id}
      />
    );
    expect(html).toContain('Configure shadow-traffic run');
    expect(html).toContain(snapshot.title);
    expect(html).toContain('Journey patterns to replay');
    expect(html).toContain('Replay count');
    expect(html).toContain('Deterministic seed');
    expect(html).toContain('Run shadow traffic');
    expect(html).toContain('Shadow traffic never writes to production');
  });
});

describe('ComparisonResults static markup', () => {
  it('renders baseline vs proposed, deltas and recommendation', () => {
    const html = renderToStaticMarkup(<ComparisonResults result={fakeResult} />);
    expect(html).toContain('Shadow-traffic comparison');
    expect(html).toContain('Baseline vs proposed');
    expect(html).toContain('Completion rate');
    expect(html).toContain('Validation failure rate');
    expect(html).toContain('Accessibility issues');
    expect(html).toContain('Recommendation');
    expect(html).toContain('Proceed with caution');
    expect(html).toContain('illustrative');
  });
});
