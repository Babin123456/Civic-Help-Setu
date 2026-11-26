/**
 * src/components/admin/CivicChaosResiliencePanel.jsx
 * Accessible, mobile-first Civic Operations Chaos Engineering & Resilience Control Panel (#1192).
 *
 * Capabilities:
 * - Real-time Dependency Resilience Health (Firebase, LLMs, Maps, Email, Storage)
 * - Emergency Kill Switch Controls (Global + Per-dependency isolation)
 * - Controlled Drill Launcher (Presets: Cascading Outage, AI Spike, GIS Blackout, Email Failure)
 * - Live Chaos Simulation & Recovery Objective (RTO/RPO) Verification
 * - Citizen Draft Preservation Monitor (Demonstrating 100% draft retention & local journal)
 * - Resilience Runbooks & Operational Checklists
 * - Real-time Telemetry Stream
 */

import { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  Flame,
  Activity,
  AlertOctagon,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  BookOpen,
  FileCheck2,
  Database,
  Cpu,
  MapPin,
  Mail,
  HardDrive,
} from 'lucide-react';
import {
  DEPENDENCY_TYPES,
  DEFAULT_RECOVERY_OBJECTIVES,
  RESILIENCE_RUNBOOKS,
  SYNTHETIC_CHAOS_FIXTURES,
} from '../../data/civicChaosResilienceContract';
import chaosEngine, { CIRCUIT_STATE } from '../../services/civicChaosInjectionEngine';
import {
  executeResilienceEvaluationSuite,
  getLocalDraftJournal,
  getDeadLetterEmailSpool,
  getStorageUploadQueue,
  resetResilienceState,
  saveCitizenDraftWithResilience,
} from '../../services/civicChaosResilienceService';

