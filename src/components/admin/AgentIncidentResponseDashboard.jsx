import React, { useState, useEffect } from 'react';
import {
  civicAgentIncidentResponse,
  BREAKER_STATES,
  INCIDENT_SEVERITY
} from '../../services/incidentResponse/civicAgentIncidentResponseService.js';

export default function AgentIncidentResponseDashboard({
  initialSnapshot = null,
  onRefresh = null
}) {
  const [snapshot, setSnapshot] = useState(
    initialSnapshot || civicAgentIncidentResponse.getOperationalSnapshot()
  );
  const [reasonInput, setReasonInput] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('civic-assistant');
  const [selectedTool, setSelectedTool] = useState('saveApplicationDraft');
  const [incidentMessage, setIncidentMessage] = useState(null);
  const [confirmKillModal, setConfirmKillModal] = useState(false);

  const refreshState = () => {
    const updated = civicAgentIncidentResponse.getOperationalSnapshot();
    setSnapshot(updated);
    if (onRefresh) onRefresh(updated);
  };

  useEffect(() => {
    refreshState();
  }, []);

  const handleGlobalKillToggle = () => {
    if (snapshot.globalKillSwitch.active) {
      // Disengage using override for immediate administrative intervention
      try {
        civicAgentIncidentResponse.disengageGlobalKillSwitch({
          actorId: 'OPERATOR_CONSOLE',
          override: true
        });
        setIncidentMessage({ type: 'success', text: 'Global kill-switch successfully disengaged.' });
      } catch (err) {
        setIncidentMessage({ type: 'error', text: err.message });
      }
    } else {
      if (!reasonInput.trim()) {
        setIncidentMessage({ type: 'error', text: 'Please provide a valid incident justification.' });
        return;
      }
      civicAgentIncidentResponse.engageGlobalKillSwitch({
        actorId: 'OPERATOR_CONSOLE',
        reason: reasonInput.trim(),
        severity: INCIDENT_SEVERITY.P1_CRITICAL
      });
      setIncidentMessage({ type: 'warning', text: 'Global kill-switch engaged! All agent execution halted.' });
      setReasonInput('');
    }
    setConfirmKillModal(false);
    refreshState();
  };

  const handleTripBreaker = (agentId) => {
    civicAgentIncidentResponse.tripBreaker(agentId, {
      actorId: 'OPERATOR_CONSOLE',
      reason: reasonInput.trim() || 'Manual trip by incident responder',
      severity: INCIDENT_SEVERITY.P2_HIGH
    });
    setIncidentMessage({ type: 'warning', text: `Circuit breaker tripped for agent: ${agentId}` });
    refreshState();
  };

  const handleResetBreaker = (agentId) => {
    civicAgentIncidentResponse.resetBreaker(agentId, {
      actorId: 'OPERATOR_CONSOLE',
      reason: 'Manual reset and health restoration'
    });
    setIncidentMessage({ type: 'success', text: `Circuit breaker reset to CLOSED for agent: ${agentId}` });
    refreshState();
  };

  const handleToggleToolRevocation = (toolName) => {
    if (snapshot.revokedTools.includes(toolName)) {
      civicAgentIncidentResponse.restoreTool({
        toolName,
        actorId: 'OPERATOR_CONSOLE',
        reason: 'Administrative restoration'
      });
      setIncidentMessage({ type: 'success', text: `Tool restored: ${toolName}` });
    } else {
      civicAgentIncidentResponse.revokeTool({
        toolName,
        actorId: 'OPERATOR_CONSOLE',
        reason: reasonInput.trim() || 'Manual administrative revocation'
      });
      setIncidentMessage({ type: 'warning', text: `Tool revoked: ${toolName}` });
    }
    refreshState();
  };

  const handleDrainQuarantine = () => {
    const drained = civicAgentIncidentResponse.drainQuarantine({
      actorId: 'OPERATOR_CONSOLE',
      maxJobs: 10
    });
    setIncidentMessage({ type: 'info', text: `Drained ${drained.length} quarantined jobs from queue.` });
    refreshState();
  };

  return (
    <div
      role="region"
      aria-label="Agent Incident Response Console"
      className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-6 max-w-5xl mx-auto my-6"
    >
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            🛡️ Civic Agent Incident Response & Kill-Switch
          </h2>
          <p className="text-sm text-slate-600">
            Emergency orchestration controls, per-agent circuit breakers, and quarantined forensics.
          </p>
        </div>
        <button
          onClick={refreshState}
          className="px-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-100"
          aria-label="Refresh incident telemetry"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Incident Feedback Toast */}
      {incidentMessage && (
        <div
          role="alert"
          className={`p-3 rounded-lg text-sm font-medium ${
            incidentMessage.type === 'error'
              ? 'bg-rose-100 text-rose-800 border border-rose-300'
              : incidentMessage.type === 'warning'
              ? 'bg-amber-100 text-amber-800 border border-amber-300'
              : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
          }`}
        >
          {incidentMessage.text}
        </div>
      )}

      {/* Global Kill Switch Banner */}
      <div
        className={`p-5 rounded-xl border ${
          snapshot.globalKillSwitch.active
            ? 'bg-red-50 border-red-300 text-red-950'
            : 'bg-emerald-50 border-emerald-200 text-emerald-950'
        }`}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">Global AI Kill-Switch:</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                  snapshot.globalKillSwitch.active
                    ? 'bg-red-600 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
                data-testid="global-kill-switch-status"
              >
                {snapshot.globalKillSwitch.active ? 'ACTIVE (HALTED)' : 'STANDBY (NORMAL)'}
              </span>
            </div>
            {snapshot.globalKillSwitch.active && (
              <p className="text-sm mt-1 text-red-700">
                Reason: <strong>{snapshot.globalKillSwitch.reason}</strong> (Triggered by{' '}
                {snapshot.globalKillSwitch.actor})
              </p>
            )}
          </div>

          <button
            onClick={() => setConfirmKillModal(true)}
            data-testid="toggle-global-kill-switch-btn"
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
              snapshot.globalKillSwitch.active
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {snapshot.globalKillSwitch.active ? 'Disengage Kill-Switch' : '🚨 ENGAGE GLOBAL KILL-SWITCH'}
          </button>
        </div>
      </div>

      {/* Per-Agent Circuit Breakers Matrix */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-lg font-semibold text-slate-800">Per-Agent Circuit Breakers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(snapshot.agents).map(([agentId, breaker]) => {
            const isOpen = breaker.state === BREAKER_STATES.OPEN;
            const isHalfOpen = breaker.state === BREAKER_STATES.HALF_OPEN;

            return (
              <div
                key={agentId}
                data-testid={`breaker-card-${agentId}`}
                className={`p-4 rounded-lg border flex flex-col justify-between ${
                  isOpen
                    ? 'bg-red-50 border-red-200'
                    : isHalfOpen
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-900 text-sm truncate">{agentId}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${
                        isOpen
                          ? 'bg-red-600 text-white'
                          : isHalfOpen
                          ? 'bg-amber-500 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {breaker.state}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-600 space-y-1">
                    <div>Failures: {breaker.failureCount}</div>
                    <div>Successes: {breaker.successCount}</div>
                    {breaker.tripReason && (
                      <div className="text-red-700 italic truncate" title={breaker.tripReason}>
                        Trip: {breaker.tripReason}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-2 border-t border-slate-200 flex gap-2">
                  {isOpen ? (
                    <button
                      onClick={() => handleResetBreaker(agentId)}
                      className="w-full text-xs py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                    >
                      Reset Circuit
                    </button>
                  ) : (
                    <button
                      onClick={() => handleTripBreaker(agentId)}
                      className="w-full text-xs py-1.5 bg-rose-600 text-white rounded hover:bg-rose-700"
                    >
                      Trip Breaker
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tool Revocation Management & Quarantine */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tool Revocation Registry */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-md font-semibold text-slate-800">Tool Revocation Controls</h3>
          <p className="text-xs text-slate-500">
            Selectively deactivate individual agent tools without halting entire workflows.
          </p>
          <div className="space-y-2">
            {['lookupServiceDetails', 'searchCivicFaq', 'saveApplicationDraft', 'scheduleGrievanceFollowUp'].map(
              (tName) => {
                const isRevoked = snapshot.revokedTools.includes(tName);
                return (
                  <div
                    key={tName}
                    className="flex justify-between items-center p-2 rounded bg-slate-50 border border-slate-100 text-sm"
                  >
                    <span className="font-mono text-xs">{tName}</span>
                    <button
                      onClick={() => handleToggleToolRevocation(tName)}
                      className={`text-xs px-2.5 py-1 rounded font-medium ${
                        isRevoked
                          ? 'bg-amber-600 text-white hover:bg-amber-700'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {isRevoked ? 'Restore Tool' : 'Revoke Tool'}
                    </button>
                  </div>
                );
              }
            )}
          </div>
        </div>

        {/* Quarantine Queue Inspector */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-md font-semibold text-slate-800">Queued-Job Quarantine</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
              {snapshot.quarantinedJobsCount} Jobs Isolated
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Jobs originating from tripping agents or anomalous loops are quarantined with PII redacted.
          </p>
          <div className="pt-2">
            <button
              onClick={handleDrainQuarantine}
              disabled={snapshot.quarantinedJobsCount === 0}
              className="w-full text-xs py-2 bg-purple-600 text-white rounded font-medium disabled:opacity-50 hover:bg-purple-700"
            >
              Drain Safe Quarantine Batch
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmKillModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
        >
          <div className="bg-white p-6 rounded-xl max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              {snapshot.globalKillSwitch.active
                ? 'Confirm Disengage Kill-Switch'
                : 'Confirm Emergency Global Kill-Switch'}
            </h3>
            <p className="text-sm text-slate-600">
              {snapshot.globalKillSwitch.active
                ? 'Are you certain you want to restore AI services across the platform? Ensure all recovery checklists are verified.'
                : 'This will IMMEDIATELY halt all conversational AI agents and fallback users to offline manual guidance.'}
            </p>

            {!snapshot.globalKillSwitch.active && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Incident Reason (Required)
                </label>
                <input
                  type="text"
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="e.g., Upstream provider anomalous output"
                  className="w-full p-2 border border-slate-300 rounded text-sm"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmKillModal(false)}
                className="px-4 py-2 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleGlobalKillToggle}
                className={`px-4 py-2 rounded text-sm font-semibold text-white ${
                  snapshot.globalKillSwitch.active
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {snapshot.globalKillSwitch.active ? 'Confirm Disengage' : 'Confirm ENGAGE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
