import { useState, useEffect, useId, useCallback } from "react";
import {
  Database,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Layers,
  Lock,
  Server,
  TrendingUp,
  Copy,
  Check,
  AlertCircle,
  Activity,
} from "lucide-react";
import {
  executeFederatedCivicQuery,
  checkFederatedNodeHealth,
  PRESET_CIVIC_QUERIES,
} from "../services/federatedCivicQueryService.js";
import {
  FEDERATED_DEPARTMENTS,
  AUTHORIZED_CIVIC_PURPOSES,
  AVAILABILITY_STATES,
} from "../data/federatedQueryContract.js";
import { SYNTHETIC_WARDS } from "../data/syntheticFederatedFixtures.js";
import {
  getConnectorById,
  resetAllConnectors,
} from "../services/federatedConnectors/index.js";

export default function FederatedQueryExplorer() {
  const [selectedPreset, setSelectedPreset] = useState(PRESET_CIVIC_QUERIES[0].id);
  const [purpose, setPurpose] = useState("INFRASTRUCTURE_MONITORING");
  const [selectedWard, setSelectedWard] = useState("ALL");
  const [targetDepts, setTargetDepts] = useState(["water_supply", "roads_infrastructure"]);
  const [loading, setLoading] = useState(false);
  const [queryResult, setQueryResult] = useState(null);
  const [error, setError] = useState(null);
  const [copiedSeal, setCopiedSeal] = useState(false);
  const [nodeHealth, setNodeHealth] = useState({});
  const [showFaultControls, setShowFaultControls] = useState(false);
  const [activeFaults, setActiveFaults] = useState({
    healthTimeout: false,
    roadsDrift: false,
  });

  const headingId = useId();

  const loadNodeHealth = useCallback(async () => {
    try {
      const health = await checkFederatedNodeHealth();
      setNodeHealth(health);
    } catch {
      // Fallback
    }
  }, []);

  const handleRunQuery = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const requestPayload = {
        purpose,
        targetDepartments: targetDepts,
        ward: selectedWard,
      };

      const result = await executeFederatedCivicQuery(requestPayload, { timeoutMs: 1500 });
      setQueryResult(result);
      if (!result.success && result.errors) {
        setError(result.errors.join("; "));
      }
    } catch (err) {
      setError(err.message || "Failed to execute federated query");
    } finally {
      setLoading(false);
      loadNodeHealth();
    }
  }, [purpose, targetDepts, selectedWard, loadNodeHealth]);

  // Initial load
  useEffect(() => {
    let ignore = false;

    checkFederatedNodeHealth()
      .then((health) => {
        if (!ignore) setNodeHealth(health);
      })
      .catch(() => {});

    executeFederatedCivicQuery(
      {
        purpose: "INFRASTRUCTURE_MONITORING",
        targetDepartments: ["water_supply", "roads_infrastructure"],
        ward: "ALL",
      },
      { timeoutMs: 1500 }
    )
      .then((result) => {
        if (!ignore) setQueryResult(result);
      })
      .catch((err) => {
        if (!ignore) setError(err.message || "Failed to execute federated query");
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handlePresetSelect = (presetId) => {
    const preset = PRESET_CIVIC_QUERIES.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPreset(preset.id);
    setPurpose(preset.purpose);
    setTargetDepts(preset.targetDepartments);
    setSelectedWard(preset.ward || "ALL");
  };

  const handleDeptToggle = (deptId) => {
    setTargetDepts((prev) => {
      if (prev.includes(deptId)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((d) => d !== deptId);
      }
      return [...prev, deptId];
    });
  };

  const toggleFault = (type) => {
    if (type === "healthTimeout") {
      const nextVal = !activeFaults.healthTimeout;
      setActiveFaults((prev) => ({ ...prev, healthTimeout: nextVal }));
      const conn = getConnectorById("health_sanitation");
      if (conn) conn.setFaultInjection({ timeout: nextVal });
    } else if (type === "roadsDrift") {
      const nextVal = !activeFaults.roadsDrift;
      setActiveFaults((prev) => ({ ...prev, roadsDrift: nextVal }));
      const conn = getConnectorById("roads_infrastructure");
      if (conn) conn.setFaultInjection({ driftSchema: nextVal });
    }
    loadNodeHealth();
  };

  const handleResetFaults = () => {
    resetAllConnectors();
    setActiveFaults({ healthTimeout: false, roadsDrift: false });
    loadNodeHealth();
  };

  const copySeal = () => {
    if (queryResult?.provenanceSeal) {
      navigator.clipboard?.writeText(queryResult.provenanceSeal);
      setCopiedSeal(true);
      setTimeout(() => setCopiedSeal(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8 text-slate-800 dark:text-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header and Statutory Scope Boundary */}
        <header className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 mb-2">
                <Database className="w-3.5 h-3.5" />
                <span>Decentralized Architecture v1.0.0</span>
              </div>
              <h1 id={headingId} className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Federated Civic Data Query Layer
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
                Execute authorized aggregate analytical queries across department-owned data silos without
                centralizing citizen records. Enforces local computation, k-anonymity privacy thresholds,
                and resilient partial availability.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFaultControls(!showFaultControls)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <Sliders className="w-4 h-4 text-indigo-500" />
                <span>{showFaultControls ? "Hide Fault Injection" : "Simulate Failures"}</span>
              </button>
            </div>
          </div>

          {/* Statutory Boundary Notice */}
          <div
            role="note"
            className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900/60 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Scope & Operational Disclaimer:</span> Civic Help Setu provides a federated
              query layer across synthetic and departmental reporting adapters for civic situational awareness. Data
              summaries do not confer official administrative verification, statutory certificates, or guaranteed legal
              outcomes.
            </div>
          </div>
        </header>

        {/* Fault Injection Panel (for Maintainers & Resilience Testing) */}
        {showFaultControls && (
          <section
            aria-labelledby="fault-heading"
            className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 rounded-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 id="fault-heading" className="text-sm font-semibold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span>Maintainer Resilience & Fault Simulation Bench</span>
              </h2>
              <button
                type="button"
                onClick={handleResetFaults}
                className="text-xs text-indigo-700 dark:text-indigo-300 hover:underline inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset All Nodes to Healthy</span>
              </button>
            </div>
            <p className="text-xs text-indigo-800 dark:text-indigo-300">
              Test how the query layer handles network degradation, slow connectors, and schema drift while returning
              partial availability states without failing the entire query.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => toggleFault("healthTimeout")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                  activeFaults.healthTimeout
                    ? "bg-red-600 text-white border-red-700"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700"
                }`}
              >
                {activeFaults.healthTimeout ? "✓ Health Node Timing Out (>1500ms)" : "Simulate Health Node Timeout"}
              </button>

              <button
                type="button"
                onClick={() => toggleFault("roadsDrift")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                  activeFaults.roadsDrift
                    ? "bg-amber-600 text-white border-amber-700"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700"
                }`}
              >
                {activeFaults.roadsDrift ? "✓ Roads Schema Drift Triggered" : "Simulate Roads Schema Drift"}
              </button>
            </div>
          </section>
        )}

        {/* Department Node Health Status */}
        <section aria-labelledby="node-status-heading" className="space-y-2">
          <h2 id="node-status-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Registered Department Nodes & Connectors
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.values(FEDERATED_DEPARTMENTS).map((dept) => {
              const health = nodeHealth[dept.id] || {};
              const isHealthy = health.status === "HEALTHY";
              const isTimeout = health.status === "TIMEOUT_RISK";
              const isDrift = health.status === "SCHEMA_DRIFT";

              return (
                <div
                  key={dept.id}
                  className="bg-white dark:bg-slate-800 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                        {dept.code}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          isHealthy
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : isTimeout
                              ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                              : isDrift
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {isHealthy ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span>Healthy</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            <span>{health.status || "Unknown"}</span>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-1">
                      {dept.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {dept.category}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>SLA: {dept.defaultSlaMs}ms</span>
                    <span title={health.schemaHash || "Schema Hash"}>
                      {(health.schemaHash || "HASH-OK").slice(0, 15)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Query Composer */}
        <section
          aria-labelledby="composer-heading"
          className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="composer-heading" className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-500" />
              <span>Query Configuration & Purpose Scope</span>
            </h2>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5">
              {PRESET_CIVIC_QUERIES.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetSelect(preset.id)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                    selectedPreset === preset.id
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Purpose Selector */}
            <div>
              <label htmlFor="purpose-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Authorized Civic Purpose (Required)
              </label>
              <select
                id="purpose-select"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full text-xs rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white p-2.5 focus:ring-2 focus:ring-indigo-500"
              >
                {Object.values(AUTHORIZED_CIVIC_PURPOSES).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                {AUTHORIZED_CIVIC_PURPOSES[purpose]?.description}
              </p>
            </div>

            {/* Ward Selector */}
            <div>
              <label htmlFor="ward-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Geographic Scope (Ward)
              </label>
              <select
                id="ward-select"
                value={selectedWard}
                onChange={(e) => setSelectedWard(e.target.value)}
                className="w-full text-xs rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white p-2.5 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Wards (Multi-Ward Aggregate)</option>
                {SYNTHETIC_WARDS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.zone} Zone)
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Filter aggregate computation near source systems.
              </p>
            </div>

            {/* Target Departments */}
            <div>
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Federated Data Sources
              </span>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(FEDERATED_DEPARTMENTS).map((dept) => (
                  <label
                    key={dept.id}
                    className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 cursor-pointer text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={targetDepts.includes(dept.id)}
                      onChange={() => handleDeptToggle(dept.id)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-medium truncate">{dept.code}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              disabled={loading}
              onClick={handleRunQuery}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition shadow-sm"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Dispatching Federated Query...</span>
                </>
              ) : (
                <>
                  <Server className="w-4 h-4" />
                  <span>Execute Federated Query</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Error Notification */}
        {error && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-200 text-sm flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Query Execution Error</div>
              <div>{error}</div>
            </div>
          </div>
        )}

        {/* Query Results & Partial Availability View */}
        {queryResult && (
          <div className="space-y-6" aria-live="polite">
            {/* Status & Privacy Invariant Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Availability Card */}
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  queryResult.availability === AVAILABILITY_STATES.FULL
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-100"
                    : queryResult.availability === AVAILABILITY_STATES.PARTIAL
                      ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-100"
                      : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-100"
                }`}
              >
                {queryResult.availability === AVAILABILITY_STATES.FULL ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider">Availability State</div>
                  <div className="font-bold text-sm">
                    {queryResult.availability === AVAILABILITY_STATES.FULL
                      ? "Full Availability (100% Nodes Responded)"
                      : queryResult.availability === AVAILABILITY_STATES.PARTIAL
                        ? `Partial Availability (${queryResult.respondingNodes}/${queryResult.totalTargetNodes} Responding)`
                        : "Query Failed / No Nodes Responded"}
                  </div>
                  <div className="text-xs mt-1 opacity-90">
                    Execution time: {queryResult.executionTimeMs}ms across distributed connectors.
                  </div>
                </div>
              </div>

              {/* Privacy Guard Card */}
              <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider">Differential Privacy & Anonymity</div>
                  <div className="font-bold text-sm">
                    k-Threshold (k ≥ {queryResult.privacyMetrics.thresholdApplied}) Enforced
                  </div>
                  <div className="text-xs mt-1 opacity-90">
                    {queryResult.privacyMetrics.suppressedWardCount > 0
                      ? `${queryResult.privacyMetrics.suppressedWardCount} ward cell(s) suppressed to prevent re-identification.`
                      : "All aggregate slices satisfy minimum privacy threshold."}
                  </div>
                </div>
              </div>

              {/* Provenance Seal Card */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 flex items-start gap-3">
                <Lock className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Cryptographic Provenance
                  </div>
                  <div className="font-mono font-bold text-xs truncate mt-0.5 text-indigo-600 dark:text-indigo-400">
                    {queryResult.provenanceSeal || "NO-SEAL"}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={copySeal}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      {copiedSeal ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Seal</span>
                        </>
                      )}
                    </button>
                    <span className="text-[10px] text-slate-400">Deterministic HMAC</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Degraded Nodes Alert (When in Partial Availability State) */}
            {queryResult.degradedNodes?.length > 0 && (
              <div
                role="status"
                className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2 text-xs"
              >
                <div className="font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Degraded Department Connectors Isolated:</span>
                </div>
                <ul className="list-disc list-inside space-y-1">
                  {queryResult.degradedNodes.map((node) => (
                    <li key={node.connectorId}>
                      <span className="font-semibold">{node.departmentName}:</span> {node.reason} (Code:{" "}
                      <code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">{node.errorCode}</code>)
                    </li>
                  ))}
                </ul>
                <div className="text-[11px] opacity-90 mt-1">
                  Note: The query coordinator isolated these nodes without halting execution. Returned statistics reflect
                  currently responding systems only.
                </div>
              </div>
            )}

            {/* Multi-Department Aggregates Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-500" />
                    <span>Ward-Level Federated Aggregate Cross-Tabulation</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Values aggregated locally at each departmental connector. Any ward cell with 1–9 events is masked for privacy.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-200">
                  <caption className="sr-only">
                    Federated cross-department aggregate counts by ward, enforcing k-anonymity privacy thresholds.
                  </caption>
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-semibold uppercase text-[11px]">
                    <tr>
                      <th scope="col" className="py-3 px-4">Ward / Geographic Area</th>
                      {targetDepts.map((deptId) => {
                        const dept = FEDERATED_DEPARTMENTS[deptId.toUpperCase()];
                        const isAvailable = Boolean(queryResult.data[deptId]);
                        return (
                          <th key={deptId} scope="col" className="py-3 px-4 text-center">
                            <div>{dept?.name || deptId}</div>
                            <div className="text-[10px] font-normal lowercase text-slate-400">
                              {isAvailable ? "Online (Aggregates Received)" : "Degraded (Offline/Timeout)"}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                    {SYNTHETIC_WARDS.map((ward) => {
                      if (selectedWard !== "ALL" && selectedWard !== String(ward.id)) {
                        return null;
                      }

                      return (
                        <tr key={ward.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                          <th scope="row" className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                            {ward.name}
                            <span className="ml-2 text-[10px] text-slate-500 font-normal">({ward.zone} Zone)</span>
                          </th>

                          {targetDepts.map((deptId) => {
                            const deptData = queryResult.data[deptId];
                            if (!deptData) {
                              return (
                                <td key={deptId} className="py-3 px-4 text-center text-slate-400 italic">
                                  Unavailable (Degraded Node)
                                </td>
                              );
                            }

                            const wardValue = deptData.aggregates?.byWard?.[ward.id] ?? "0";
                            const isSuppressed = deptData.aggregates?.privacyDetails?.[ward.id]?.isSuppressed;

                            return (
                              <td key={deptId} className="py-3 px-4 text-center">
                                {isSuppressed ? (
                                  <span
                                    title="Value suppressed under k-anonymity privacy policy (fewer than 10 events)"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                  >
                                    <ShieldCheck className="w-3 h-3" />
                                    <span>&lt; 10 (Suppressed)</span>
                                  </span>
                                ) : (
                                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                                    {wardValue}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Department Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.keys(queryResult.data).map((deptId) => {
                const info = queryResult.data[deptId];
                const deptMeta = FEDERATED_DEPARTMENTS[deptId.toUpperCase()];

                return (
                  <div
                    key={deptId}
                    className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs"
                  >
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      {deptMeta?.code} Key Indicators
                    </div>
                    <div className="text-slate-500 text-[11px]">{info.departmentName}</div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Total Scoped Records:</span>
                        <span className="font-bold">{info.aggregates?.totalRecords ?? 0}</span>
                      </div>

                      {info.aggregates?.resolutionRate !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Issue Resolution Rate:</span>
                          <span className="font-bold text-emerald-600">{info.aggregates.resolutionRate}%</span>
                        </div>
                      )}

                      {info.aggregates?.totalEstimatedCost !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Est. Repair Budget:</span>
                          <span className="font-bold">₹{info.aggregates.totalEstimatedCost.toLocaleString()}</span>
                        </div>
                      )}

                      {info.aggregates?.inspectionRate !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Sanitation Inspection:</span>
                          <span className="font-bold text-indigo-600">{info.aggregates.inspectionRate}%</span>
                        </div>
                      )}

                      {info.aggregates?.avgDelayMinutes !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Avg Transit Delay:</span>
                          <span className="font-bold text-amber-600">{info.aggregates.avgDelayMinutes} mins</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
