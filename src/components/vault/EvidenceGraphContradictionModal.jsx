import { useState, useMemo, useCallback } from 'react';
import {
  GitCompare,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  FileText,
  X,
  Info,
  Layers,
  Copy,
  Sparkles,
  Table as TableIcon,
  LayoutGrid,
  Lock,
} from 'lucide-react';
import {
  buildCivicEvidenceGraph,
  resolveGraphConflict,
  generateEvidenceGraphReport,
  EVIDENCE_GRAPH_DISCLAIMER,
} from '../../services/civicEvidenceGraphService';
import {
  CONFLICT_SEVERITIES,
  RESOLUTION_STATUSES,
  RESOLUTION_ACTIONS,
} from '../../services/civicEvidenceGraphSchemas';
import { maskSensitiveField } from '../../services/documentOcrExtractionAssistantService';
import { SYNTHETIC_VAULT_DOCUMENTS } from '../../../tests/fixtures/syntheticEvidenceFixtures';

export default function EvidenceGraphContradictionModal({
  isOpen,
  onClose,
  documents = [],
  isLocked = false,
}) {
  const [activeTab, setActiveTab] = useState('cards'); // 'cards' | 'table' | 'report'
  const [syntheticDocs, setSyntheticDocs] = useState(null);
  const [persistedGraph, setPersistedGraph] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState({});
  const [copyNotice, setCopyNotice] = useState(false);

  const activeDocuments = syntheticDocs || documents;

  // Compute graph on documents change or user resolution
  const graph = useMemo(() => {
    return buildCivicEvidenceGraph({
      documents: activeDocuments,
      existingGraph: persistedGraph,
    });
  }, [activeDocuments, persistedGraph]);

  const handleResolve = useCallback(
    (conflictId, actionTaken, preferredFactId) => {
      const note = resolutionNotes[conflictId] || '';
      try {
        const updated = resolveGraphConflict({
          graph,
          conflictId,
          resolution: {
            actionTaken,
            preferredFactId,
            citizenNote: note,
          },
        });
        setPersistedGraph(updated);
      } catch (err) {
        console.error('Failed to resolve conflict:', err);
      }
    },
    [graph, resolutionNotes]
  );

  const handleReopen = useCallback(
    (conflictId) => {
      if (!persistedGraph) return;
      const updatedConflicts = persistedGraph.edges.conflicts.map((c) => {
        if (c.id === conflictId) {
          return {
            ...c,
            resolutionStatus: RESOLUTION_STATUSES.UNRESOLVED,
            resolution: undefined,
          };
        }
        return c;
      });
      setPersistedGraph({
        ...persistedGraph,
        edges: {
          ...persistedGraph.edges,
          conflicts: updatedConflicts,
        },
      });
    },
    [persistedGraph]
  );

  const handleLoadSyntheticDocs = () => {
    setSyntheticDocs(SYNTHETIC_VAULT_DOCUMENTS);
  };

  const handleCopyReport = () => {
    const reportText = generateEvidenceGraphReport(graph);
    navigator.clipboard.writeText(reportText);
    setCopyNotice(true);
    setTimeout(() => setCopyNotice(false), 2500);
  };

  if (!isOpen) return null;

  if (isLocked) {
    return (
      <div
        className="modal-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1050,
          padding: '1rem',
          backdropFilter: 'blur(3px)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-graph-locked-title"
      >
        <div
          className="modal-content"
          style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '480px',
            padding: '2rem',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto',
            }}
          >
            <Lock size={24} />
          </div>
          <h3 id="evidence-graph-locked-title" style={{ margin: '0 0 0.5rem 0', color: '#1e293b' }}>
            Vault Locked for Privacy
          </h3>
          <p style={{ margin: '0 0 1.5rem 0', color: '#64748b', fontSize: '0.9rem' }}>
            Please unlock your encrypted vault with your passphrase to access cross-document contradiction detection.
          </p>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  const conflicts = graph.edges?.conflicts || [];
  const criticalCount = graph.summary?.unresolvedCriticalCount || 0;
  const warningCount = graph.summary?.unresolvedWarningCount || 0;
  const nearMatchCount = graph.summary?.nearMatchCount || 0;

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '1rem',
        backdropFilter: 'blur(3px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-graph-modal-title"
    >
      <div
        className="modal-content"
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '920px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: '#e0e7ff',
                color: '#4338ca',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <GitCompare size={22} />
            </div>
            <div>
              <h2
                id="evidence-graph-modal-title"
                style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#1e293b' }}
              >
                Civic Evidence Graph: Discrepancy Detector
              </h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                Cross-document verification across names, dates of birth, and reference IDs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '0.5rem',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Legal Advisory Banner */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#eff6ff',
            borderBottom: '1px solid #bfdbfe',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.85rem',
            color: '#1e40af',
          }}
          role="note"
        >
          <Info size={16} style={{ flexShrink: 0 }} />
          <span>{EVIDENCE_GRAPH_DISCLAIMER}</span>
        </div>

        {/* Metric Badges & View Switcher */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '0.8rem',
                padding: '0.25rem 0.6rem',
                borderRadius: '9999px',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                fontWeight: 500,
              }}
            >
              Docs: {graph.documentCount}
            </span>
            <span
              style={{
                fontSize: '0.8rem',
                padding: '0.25rem 0.6rem',
                borderRadius: '9999px',
                backgroundColor: criticalCount > 0 ? '#fee2e2' : '#dcfce7',
                color: criticalCount > 0 ? '#b91c1c' : '#15803d',
                fontWeight: 600,
              }}
            >
              {criticalCount} Critical Mismatches
            </span>
            <span
              style={{
                fontSize: '0.8rem',
                padding: '0.25rem 0.6rem',
                borderRadius: '9999px',
                backgroundColor: warningCount > 0 ? '#fef3c7' : '#f1f5f9',
                color: warningCount > 0 ? '#b45309' : '#64748b',
                fontWeight: 500,
              }}
            >
              {warningCount} Warnings
            </span>
            <span
              style={{
                fontSize: '0.8rem',
                padding: '0.25rem 0.6rem',
                borderRadius: '9999px',
                backgroundColor: '#e0e7ff',
                color: '#4338ca',
                fontWeight: 500,
              }}
            >
              {nearMatchCount} Near Matches
            </span>
          </div>

          {/* Tab Controls */}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => setActiveTab('cards')}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.85rem',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activeTab === 'cards' ? '#6366f1' : '#cbd5e1',
                backgroundColor: activeTab === 'cards' ? '#eef2ff' : '#fff',
                color: activeTab === 'cards' ? '#4f46e5' : '#475569',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: activeTab === 'cards' ? 600 : 400,
              }}
            >
              <LayoutGrid size={15} />
              <span>Cards View</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('table')}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.85rem',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activeTab === 'table' ? '#6366f1' : '#cbd5e1',
                backgroundColor: activeTab === 'table' ? '#eef2ff' : '#fff',
                color: activeTab === 'table' ? '#4f46e5' : '#475569',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: activeTab === 'table' ? 600 : 400,
              }}
              aria-label="Accessible Table Fallback View"
            >
              <TableIcon size={15} />
              <span>Accessible Table</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('report')}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.85rem',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activeTab === 'report' ? '#6366f1' : '#cbd5e1',
                backgroundColor: activeTab === 'report' ? '#eef2ff' : '#fff',
                color: activeTab === 'report' ? '#4f46e5' : '#475569',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: activeTab === 'report' ? 600 : 400,
              }}
            >
              <FileText size={15} />
              <span>Audit Report</span>
            </button>
          </div>
        </div>

        {/* Main Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
          {/* Empty State */}
          {activeDocuments.length < 2 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2.5rem 1rem',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1',
              }}
            >
              <Layers size={36} style={{ color: '#94a3b8', margin: '0 auto 0.75rem auto' }} />
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e293b' }}>
                At least 2 documents needed for cross-verification
              </h3>
              <p style={{ margin: '0 0 1.25rem 0', color: '#64748b', fontSize: '0.9rem' }}>
                Add more identity cards, school certificates, or acknowledgement slips to your vault.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleLoadSyntheticDocs}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.9rem',
                }}
              >
                <Sparkles size={16} />
                <span>Load Synthetic Test Documents</span>
              </button>
            </div>
          ) : conflicts.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                backgroundColor: '#f0fdf4',
                borderRadius: '8px',
                border: '1px solid #bbf7d0',
              }}
            >
              <CheckCircle2 size={40} style={{ color: '#16a34a', margin: '0 auto 0.75rem auto' }} />
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#14532d' }}>
                No Cross-Document Discrepancies Found!
              </h3>
              <p style={{ margin: 0, color: '#166534', fontSize: '0.9rem' }}>
                Your inspected records have consistent names, dates of birth, and tracking numbers.
              </p>
            </div>
          ) : activeTab === 'cards' ? (
            /* Cards View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {conflicts.map((edge) => {
                const factA = graph.nodes.facts[edge.sourceFactId];
                const factB = graph.nodes.facts[edge.targetFactId];
                const isResolved = edge.resolutionStatus !== RESOLUTION_STATUSES.UNRESOLVED;
                const isCritical = edge.severity === CONFLICT_SEVERITIES.CRITICAL;

                return (
                  <div
                    key={edge.id}
                    style={{
                      border: '1px solid',
                      borderColor: isResolved ? '#e2e8f0' : isCritical ? '#fca5a5' : '#fde68a',
                      borderRadius: '10px',
                      backgroundColor: isResolved ? '#f8fafc' : '#ffffff',
                      overflow: 'hidden',
                      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    {/* Discrepancy Header */}
                    <div
                      style={{
                        padding: '0.75rem 1rem',
                        backgroundColor: isResolved
                          ? '#f1f5f9'
                          : isCritical
                            ? '#fef2f2'
                            : '#fffbeb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {isCritical ? (
                          <AlertCircle size={18} style={{ color: '#dc2626' }} />
                        ) : (
                          <AlertTriangle size={18} style={{ color: '#d97706' }} />
                        )}
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            color: isCritical ? '#991b1b' : '#92400e',
                          }}
                        >
                          {edge.diagnosticMessage}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: isResolved ? '#dcfce7' : isCritical ? '#fee2e2' : '#fef3c7',
                          color: isResolved ? '#15803d' : isCritical ? '#b91c1c' : '#b45309',
                        }}
                      >
                        {isResolved ? 'RESOLVED' : edge.severity}
                      </span>
                    </div>

                    {/* Side-by-Side Comparison */}
                    <div
                      style={{
                        padding: '1rem',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                        gap: '1rem',
                        borderBottom: '1px solid #f1f5f9',
                      }}
                    >
                      {/* Record A */}
                      <div
                        style={{
                          padding: '0.75rem',
                          borderRadius: '8px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                          Source: {factA?.provenance?.documentType || 'Document A'}
                        </div>
                        <div
                          style={{
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: '#0f172a',
                            marginBottom: '0.4rem',
                          }}
                        >
                          {maskSensitiveField(factA?.rawValue, factA?.factType)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          Confidence: {Math.round((factA?.provenance?.ocrConfidence || 0) * 100)}% (
                          {factA?.provenance?.confidenceTier})
                        </div>
                      </div>

                      {/* Record B */}
                      <div
                        style={{
                          padding: '0.75rem',
                          borderRadius: '8px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                          Source: {factB?.provenance?.documentType || 'Document B'}
                        </div>
                        <div
                          style={{
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: '#0f172a',
                            marginBottom: '0.4rem',
                          }}
                        >
                          {maskSensitiveField(factB?.rawValue, factB?.factType)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          Confidence: {Math.round((factB?.provenance?.ocrConfidence || 0) * 100)}% (
                          {factB?.provenance?.confidenceTier})
                        </div>
                      </div>
                    </div>

                    {/* Resolution Section */}
                    <div style={{ padding: '0.75rem 1rem', backgroundColor: '#ffffff' }}>
                      {isResolved ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.5rem',
                          }}
                        >
                          <div style={{ fontSize: '0.85rem', color: '#15803d' }}>
                            <strong>Citizen Action:</strong> {edge.resolution?.actionTaken}
                            {edge.resolution?.citizenNote && (
                              <span> &mdash; &ldquo;{edge.resolution.citizenNote}&rdquo;</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleReopen(edge.id)}
                            style={{
                              background: 'transparent',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              color: '#475569',
                            }}
                          >
                            Reopen
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div
                            style={{
                              fontSize: '0.85rem',
                              color: '#475569',
                              marginBottom: '0.5rem',
                            }}
                          >
                            {edge.suggestedResolution}
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              gap: '0.5rem',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              marginBottom: '0.5rem',
                            }}
                          >
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                              onClick={() =>
                                handleResolve(edge.id, RESOLUTION_ACTIONS.USE_SOURCE_A, edge.sourceFactId)
                              }
                            >
                              Authoritative: {factA?.provenance?.documentType}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                              onClick={() =>
                                handleResolve(edge.id, RESOLUTION_ACTIONS.USE_SOURCE_B, edge.targetFactId)
                              }
                            >
                              Authoritative: {factB?.provenance?.documentType}
                            </button>
                            {edge.isFalseContradiction && (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                                onClick={() => handleResolve(edge.id, RESOLUTION_ACTIONS.IGNORE_TYPO)}
                              >
                                Acceptable Typo / Alias
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            placeholder="Optional explanation / affidavit note for record..."
                            value={resolutionNotes[edge.id] || ''}
                            onChange={(e) =>
                              setResolutionNotes({
                                ...resolutionNotes,
                                [edge.id]: e.target.value,
                              })
                            }
                            style={{
                              width: '100%',
                              padding: '0.4rem 0.6rem',
                              fontSize: '0.8rem',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : activeTab === 'table' ? (
            /* Accessible Table Fallback (WCAG AA Compliant) */
            <div style={{ overflowX: 'auto' }}>
              <table
                role="table"
                aria-label="Cross-Document Discrepancy Table"
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.85rem',
                  textAlign: 'left',
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '0.75rem', fontWeight: 600, color: '#334155' }}>Type</th>
                    <th style={{ padding: '0.75rem', fontWeight: 600, color: '#334155' }}>Severity</th>
                    <th style={{ padding: '0.75rem', fontWeight: 600, color: '#334155' }}>Record A</th>
                    <th style={{ padding: '0.75rem', fontWeight: 600, color: '#334155' }}>Record B</th>
                    <th style={{ padding: '0.75rem', fontWeight: 600, color: '#334155' }}>Status</th>
                    <th style={{ padding: '0.75rem', fontWeight: 600, color: '#334155' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {conflicts.map((edge) => {
                    const factA = graph.nodes.facts[edge.sourceFactId];
                    const factB = graph.nodes.facts[edge.targetFactId];
                    const isResolved = edge.resolutionStatus !== RESOLUTION_STATUSES.UNRESOLVED;

                    return (
                      <tr key={edge.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '0.75rem', color: '#1e293b' }}>{edge.factType}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color:
                                edge.severity === CONFLICT_SEVERITIES.CRITICAL
                                  ? '#dc2626'
                                  : '#d97706',
                            }}
                          >
                            {edge.severity}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', color: '#334155' }}>
                          {maskSensitiveField(factA?.rawValue, factA?.factType)}
                          <br />
                          <small style={{ color: '#64748b' }}>
                            ({factA?.provenance?.documentType})
                          </small>
                        </td>
                        <td style={{ padding: '0.75rem', color: '#334155' }}>
                          {maskSensitiveField(factB?.rawValue, factB?.factType)}
                          <br />
                          <small style={{ color: '#64748b' }}>
                            ({factB?.provenance?.documentType})
                          </small>
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          {isResolved ? (
                            <span style={{ color: '#16a34a', fontWeight: 600 }}>Resolved</span>
                          ) : (
                            <span style={{ color: '#ea580c', fontWeight: 600 }}>Action Required</span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          {isResolved ? (
                            <button
                              type="button"
                              onClick={() => handleReopen(edge.id)}
                              style={{
                                padding: '0.2rem 0.5rem',
                                fontSize: '0.75rem',
                                border: '1px solid #cbd5e1',
                                background: '#fff',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            >
                              Reopen
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleResolve(edge.id, RESOLUTION_ACTIONS.USE_SOURCE_A, edge.sourceFactId)
                              }
                              style={{
                                padding: '0.2rem 0.5rem',
                                fontSize: '0.75rem',
                                border: '1px solid #4f46e5',
                                background: '#4f46e5',
                                color: '#fff',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            >
                              Use Doc A
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Report & Export View */
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                }}
              >
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Printable, privacy-sanitized discrepancy summary for citizen records.
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCopyReport}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.8rem',
                    padding: '0.35rem 0.75rem',
                  }}
                >
                  <Copy size={15} />
                  <span>{copyNotice ? 'Copied!' : 'Copy Summary'}</span>
                </button>
              </div>
              <pre
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '1rem',
                  fontSize: '0.8rem',
                  color: '#334155',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '400px',
                  overflowY: 'auto',
                }}
              >
                {generateEvidenceGraphReport(graph)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
