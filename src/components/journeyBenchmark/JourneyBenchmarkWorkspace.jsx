import React, { useState, useEffect } from "react";
import {
  BENCHMARK_SUITES,
  BENCHMARK_TASKS,
  BENCHMARK_MODELS,
  BENCHMARK_CANARY_TOKEN
} from "../../data/civicJourneyBenchmarkData.js";
import {
  evaluateTaskOutput,
  runSuiteEvaluation,
  exportBenchmarkDataset,
  saveBenchmarkRun,
  listSavedBenchmarkRuns
} from "../../services/civicJourneyBenchmarkService.js";
import { BenchmarkDisclaimer, BenchmarkErrorState, ScoreBadge } from "./BenchmarkStates.jsx";
import { BenchmarkSuiteSelector } from "./BenchmarkSuiteSelector.jsx";
import { BenchmarkResultsPanel } from "./BenchmarkResultsPanel.jsx";
import { Download, Play, Save, History, CheckCircle, Shield } from "lucide-react";

export function JourneyBenchmarkWorkspace() {
  const [suites] = useState(BENCHMARK_SUITES);
  const [tasks] = useState(BENCHMARK_TASKS);
  const [models] = useState(BENCHMARK_MODELS);

  const [selectedSuiteId, setSelectedSuiteId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState(BENCHMARK_TASKS[0].id);
  const [selectedModelId, setSelectedModelId] = useState("civic-help-setu-grounded-v1");

  const [customCandidateOutput, setCustomCandidateOutput] = useState("");
  const [activeTask, setActiveTask] = useState(BENCHMARK_TASKS[0]);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [suiteRunSummary, setSuiteRunSummary] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [savedRuns, setSavedRuns] = useState([]);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  // Update active task when selectedTaskId changes
  useEffect(() => {
    const found = tasks.find(t => t.id === selectedTaskId);
    if (found) {
      setActiveTask(found);
      setEvaluationResult(null);
      setSaveSuccessMsg("");
    }
  }, [selectedTaskId, tasks]);

  // Load saved runs on mount
  useEffect(() => {
    try {
      setSavedRuns(listSavedBenchmarkRuns());
    } catch (_e) {
      // ignore
    }
  }, []);

  // Run single evaluation
  const handleEvaluateTask = () => {
    setIsLoading(true);
    setErrorMessage("");
    setSaveSuccessMsg("");

    try {
      let outputToTest = customCandidateOutput;
      if (!outputToTest || selectedModelId !== "custom-candidate") {
        // Trigger automated reference generation or evaluate current custom text
        const mockSummary = runSuiteEvaluation(activeTask.suiteId, selectedModelId);
        const taskResult = mockSummary.results.find(r => r.taskId === activeTask.id);
        setEvaluationResult(taskResult || null);
      } else {
        const result = evaluateTaskOutput(activeTask, outputToTest, selectedModelId);
        setEvaluationResult(result);
      }
    } catch (err) {
      setErrorMessage(err.message || "Evaluation failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Run full suite
  const handleRunSuite = () => {
    setIsLoading(true);
    setErrorMessage("");
    setSaveSuccessMsg("");

    try {
      const summary = runSuiteEvaluation(selectedSuiteId || null, selectedModelId);
      setSuiteRunSummary(summary);
      if (summary.results.length > 0) {
        setEvaluationResult(summary.results[0]);
        setSelectedTaskId(summary.results[0].taskId);
      }
    } catch (err) {
      setErrorMessage(err.message || "Failed running benchmark suite");
    } finally {
      setIsLoading(false);
    }
  };

  // Export dataset
  const handleExportDataset = () => {
    const dataset = exportBenchmarkDataset(selectedSuiteId || null);
    const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `civic_journey_benchmark_${selectedSuiteId || "all"}_v1.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Save run
  const handleSaveCurrentRun = () => {
    if (!evaluationResult) return;
    try {
      const summaryToSave = suiteRunSummary || {
        runId: `run_${Date.now()}_single`,
        suiteId: activeTask.suiteId,
        suiteName: activeTask.suiteId,
        modelId: selectedModelId,
        timestamp: new Date().toISOString(),
        taskCount: 1,
        passedCount: evaluationResult.passed ? 1 : 0,
        failedCount: evaluationResult.passed ? 0 : 1,
        passRate: evaluationResult.passed ? 1.0 : 0.0,
        meanScore: evaluationResult.compositeScore,
        results: [evaluationResult]
      };

      saveBenchmarkRun(summaryToSave);
      setSavedRuns(listSavedBenchmarkRuns());
      setSaveSuccessMsg(`Benchmark run '${summaryToSave.runId}' saved to audit ledger.`);
    } catch (err) {
      setErrorMessage("Failed to save run: " + err.message);
    }
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "1.5rem" }}>
      {/* Disclaimer and Canary Token */}
      <BenchmarkDisclaimer canaryToken={BENCHMARK_CANARY_TOKEN} />

      {/* Error state */}
      {errorMessage && (
        <BenchmarkErrorState error={errorMessage} onRetry={() => setErrorMessage("")} />
      )}

      {/* Save success toast */}
      {saveSuccessMsg && (
        <div
          role="status"
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            borderRadius: "0.375rem",
            color: "#065f46",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem"
          }}
        >
          <CheckCircle style={{ width: "16px", height: "16px" }} />
          {saveSuccessMsg}
        </div>
      )}

      {/* Suite Selector & Model Configuration */}
      <BenchmarkSuiteSelector
        suites={suites}
        selectedSuiteId={selectedSuiteId}
        onSelectSuite={setSelectedSuiteId}
        tasks={tasks}
        selectedTaskId={selectedTaskId}
        onSelectTask={setSelectedTaskId}
        models={models}
        selectedModelId={selectedModelId}
        onSelectModel={setSelectedModelId}
        onRunSuite={handleRunSuite}
        isRunningSuite={isLoading}
      />

      {/* Active Task Details & Candidate Input Area */}
      {activeTask && (
        <div
          style={{
            marginTop: "1.5rem",
            padding: "1.25rem",
            background: "var(--color-bg-primary, #ffffff)",
            border: "1px solid var(--color-border, #e2e8f0)",
            borderRadius: "0.5rem"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
            <div>
              <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "#2563eb", textTransform: "uppercase" }}>
                Task: {activeTask.id} ({activeTask.suiteId})
              </span>
              <h3 style={{ margin: "0.25rem 0", fontSize: "1.1rem" }}>{activeTask.title}</h3>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-secondary, #64748b)" }}>
                {activeTask.description}
              </p>
            </div>
            <button
              onClick={handleExportDataset}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.4rem 0.75rem",
                background: "var(--color-bg-secondary, #f1f5f9)",
                border: "1px solid var(--color-border, #cbd5e1)",
                borderRadius: "0.375rem",
                fontSize: "0.8rem",
                cursor: "pointer"
              }}
            >
              <Download style={{ width: "14px", height: "14px" }} />
              Export Dataset JSON
            </button>
          </div>

          {/* Citizen Prompt */}
          <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "0.375rem", marginBottom: "1rem" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#475569", display: "block", marginBottom: "0.25rem" }}>
              Citizen Query Prompt ({activeTask.language}):
            </label>
            <div style={{ fontSize: "0.9rem", color: "#0f172a", fontStyle: "italic" }}>
              "{activeTask.inputPrompt}"
            </div>
          </div>

          {/* Candidate Output editor (for custom candidate evaluation) */}
          {selectedModelId === "custom-candidate" && (
            <div style={{ marginBottom: "1rem" }}>
              <label htmlFor="custom-output-input" style={{ fontSize: "0.85rem", fontWeight: "600", display: "block", marginBottom: "0.4rem" }}>
                Candidate Assistant Output to Evaluate:
              </label>
              <textarea
                id="custom-output-input"
                rows={6}
                value={customCandidateOutput}
                onChange={(e) => setCustomCandidateOutput(e.target.value)}
                placeholder="Paste agent response text here to score against official citations, actions, and safety rules..."
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "0.85rem",
                  borderRadius: "0.375rem",
                  border: "1px solid var(--color-border, #cbd5e1)",
                  fontFamily: "inherit"
                }}
              />
            </div>
          )}

          {/* Evaluate Action Button */}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={handleEvaluateTask}
              disabled={isLoading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 1.25rem",
                background: "#059669",
                color: "#ffffff",
                border: "none",
                borderRadius: "0.375rem",
                fontWeight: "600",
                fontSize: "0.9rem",
                cursor: isLoading ? "not-allowed" : "pointer"
              }}
            >
              <Play style={{ width: "16px", height: "16px" }} />
              {isLoading ? "Evaluating..." : "Evaluate Task"}
            </button>

            {evaluationResult && (
              <button
                onClick={handleSaveCurrentRun}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem 1rem",
                  background: "var(--color-bg-secondary, #f8fafc)",
                  border: "1px solid var(--color-border, #cbd5e1)",
                  borderRadius: "0.375rem",
                  fontSize: "0.85rem",
                  cursor: "pointer"
                }}
              >
                <Save style={{ width: "15px", height: "15px" }} />
                Save Run to Ledger
              </button>
            )}
          </div>
        </div>
      )}

      {/* Suite Summary Bar */}
      {suiteRunSummary && (
        <div
          role="region"
          aria-label="Suite Summary Metrics"
          style={{
            marginTop: "1.5rem",
            padding: "1rem 1.25rem",
            background: "#f0fdfa",
            border: "1px solid #99f6e4",
            borderRadius: "0.5rem",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem"
          }}
        >
          <div>
            <h4 style={{ margin: "0 0 0.25rem 0", color: "#115e59" }}>
              Suite Run Summary: {suiteRunSummary.suiteName}
            </h4>
            <div style={{ fontSize: "0.85rem", color: "#0f766e" }}>
              Model: <strong>{suiteRunSummary.modelId}</strong> | Pass Rate: {Math.round(suiteRunSummary.passRate * 100)}% ({suiteRunSummary.passedCount}/{suiteRunSummary.taskCount} passed)
            </div>
          </div>
          <div>
            <ScoreBadge score={suiteRunSummary.meanScore} threshold={0.80} />
          </div>
        </div>
      )}

      {/* Evaluation Results Panel */}
      {evaluationResult && (
        <BenchmarkResultsPanel result={evaluationResult} task={activeTask} />
      )}

      {/* Saved Audit Runs List */}
      {savedRuns && savedRuns.length > 0 && (
        <div
          style={{
            marginTop: "2rem",
            padding: "1.25rem",
            background: "var(--color-bg-primary, #ffffff)",
            border: "1px solid var(--color-border, #e2e8f0)",
            borderRadius: "0.5rem"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <History style={{ width: "18px", height: "18px", color: "#64748b" }} />
            <h3 style={{ margin: 0, fontSize: "1rem" }}>Saved Benchmark Audit History ({savedRuns.length})</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {savedRuns.slice(0, 5).map(run => (
              <div
                key={run.runId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem 0.75rem",
                  background: "var(--color-bg-secondary, #f8fafc)",
                  borderRadius: "0.25rem",
                  fontSize: "0.8rem"
                }}
              >
                <span>
                  <strong>{run.runId}</strong> ({run.modelId}) — {new Date(run.timestamp).toLocaleString()}
                </span>
                <span style={{ fontWeight: "bold" }}>
                  Pass Rate: {Math.round((run.passRate || 0) * 100)}% | Mean: {Math.round((run.meanScore || 0) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
