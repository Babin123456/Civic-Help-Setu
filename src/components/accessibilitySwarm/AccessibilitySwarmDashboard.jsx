import React, { useState } from 'react';
import {
  AGENT_MODALITIES,
  FINDING_SEVERITY,
  VERIFICATION_STATUS
} from '../../services/accessibilitySwarm/swarmSchemas.js';

export function AccessibilitySwarmDashboard({
  auditReport,
  onRunAudit,
  onReviewFinding,
  isLoading = false
}) {
  const [selectedModality, setSelectedModality] = useState('ALL');
  const [activeTab, setActiveTab] = useState('CLUSTERS'); // 'CLUSTERS' | 'HUMAN_REVIEW' | 'RAW'
  const [nonAiFallback, setNonAiFallback] = useState(false);
  const [reviewNotes, setReviewNotes] = useState({});

  const clusters = auditReport?.clusters || [];
  const findings = auditReport?.findings || [];
  const pendingReviews = findings.filter(
    f => f.verificationStatus === VERIFICATION_STATUS.UNVERIFIED_SUGGESTION
  );

  const filteredClusters = selectedModality === 'ALL'
    ? clusters
    : clusters.filter(c => c.modalitiesInvolved.includes(selectedModality));

  const healthScore = auditReport?.healthScore ?? 100;

  return (
    <section
      className="p-4 sm:p-6 bg-white dark:bg-slate-900 rounded-xl shadow border border-slate-200 dark:border-slate-800"
      aria-label="Civic Accessibility Swarm Testing Dashboard"
    >
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Multi-Modal Accessibility Swarm
            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              v1.0.0
            </span>
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Complementary audits for keyboard, screen reader, contrast, language clarity, and mobile layout.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={nonAiFallback}
              onChange={e => setNonAiFallback(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            Non-AI Fallback Only
          </label>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => onRunAudit?.({ nonAiFallback })}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 min-h-[44px] min-w-[44px]"
          >
            {isLoading ? 'Running Swarm...' : 'Run Swarm Audit'}
          </button>
        </div>
      </header>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <span className="text-xs text-slate-500 dark:text-slate-400">Civic Health Score</span>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {healthScore}/100
          </div>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <span className="text-xs text-slate-500 dark:text-slate-400">Unique Root Causes</span>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {clusters.length}
          </div>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <span className="text-xs text-slate-500 dark:text-slate-400">Total Raw Findings</span>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {findings.length}
          </div>
        </div>
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-800">
          <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">Pending Human Signoff</span>
          <div className="text-2xl font-bold text-amber-800 dark:text-amber-200">
            {pendingReviews.length}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('CLUSTERS')}
          className={`pb-2 px-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'CLUSTERS'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          Root Cause Clusters ({clusters.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('HUMAN_REVIEW')}
          className={`pb-2 px-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'HUMAN_REVIEW'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          Subjective Review Queue ({pendingReviews.length})
        </button>
      </div>

      {/* Filter by Modality */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
        <span className="text-xs text-slate-500">Filter Modality:</span>
        <button
          type="button"
          onClick={() => setSelectedModality('ALL')}
          className={`text-xs px-2.5 py-1 rounded-full transition ${
            selectedModality === 'ALL'
              ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          All Modalities
        </button>
        {Object.values(AGENT_MODALITIES).map(mod => (
          <button
            key={mod}
            type="button"
            onClick={() => setSelectedModality(mod)}
            className={`text-xs px-2.5 py-1 rounded-full capitalize transition ${
              selectedModality === mod
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {mod.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* View: Clusters */}
      {activeTab === 'CLUSTERS' && (
        <div className="space-y-4">
          {filteredClusters.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No defects discovered in this filter slice.</p>
          ) : (
            filteredClusters.map(cluster => (
              <div
                key={cluster.clusterId}
                className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-semibold uppercase ${
                        cluster.severity === FINDING_SEVERITY.CRITICAL
                          ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          : cluster.severity === FINDING_SEVERITY.HIGH
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      }`}
                    >
                      {cluster.severity}
                    </span>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                      {cluster.rootCauseSummary}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {cluster.count} {cluster.count === 1 ? 'Finding' : 'Correlated Findings'}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                  <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                    {cluster.targetSelector || 'global document'}
                  </span>
                </p>

                <div className="flex gap-1.5 flex-wrap">
                  {cluster.modalitiesInvolved.map(mod => (
                    <span
                      key={mod}
                      className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 capitalize"
                    >
                      {mod.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* View: Subjective Human Review Queue */}
      {activeTab === 'HUMAN_REVIEW' && (
        <div className="space-y-4">
          {pendingReviews.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              All subjective items have been reviewed or none were detected.
            </p>
          ) : (
            pendingReviews.map(finding => (
              <div
                key={finding.id}
                className="p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20"
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div>
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 font-semibold mr-2">
                      UNVERIFIED AI SUGGESTION
                    </span>
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 inline">
                      {finding.title}
                    </h4>
                  </div>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 mb-2">
                  {finding.description}
                </p>

                <div className="text-xs bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 mb-3">
                  <span className="font-semibold block mb-1">Proposed Remedy:</span>
                  {finding.remedyRecommendation}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-amber-200 dark:border-amber-800">
                  <input
                    type="text"
                    placeholder="Maintainer sign-off notes or context..."
                    value={reviewNotes[finding.id] || ''}
                    onChange={e =>
                      setReviewNotes({ ...reviewNotes, [finding.id]: e.target.value })
                    }
                    className="text-xs px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 flex-1"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onReviewFinding?.(finding.id, {
                          approved: true,
                          notes: reviewNotes[finding.id]
                        })
                      }
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium"
                    >
                      Approve Finding
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onReviewFinding?.(finding.id, {
                          approved: false,
                          notes: reviewNotes[finding.id]
                        })
                      }
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-xs font-medium dark:bg-slate-800 dark:text-slate-200"
                    >
                      Reject (False-Positive)
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
export default AccessibilitySwarmDashboard;
