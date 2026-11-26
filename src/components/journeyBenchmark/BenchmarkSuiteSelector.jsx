import React from "react";
import { FolderGit2, FileText, CheckCircle, Award, Terminal } from "lucide-react";

export function BenchmarkSuiteSelector({
  suites = [],
  selectedSuiteId,
  onSelectSuite,
  tasks = [],
  selectedTaskId,
  onSelectTask,
  models = [],
  selectedModelId,
  onSelectModel,
  onRunSuite,
  isRunningSuite
}) {
  const filteredTasks = selectedSuiteId
    ? tasks.filter(t => t.suiteId === selectedSuiteId)
    : tasks;

  return (
    <div
      role="region"
      aria-label="Benchmark Suite & Task Selector"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        background: "var(--color-bg-primary, #ffffff)",
        padding: "1.25rem",
        border: "1px solid var(--color-border, #e2e8f0)",
        borderRadius: "0.5rem"
      }}
    >
      {/* Model Selection & Suite Action */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <label htmlFor="model-select" style={{ fontSize: "0.85rem", fontWeight: "600" }}>
            Candidate / Model:
          </label>
          <select
            id="model-select"
            value={selectedModelId}
            onChange={(e) => onSelectModel(e.target.value)}
            style={{
              padding: "0.4rem 0.75rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--color-border, #cbd5e1)",
              background: "inherit",
              fontSize: "0.85rem"
            }}
          >
            {models.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.type})
              </option>
            ))}
            <option value="custom-candidate">Custom Candidate Prompt / Output</option>
          </select>
        </div>

        <button
          onClick={onRunSuite}
          disabled={isRunningSuite}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            background: "#2563eb",
            color: "#ffffff",
            border: "none",
            borderRadius: "0.375rem",
            cursor: isRunningSuite ? "not-allowed" : "pointer",
            fontWeight: "600",
            fontSize: "0.85rem",
            opacity: isRunningSuite ? 0.7 : 1
          }}
        >
          <Award style={{ width: "16px", height: "16px" }} />
          {isRunningSuite ? "Evaluating Suite..." : "Run Entire Benchmark Suite"}
        </button>
      </div>

      {/* Suite Tabs */}
      <div>
        <label style={{ fontSize: "0.85rem", fontWeight: "600", display: "block", marginBottom: "0.5rem" }}>
          Benchmark Suites:
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <button
            onClick={() => onSelectSuite("")}
            style={{
              padding: "0.4rem 0.75rem",
              borderRadius: "0.375rem",
              fontSize: "0.8rem",
              border: selectedSuiteId === "" ? "2px solid #2563eb" : "1px solid var(--color-border, #cbd5e1)",
              background: selectedSuiteId === "" ? "#eff6ff" : "inherit",
              color: selectedSuiteId === "" ? "#1d4ed8" : "inherit",
              cursor: "pointer"
            }}
          >
            All Suites ({tasks.length} tasks)
          </button>
          {suites.map(suite => (
            <button
              key={suite.id}
              onClick={() => onSelectSuite(suite.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.4rem 0.75rem",
                borderRadius: "0.375rem",
                fontSize: "0.8rem",
                border: selectedSuiteId === suite.id ? "2px solid #2563eb" : "1px solid var(--color-border, #cbd5e1)",
                background: selectedSuiteId === suite.id ? "#eff6ff" : "inherit",
                color: selectedSuiteId === suite.id ? "#1d4ed8" : "inherit",
                cursor: "pointer"
              }}
            >
              <FolderGit2 style={{ width: "14px", height: "14px" }} />
              {suite.name} ({suite.taskCount || tasks.filter(t => t.suiteId === suite.id).length})
            </button>
          ))}
        </div>
      </div>

      {/* Task Selection Cards */}
      <div>
        <label style={{ fontSize: "0.85rem", fontWeight: "600", display: "block", marginBottom: "0.5rem" }}>
          Select Specific Scenario Task:
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
          {filteredTasks.map(task => {
            const isSelected = selectedTaskId === task.id;
            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelectTask(task.id); }}
                style={{
                  padding: "0.75rem",
                  border: isSelected ? "2px solid #2563eb" : "1px solid var(--color-border, #e2e8f0)",
                  background: isSelected ? "#f8faff" : "var(--color-bg-secondary, #f8fafc)",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: "600", color: isSelected ? "#1d4ed8" : "inherit" }}>
                    {task.title}
                  </span>
                  <span style={{ fontSize: "0.7rem", background: "#e2e8f0", padding: "0.1rem 0.35rem", borderRadius: "0.2rem" }}>
                    {task.language}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.3 }}>
                  {task.description.slice(0, 110)}...
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
