/**
 * src/components/admin/CivicChaosResiliencePanel.test.jsx
 * UI Component tests for CivicChaosResiliencePanel (#1192).
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CivicChaosResiliencePanel from './CivicChaosResiliencePanel.jsx';
import { resetResilienceState } from '../../services/civicChaosResilienceService.js';

describe('CivicChaosResiliencePanel Component (#1192)', () => {
  beforeEach(() => {
    resetResilienceState();
  });

  const renderPanel = () => {
    return renderToStaticMarkup(<CivicChaosResiliencePanel />);
  };

  it('renders all 5 core dependency status cards and recovery objectives', () => {
    const html = renderPanel();

    expect(html).toContain('Civic Operations Chaos Engineering &amp; Resilience Test Suite');
    expect(html).toContain('dep-card-firebase');
    expect(html).toContain('dep-card-model_providers');
    expect(html).toContain('dep-card-maps');
    expect(html).toContain('dep-card-email');
    expect(html).toContain('dep-card-storage');
    expect(html).toContain('Target RTO:');
    expect(html).toContain('RPO: 0s');
  });

  it('renders emergency kill switch button and test mode status badge', () => {
    const html = renderPanel();

    expect(html).toContain('data-testid="global-kill-switch-btn"');
    expect(html).toContain('EMERGENCY KILL SWITCH');
    expect(html).toContain('Test Mode Ready');
  });

  it('renders controlled drill scenarios and preset dropdown', () => {
    const html = renderPanel();

    expect(html).toContain('data-testid="drill-scenario-select"');
    expect(html).toContain('Cascading Infra Blackout');
    expect(html).toContain('Launch Chaos Drill');
    expect(html).toContain('Run Automated Evaluation Suite');
  });

  it('renders citizen draft preservation section and storage queues', () => {
    const html = renderPanel();

    expect(html).toContain('Citizen Draft Preservation Verification (RPO = 0s)');
    expect(html).toContain('Simulate Citizen Draft Submission Under Chaos');
    expect(html).toContain('Offline Drafts');
    expect(html).toContain('Dead-Letter Emails');
    expect(html).toContain('Storage Upload Queue');
  });

  it('renders operational runbooks and associated kill switches', () => {
    const html = renderPanel();

    expect(html).toContain('Operational Runbooks &amp; Checklists');
    expect(html).toContain('RB-CHAOS-001');
    expect(html).toContain('Firebase Disruption &amp; Auth/Store Degradation Runbook');
    expect(html).toContain('Associated Safe Kill Switch:');
  });
});