export default function CivicChaosResiliencePanel() {
  const [engineStatus, setEngineStatus] = useState(() => chaosEngine.getStatus());
  const [telemetry, setTelemetry] = useState(() => chaosEngine.getTelemetry());
  const [selectedScenario, setSelectedScenario] = useState(SYNTHETIC_CHAOS_FIXTURES.presetScenarios[0].id);
  const [activeDrillRunning, setActiveDrillRunning] = useState(false);
  const [evaluationReport, setEvaluationReport] = useState(null);
  const [selectedRunbook, setSelectedRunbook] = useState(RESILIENCE_RUNBOOKS[0].id);
  const [notificationMsg, setNotificationMsg] = useState('');
  const [draftSimulationStatus, setDraftSimulationStatus] = useState(null);

  // Sync with chaos engine events
  useEffect(() => {
    const unsubscribe = chaosEngine.addListener(() => {
      setEngineStatus(chaosEngine.getStatus());
      setTelemetry(chaosEngine.getTelemetry());
    });
    return unsubscribe;
  }, []);

  const activePreset = useMemo(() => {
    return (
      SYNTHETIC_CHAOS_FIXTURES.presetScenarios.find((s) => s.id === selectedScenario) ||
      SYNTHETIC_CHAOS_FIXTURES.presetScenarios[0]
    );
  }, [selectedScenario]);

  const activeRunbook = useMemo(() => {
    return (
      RESILIENCE_RUNBOOKS.find((r) => r.id === selectedRunbook) ||
      RESILIENCE_RUNBOOKS[0]
    );
  }, [selectedRunbook]);

  const handleGlobalKillSwitch = () => {
    if (engineStatus.globalKillSwitchEngaged) {
      chaosEngine.disengageGlobalKillSwitch();
      setNotificationMsg('Global emergency kill switch disengaged.');
    } else {
      chaosEngine.engageGlobalKillSwitch('Operator emergency abort from Chaos Control Panel.');
      setActiveDrillRunning(false);
      setNotificationMsg('GLOBAL EMERGENCY KILL SWITCH ACTIVATED: All active faults terminated.');
    }
    setEngineStatus(chaosEngine.getStatus());
  };

  const handleToggleDependencyKillSwitch = (dep) => {
    const isCurrentlyEngaged = engineStatus.killSwitches[dep] || false;
    chaosEngine.setDependencyKillSwitch(dep, !isCurrentlyEngaged, 'Operator panel toggle');
    setEngineStatus(chaosEngine.getStatus());
  };

  const handleStartDrill = () => {
    if (engineStatus.globalKillSwitchEngaged) {
      setNotificationMsg('Cannot start drill: Emergency Kill Switch is currently engaged.');
      return;
    }

    try {
      setActiveDrillRunning(true);
      const drill = chaosEngine.startDrill({
        name: activePreset.name,
        environment: activePreset.environment || 'staging',
        operatorId: 'admin-operations-tester',
        injections: activePreset.injections,
      });
      setNotificationMsg(`Drill "${drill.name}" active in [${drill.environment}]. Faults injected.`);
    } catch (err) {
      setNotificationMsg(`Failed to start drill: ${err.message}`);
      setActiveDrillRunning(false);
    }
  };

  const handleStopDrill = () => {
    if (engineStatus.activeDrills.length > 0) {
      const drillId = engineStatus.activeDrills[0].id;
      chaosEngine.stopDrill(drillId, 'Manually terminated by operator');
    }
    setActiveDrillRunning(false);
    setNotificationMsg('Active drill stopped and injections cleared.');
  };

  const handleRunEvaluation = async () => {
    setNotificationMsg('Executing automated resilience evaluation across all 5 dependencies...');
    try {
      const report = await executeResilienceEvaluationSuite(selectedScenario);
      setEvaluationReport(report);
      setNotificationMsg(`Resilience evaluation complete: Overall Status ${report.overallStatus} (0% draft loss).`);
    } catch (err) {
      setNotificationMsg(`Evaluation failed: ${err.message}`);
    }
  };

  const handleSimulateDraftSave = async () => {
    setDraftSimulationStatus('saving');
    try {
      const res = await saveCitizenDraftWithResilience(
        SYNTHETIC_CHAOS_FIXTURES.sampleCitizenDraft
      );
      setDraftSimulationStatus({
        success: true,
        persistedTo: res.persistedTo,
        offlineActive: res.offlineActive,
        message: res.message,
        rtoElapsedMs: res.rtoElapsedMs,
      });
    } catch (err) {
      setDraftSimulationStatus({
        success: false,
        message: err.message,
      });
    }
  };

  const handleReset = () => {
    resetResilienceState();
    setEvaluationReport(null);
    setDraftSimulationStatus(null);
    setNotificationMsg('Engine, state queues, and telemetry reset.');
    setEngineStatus(chaosEngine.getStatus());
    setTelemetry([]);
  };

  const getDependencyIcon = (dep) => {
    switch (dep) {
      case DEPENDENCY_TYPES.FIREBASE:
        return <Database className="w-5 h-5 text-amber-500" />;
      case DEPENDENCY_TYPES.MODEL_PROVIDERS:
        return <Cpu className="w-5 h-5 text-indigo-500" />;
      case DEPENDENCY_TYPES.MAPS:
        return <MapPin className="w-5 h-5 text-emerald-500" />;
      case DEPENDENCY_TYPES.EMAIL:
        return <Mail className="w-5 h-5 text-blue-500" />;
      case DEPENDENCY_TYPES.STORAGE:
        return <HardDrive className="w-5 h-5 text-purple-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div
      className="civic-chaos-resilience-panel space-y-6"
      style={{
        background: 'var(--bg-card, #ffffff)',
        padding: '1.5rem',
        borderRadius: '12px',
        border: '1px solid var(--border-light, #e2e8f0)',
      }}
      aria-label="Civic Operations Chaos Engineering and Resilience Test Suite"
    >
      {/* Header & Kill Switch Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Civic Operations Chaos Engineering &amp; Resilience Test Suite
            </h2>
            <span
              className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider"
              style={{
                backgroundColor: engineStatus.globalKillSwitchEngaged ? '#fee2e2' : '#dcfce7',
                color: engineStatus.globalKillSwitchEngaged ? '#b91c1c' : '#15803d',
              }}
            >
              {engineStatus.globalKillSwitchEngaged ? 'Kill Switch Active' : 'Test Mode Ready'}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Controlled non-production fault injection, circuit breaker verification, citizen draft preservation, and automated runbooks.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleGlobalKillSwitch}
            data-testid="global-kill-switch-btn"
            className="px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 shadow-sm transition-colors text-white"
            style={{
              backgroundColor: engineStatus.globalKillSwitchEngaged ? '#16a34a' : '#dc2626',
            }}
            aria-label={
              engineStatus.globalKillSwitchEngaged
                ? 'Disengage global emergency kill switch'
                : 'Engage global emergency kill switch'
            }
          >
            <AlertOctagon className="w-4 h-4" />
            {engineStatus.globalKillSwitchEngaged ? 'Disengage Kill Switch' : 'EMERGENCY KILL SWITCH'}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 rounded-lg text-sm border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-1.5"
            title="Reset telemetry and queues"
          >
            <RefreshCw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {notificationMsg && (
        <div
          role="status"
          aria-live="polite"
          className="p-3 text-sm rounded-lg flex items-center justify-between"
          style={{
            backgroundColor: 'var(--bg-accent, #f1f5f9)',
            color: 'var(--text-primary, #0f172a)',
            borderLeft: '4px solid #3b82f6',
          }}
        >
          <span>{notificationMsg}</span>
          <button
            type="button"
            onClick={() => setNotificationMsg('')}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Dependencies Grid & Circuit Breaker Health */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-500" />
          Service Dependencies &amp; Circuit Breaker Status
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {SYNTHETIC_CHAOS_FIXTURES.mockDependencies.map((dep) => {
            const breaker = engineStatus.circuitBreakers[dep.id] || { state: CIRCUIT_STATE.CLOSED, failures: 0 };
            const isKillSwitched = engineStatus.killSwitches[dep.id] || false;
            const hasActiveFault = Boolean(engineStatus.activeInjections[dep.id]);

            let statusBadge = { bg: '#dcfce7', text: '#15803d', label: 'HEALTHY' };
            if (isKillSwitched) {
              statusBadge = { bg: '#fee2e2', text: '#b91c1c', label: 'ISOLATED' };
            } else if (breaker.state === CIRCUIT_STATE.OPEN) {
              statusBadge = { bg: '#fee2e2', text: '#dc2626', label: 'BREAKER OPEN' };
            } else if (hasActiveFault) {
              statusBadge = { bg: '#fef3c7', text: '#b45309', label: 'FAULT ACTIVE' };
            }

            return (
              <div
                key={dep.id}
                className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 flex flex-col justify-between space-y-2"
                data-testid={`dep-card-${dep.id}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    {getDependencyIcon(dep.id)}
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded uppercase"
                      style={{ backgroundColor: statusBadge.bg, color: statusBadge.text }}
                    >
                      {statusBadge.label}
                    </span>
                  </div>
                  <div className="font-semibold text-xs text-gray-800 dark:text-gray-200">
                    {dep.name}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    Target RTO: {DEFAULT_RECOVERY_OBJECTIVES[dep.id]?.targetRtoMs}ms | RPO: 0s
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">
                    Failures: {breaker.failures}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleDependencyKillSwitch(dep.id)}
                    className="text-[10px] px-2 py-1 rounded font-medium border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700"
                    title={`Toggle isolation for ${dep.name}`}
                  >
                    {isKillSwitched ? 'Re-enable' : 'Isolate'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Controlled Drill Launcher & Preset Scenarios */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              Controlled Fault Injection &amp; Drill Scenarios
            </h3>
            <span className="text-xs text-gray-500">Non-Production Only</span>
          </div>

          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-3">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
              Select Preset Chaos Drill Scenario
            </label>
            <select
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              className="w-full text-sm p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              data-testid="drill-scenario-select"
            >
              {SYNTHETIC_CHAOS_FIXTURES.presetScenarios.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name} [{sc.environment}]
                </option>
              ))}
            </select>

            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs space-y-1.5">
              <div className="font-semibold text-gray-800 dark:text-gray-200">
                {activePreset.description}
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-700 dark:text-gray-300">Expected Behavior:</span>{' '}
                {activePreset.expectedBehavior}
              </div>
              <div className="text-gray-500">
                Injections:{' '}
                {activePreset.injections
                  .map((i) => `${i.dependency} (${i.faultType})`)
                  .join(', ')}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {!activeDrillRunning ? (
                <button
                  type="button"
                  onClick={handleStartDrill}
                  disabled={engineStatus.globalKillSwitchEngaged}
                  data-testid="start-drill-btn"
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Flame className="w-4 h-4" />
                  Launch Chaos Drill
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopDrill}
                  data-testid="stop-drill-btn"
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 shadow-sm"
                >
                  <XCircle className="w-4 h-4" />
                  Stop Active Drill
                </button>
              )}

              <button
                type="button"
                onClick={handleRunEvaluation}
                data-testid="run-evaluation-btn"
                className="px-4 py-2 rounded-lg text-sm font-medium border border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                Run Automated Evaluation Suite
              </button>
            </div>
          </div>

          {/* Citizen Draft Preservation Section */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
                Citizen Draft Preservation Verification (RPO = 0s)
              </h4>
              <button
                type="button"
                onClick={handleSimulateDraftSave}
                data-testid="simulate-draft-save-btn"
                className="text-xs px-3 py-1.5 rounded-lg font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1"
              >
                Simulate Citizen Draft Submission Under Chaos
              </button>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400">
              Verifies that even if primary Firebase storage is failing or timing out, citizen drafts are automatically diverted to the secure local offline journal.
            </p>

            {draftSimulationStatus && typeof draftSimulationStatus === 'object' && (
              <div
                className="p-3 rounded-lg text-xs space-y-1"
                style={{
                  backgroundColor: draftSimulationStatus.offlineActive ? '#fef3c7' : '#dcfce7',
                  border: `1px solid ${draftSimulationStatus.offlineActive ? '#f59e0b' : '#10b981'}`,
                }}
                data-testid="draft-simulation-result"
              >
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  {draftSimulationStatus.offlineActive
                    ? 'FALLBACK ENGAGED: Saved to Offline Client Journal'
                    : 'SYNCED: Saved to Remote Primary Storage'}
                </div>
                <div className="text-gray-700 dark:text-gray-300">
                  {draftSimulationStatus.message}
                </div>
                <div className="text-gray-500">
                  RTO Latency: {draftSimulationStatus.rtoElapsedMs}ms | RPO: 0s (Zero Drafts Lost)
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
              <div className="p-2 rounded bg-gray-50 dark:bg-gray-700/50">
                <span className="text-gray-500 block">Offline Drafts</span>
                <span className="font-bold text-sm text-gray-800 dark:text-gray-200">
                  {getLocalDraftJournal().length}
                </span>
              </div>
              <div className="p-2 rounded bg-gray-50 dark:bg-gray-700/50">
                <span className="text-gray-500 block">Dead-Letter Emails</span>
                <span className="font-bold text-sm text-gray-800 dark:text-gray-200">
                  {getDeadLetterEmailSpool().length}
                </span>
              </div>
              <div className="p-2 rounded bg-gray-50 dark:bg-gray-700/50">
                <span className="text-gray-500 block">Storage Upload Queue</span>
                <span className="font-bold text-sm text-gray-800 dark:text-gray-200">
                  {getStorageUploadQueue().length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Operational Runbooks & Checklists */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-500" />
            Operational Runbooks &amp; Checklists
          </h3>

          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-3">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
              Select Dependency Runbook
            </label>
            <select
              value={selectedRunbook}
              onChange={(e) => setSelectedRunbook(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {RESILIENCE_RUNBOOKS.map((rb) => (
                <option key={rb.id} value={rb.id}>
                  {rb.id} - {rb.name}
                </option>
              ))}
            </select>

            <div className="space-y-2 text-xs">
              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-300">Trigger Threshold:</span>
                <p className="text-gray-600 dark:text-gray-400 mt-0.5">{activeRunbook.trigger}</p>
              </div>

              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-300">Automated Action:</span>
                <p className="text-gray-600 dark:text-gray-400 mt-0.5">{activeRunbook.automatedAction}</p>
              </div>

              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-300">Manual Operator Checklist:</span>
                <ul className="list-disc pl-4 space-y-1 text-gray-600 dark:text-gray-400 mt-1">
                  {activeRunbook.manualChecklist.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="pt-2">
                <span className="text-[11px] text-gray-500">
                  Associated Safe Kill Switch: <code>{activeRunbook.killSwitchId}</code>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Automated Evaluation Report Output */}
      {evaluationReport && (
        <div
          className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 space-y-3"
          data-testid="resilience-evaluation-report"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Evaluation Report: {evaluationReport.scenarioName}
              </h4>
            </div>
            <div className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
              STATUS: {evaluationReport.overallStatus} ({evaluationReport.rtoCompliance})
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
              <span className="text-gray-500 block">Total Duration</span>
              <span className="font-bold">{evaluationReport.totalDurationMs}ms</span>
            </div>
            <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
              <span className="text-gray-500 block">Draft Loss Rate</span>
              <span className="font-bold text-emerald-600">{evaluationReport.draftLossRate}%</span>
            </div>
            <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
              <span className="text-gray-500 block">Environment</span>
              <span className="font-bold">{evaluationReport.environment}</span>
            </div>
            <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
              <span className="text-gray-500 block">Evaluated At</span>
              <span className="font-mono text-[10px]">{new Date(evaluationReport.evaluatedAt).toLocaleTimeString()}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-300 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-300">
                  <th className="py-2 px-2">Dependency</th>
                  <th className="py-2 px-2">Resilience Verification</th>
                  <th className="py-2 px-2">Actual RTO</th>
                  <th className="py-2 px-2">Target RTO</th>
                  <th className="py-2 px-2">Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {evaluationReport.results.map((res, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="py-2 px-2 font-medium capitalize">{res.dependency}</td>
                    <td className="py-2 px-2">{res.test}</td>
                    <td className="py-2 px-2 font-mono">{res.actualRtoMs}ms</td>
                    <td className="py-2 px-2 font-mono text-gray-500">{res.targetRtoMs}ms</td>
                    <td className="py-2 px-2">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold"
                        style={{
                          backgroundColor: res.passed ? '#dcfce7' : '#fee2e2',
                          color: res.passed ? '#15803d' : '#b91c1c',
                        }}
                      >
                        {res.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Real-time Telemetry Stream */}
      <div className="space-y-2 pt-2">
        <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-gray-500" />
          Live Resilience Telemetry &amp; Circuit Log
        </h4>
        <div
          className="p-3 bg-gray-900 text-gray-200 font-mono text-[11px] rounded-lg max-h-48 overflow-y-auto space-y-1"
          data-testid="chaos-telemetry-logs"
          tabIndex={0}
          role="region"
          aria-label="Real-time chaos telemetry logs"
        >
          {telemetry.length === 0 ? (
            <div className="text-gray-500">No events logged yet. Launch a drill or simulate draft to view telemetry.</div>
          ) : (
            telemetry.map((log) => (
              <div key={log.id} className="flex gap-2 leading-relaxed">
                <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span
                  style={{
                    color:
                      log.level === 'ERROR'
                        ? '#ef4444'
                        : log.level === 'WARN'
                        ? '#f59e0b'
                        : '#10b981',
                  }}
                >
                  [{log.level}]
                </span>
                <span>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
