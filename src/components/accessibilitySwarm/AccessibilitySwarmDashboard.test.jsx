import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AccessibilitySwarmDashboard from './AccessibilitySwarmDashboard.jsx';
import {
  AGENT_MODALITIES,
  FINDING_SEVERITY,
  VERIFICATION_STATUS
} from '../../services/accessibilitySwarm/swarmSchemas.js';

describe('AccessibilitySwarmDashboard Component (#1177)', () => {
  const mockReport = {
    runId: 'test_run_1',
    healthScore: 78,
    clusters: [
      {
        clusterId: 'cluster_1',
        rootCauseSummary: 'Interactive div lacking keyboard focus and button role',
        severity: FINDING_SEVERITY.HIGH,
        primaryModality: AGENT_MODALITIES.KEYBOARD,
        modalitiesInvolved: [AGENT_MODALITIES.KEYBOARD, AGENT_MODALITIES.SCREEN_READER],
        targetSelector: 'div[onclick]',
        count: 2
      }
    ],
    findings: [
      {
        id: 'find_subj_1',
        modality: AGENT_MODALITIES.LANGUAGE_CLARITY,
        title: 'Complex bureaucratic jargon found in public citizen instructions',
        description: 'Contains archaic terms: mutatis mutandis',
        remedyRecommendation: 'Replace with plain language equivalents',
        verificationStatus: VERIFICATION_STATUS.UNVERIFIED_SUGGESTION
      }
    ]
  };

  it('renders dashboard with title, metrics and clusters', () => {
    const html = renderToStaticMarkup(<AccessibilitySwarmDashboard auditReport={mockReport} />);

    expect(html).toContain('Multi-Modal Accessibility Swarm');
    expect(html).toContain('78/100');
    expect(html).toContain('Interactive div lacking keyboard focus');
    expect(html).toContain('Run Swarm Audit');
    expect(html).toContain('Non-AI Fallback Only');
  });

  it('renders empty cluster state cleanly', () => {
    const html = renderToStaticMarkup(<AccessibilitySwarmDashboard auditReport={{ clusters: [] }} />);

    expect(html).toContain('No defects discovered in this filter slice');
    expect(html).toContain('100/100');
  });
});
