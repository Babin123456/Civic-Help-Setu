import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AgentIncidentResponseDashboard from './AgentIncidentResponseDashboard.jsx';
import { civicAgentIncidentResponse, BREAKER_STATES } from '../../services/incidentResponse/civicAgentIncidentResponseService.js';

describe('AgentIncidentResponseDashboard Component', () => {
  beforeEach(() => {
    civicAgentIncidentResponse.globalKillSwitchActive = false;
    civicAgentIncidentResponse.globalKillReason = null;
    civicAgentIncidentResponse.revokedTools.clear();
    civicAgentIncidentResponse.quarantinedQueue.length = 0;
  });

  it('renders operational dashboard with standby kill switch and agent breakers', () => {
    const html = renderToStaticMarkup(<AgentIncidentResponseDashboard />);

    expect(html).toContain('Civic Agent Incident Response &amp; Kill-Switch');
    expect(html).toContain('STANDBY (NORMAL)');
    expect(html).toContain('civic-assistant');
    expect(html).toContain('Per-Agent Circuit Breakers');
    expect(html).toContain('Tool Revocation Controls');
    expect(html).toContain('Queued-Job Quarantine');
  });

  it('renders active kill switch banner when global kill switch is engaged', () => {
    civicAgentIncidentResponse.engageGlobalKillSwitch({
      actorId: 'LEAD_MAINTAINER',
      reason: 'Upstream LLM provider degradation'
    });

    const html = renderToStaticMarkup(<AgentIncidentResponseDashboard />);
    expect(html).toContain('ACTIVE (HALTED)');
    expect(html).toContain('Upstream LLM provider degradation');
    expect(html).toContain('Disengage Kill-Switch');
  });

  it('renders open state badges when an agent breaker trips', () => {
    civicAgentIncidentResponse.tripBreaker('civic-assistant', {
      reason: 'Consecutive timeout threshold breached'
    });

    const html = renderToStaticMarkup(<AgentIncidentResponseDashboard />);
    expect(html).toContain('OPEN');
    expect(html).toContain('Reset Circuit');
    expect(html).toContain('Consecutive timeout threshold breached');
  });

  it('displays revoked tools accurately in tool controls', () => {
    civicAgentIncidentResponse.revokeTool({
      toolName: 'saveApplicationDraft',
      actorId: 'OPERATOR'
    });

    const html = renderToStaticMarkup(<AgentIncidentResponseDashboard />);
    expect(html).toContain('Restore Tool');
  });

  it('displays isolated job counts when quarantine is populated', () => {
    civicAgentIncidentResponse.quarantineJob({
      agentId: 'civic-assistant',
      payload: { query: 'test query' },
      reason: 'Loop anomaly'
    });

    const html = renderToStaticMarkup(<AgentIncidentResponseDashboard />);
    expect(html).toContain('1 Jobs Isolated');
  });
});
