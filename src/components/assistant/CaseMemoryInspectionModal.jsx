import { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Trash2,
  CheckCircle,
  Download,
  Plus,
  X,
  FileText,
  Sparkles,
  Info,
} from 'lucide-react';
import { caseMemoryEngine } from '../../services/agentMemory/caseMemoryEngine';
import {
  MEMORY_ENTRY_TYPES,
  MEMORY_CATEGORIES,
} from '../../services/agentMemory/memoryClassifier';

const CaseMemoryInspectionModal = ({
  isOpen,
  onClose,
  tenantId = 'default',
  caseId = 'general-consultation',
  citizenSecret = '',
}) => {
  const [activeTab, setActiveTab] = useState('facts'); // 'facts' | 'proposals'
  const [memories, setMemories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newText, setNewText] = useState('');
  const [newCategory, setNewCategory] = useState(MEMORY_CATEGORIES.INTERACTION_SUMMARY);
  const [confirmPurge, setConfirmPurge] = useState(false);

  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  const loadMemories = async () => {
    setIsLoading(true);
    try {
      const data = await caseMemoryEngine.queryCaseMemory(
        tenantId,
        caseId,
        {},
        { tenantId, caseId },
        citizenSecret
      );
      setMemories(data);
    } catch {
      setStatusMessage('Failed to load case memory.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    caseMemoryEngine
      .queryCaseMemory(tenantId, caseId, {}, { tenantId, caseId }, citizenSecret)
      .then((data) => {
        if (isMounted) {
          setMemories(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setStatusMessage('Failed to load case memory.');
          setIsLoading(false);
        }
      });
    closeButtonRef.current?.focus();
    return () => {
      isMounted = false;
    };
  }, [isOpen, tenantId, caseId, citizenSecret]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const factualNotes = memories.filter((m) => m.entryType === MEMORY_ENTRY_TYPES.FACTUAL_NOTE);
  const modelProposals = memories.filter((m) => m.entryType === MEMORY_ENTRY_TYPES.MODEL_PROPOSAL);

  const handleAddFactualNote = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newText.trim()) return;

    try {
      await caseMemoryEngine.recordFactualNote({
        tenantId,
        caseId,
        title: newTitle.trim(),
        text: newText.trim(),
        category: newCategory,
        citizenSecret,
        requestingContext: { tenantId, caseId },
      });
      setNewTitle('');
      setNewText('');
      setShowAddForm(false);
      setStatusMessage('Factual case note recorded securely.');
      await loadMemories();
    } catch {
      setStatusMessage('Failed to record factual note.');
    }
  };

  const handleDeleteEntry = async (id) => {
    try {
      caseMemoryEngine.deleteMemoryEntry(tenantId, caseId, id, { tenantId, caseId });
      setStatusMessage('Memory entry removed.');
      await loadMemories();
    } catch {
      setStatusMessage('Failed to delete memory entry.');
    }
  };

  const handlePromoteProposal = async (id) => {
    try {
      await caseMemoryEngine.verifyAndPromoteProposal(
        tenantId,
        caseId,
        id,
        { tenantId, caseId },
        citizenSecret
      );
      setStatusMessage('AI proposal verified and promoted to ground-truth factual note.');
      await loadMemories();
    } catch {
      setStatusMessage('Failed to promote proposal.');
    }
  };

  const handlePurgeAll = () => {
    try {
      caseMemoryEngine.purgeCaseMemory(tenantId, caseId, { tenantId, caseId });
      setConfirmPurge(false);
      setStatusMessage('All memories for this case have been permanently wiped.');
      setMemories([]);
    } catch {
      setStatusMessage('Failed to purge case memory.');
    }
  };

  const handleExport = async (format) => {
    try {
      const data = await caseMemoryEngine.exportCaseMemory(
        tenantId,
        caseId,
        format,
        { tenantId, caseId },
        citizenSecret
      );
      const blob = new Blob(
        [typeof data === 'string' ? data : JSON.stringify(data, null, 2)],
        { type: format === 'json' ? 'application/json' : 'text/markdown' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `case-memory-${caseId}.${format === 'json' ? 'json' : 'md'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage(`Case memory exported as ${format.toUpperCase()}.`);
    } catch {
      setStatusMessage('Export failed.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-memory-title"
      ref={modalRef}
    >
      <div
        style={{
          background: 'var(--card-bg, #ffffff)',
          color: 'var(--text-primary, #1e293b)',
          borderRadius: '1rem',
          maxWidth: '750px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          border: '1px solid var(--border-light, #e2e8f0)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--glass-bg-subtle, #f8fafc)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                padding: '0.5rem',
                borderRadius: '0.5rem',
                color: '#10b981',
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2
                id="case-memory-title"
                style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}
              >
                Case Memory & Isolation Control
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)' }}>
                Scoped Case: <strong>{caseId}</strong> (Encrypted at rest)
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            ref={closeButtonRef}
            className="btn"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary, #64748b)',
              padding: '0.25rem',
            }}
            aria-label="Close Case Memory Dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Live Feedback Banner */}
        {statusMessage && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: '0.5rem 1.5rem',
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#1d4ed8',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{statusMessage}</span>
            <button
              type="button"
              onClick={() => setStatusMessage('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1d4ed8' }}
            >
              ×
            </button>
          </div>
        )}

        {/* Toolbar & Tabs */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            borderBottom: '1px solid var(--border-light, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div role="tablist" style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'facts'}
              onClick={() => setActiveTab('facts')}
              className="btn"
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.85rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light, #e2e8f0)',
                background: activeTab === 'facts' ? '#3b82f6' : 'transparent',
                color: activeTab === 'facts' ? '#ffffff' : 'var(--text-primary, #1e293b)',
                fontWeight: 600,
              }}
            >
              Verified Facts ({factualNotes.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'proposals'}
              onClick={() => setActiveTab('proposals')}
              className="btn"
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.85rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light, #e2e8f0)',
                background: activeTab === 'proposals' ? '#8b5cf6' : 'transparent',
                color: activeTab === 'proposals' ? '#ffffff' : 'var(--text-primary, #1e293b)',
                fontWeight: 600,
              }}
            >
              AI Proposals ({modelProposals.length})
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="btn"
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.8rem',
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.25)',
              }}
            >
              <Plus size={14} /> Add Note
            </button>
            <button
              type="button"
              onClick={() => handleExport('json')}
              className="btn"
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.8rem',
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'var(--glass-bg-subtle, #f8fafc)',
                border: '1px solid var(--border-light, #e2e8f0)',
              }}
            >
              <Download size={14} /> JSON
            </button>
            <button
              type="button"
              onClick={() => handleExport('markdown')}
              className="btn"
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.8rem',
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'var(--glass-bg-subtle, #f8fafc)',
                border: '1px solid var(--border-light, #e2e8f0)',
              }}
            >
              <FileText size={14} /> MD
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
          {showAddForm && (
            <form
              onSubmit={handleAddFactualNote}
              style={{
                marginBottom: '1.25rem',
                padding: '1rem',
                background: 'var(--glass-bg-subtle, #f8fafc)',
                borderRadius: '0.75rem',
                border: '1px solid var(--border-light, #e2e8f0)',
              }}
            >
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>Add Factual Case Note</h4>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Note Title (e.g. Birth Certificate Registration Number)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-light, #e2e8f0)',
                  }}
                  required
                />
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-light, #e2e8f0)',
                  }}
                >
                  <option value={MEMORY_CATEGORIES.DOCUMENT_METADATA}>Document Metadata</option>
                  <option value={MEMORY_CATEGORIES.ELIGIBILITY_CRITERIA}>Eligibility Criteria</option>
                  <option value={MEMORY_CATEGORIES.ACTION_STEP}>Action Step</option>
                  <option value={MEMORY_CATEGORIES.INTERACTION_SUMMARY}>Interaction Summary</option>
                </select>
              </div>
              <textarea
                placeholder="Details of the factual case note..."
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-light, #e2e8f0)',
                  minHeight: '70px',
                  boxSizing: 'border-box',
                }}
                required
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="btn"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.8rem',
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.4rem',
                  }}
                >
                  Save Encrypted Note
                </button>
              </div>
            </form>
          )}

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary, #64748b)' }}>
              Loading encrypted memory entries...
            </div>
          ) : activeTab === 'facts' ? (
            factualNotes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary, #64748b)' }}>
                <Info size={28} style={{ margin: '0 auto 0.5rem auto', display: 'block', opacity: 0.6 }} />
                No verified factual notes recorded for this case yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {factualNotes.map((note) => (
                  <div
                    key={note.id}
                    style={{
                      padding: '1rem',
                      borderRadius: '0.75rem',
                      background: 'var(--card-bg, #ffffff)',
                      border: '1px solid var(--border-light, #e2e8f0)',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '0.25rem',
                              background: 'rgba(59, 130, 246, 0.1)',
                              color: '#2563eb',
                            }}
                          >
                            {note.category}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)' }}>
                            {new Date(note.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 style={{ margin: '0.4rem 0 0.25rem 0', fontSize: '1rem', fontWeight: 600 }}>
                          {note.payload?.title || 'Factual Note'}
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(note.id)}
                        className="btn"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '0.25rem',
                        }}
                        title="Delete note"
                        aria-label={`Delete note ${note.payload?.title || ''}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary, #334155)' }}>
                      {note.payload?.text}
                    </p>
                  </div>
                ))}
              </div>
            )
          ) : modelProposals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary, #64748b)' }}>
              <Sparkles size={28} style={{ margin: '0 auto 0.5rem auto', display: 'block', opacity: 0.6 }} />
              No unverified AI proposals stored for this case.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  fontSize: '0.85rem',
                  color: '#b45309',
                }}
              >
                Model proposals are untrusted machine inferences. Review and click "Verify & Accept" to promote them into ground-truth case facts.
              </div>
              {modelProposals.map((prop) => (
                <div
                  key={prop.id}
                  style={{
                    padding: '1rem',
                    borderRadius: '0.75rem',
                    background: 'var(--card-bg, #ffffff)',
                    border: '1px solid var(--border-light, #e2e8f0)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '0.25rem',
                            background: 'rgba(139, 92, 246, 0.1)',
                            color: '#7c3aed',
                          }}
                        >
                          {prop.category}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)' }}>
                          Confidence: {Math.round((prop.provenance?.confidenceScore || 0) * 100)}%
                        </span>
                      </div>
                      <h4 style={{ margin: '0.4rem 0 0.25rem 0', fontSize: '1rem', fontWeight: 600 }}>
                        {prop.payload?.title || 'AI Suggestion'}
                      </h4>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => handlePromoteProposal(prop.id)}
                        className="btn"
                        style={{
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          color: '#10b981',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.35rem',
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          cursor: 'pointer',
                        }}
                      >
                        <CheckCircle size={14} /> Verify & Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(prop.id)}
                        className="btn"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '0.25rem',
                        }}
                        title="Dismiss suggestion"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary, #334155)' }}>
                    {prop.payload?.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with Purge Action */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-light, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--glass-bg-subtle, #f8fafc)',
          }}
        >
          {confirmPurge ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>
                Permanently wipe all memories for this case?
              </span>
              <button
                type="button"
                onClick={handlePurgeAll}
                className="btn"
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.75rem',
                  borderRadius: '0.35rem',
                  cursor: 'pointer',
                }}
              >
                Yes, Purge Now
              </button>
              <button
                type="button"
                onClick={() => setConfirmPurge(false)}
                className="btn"
                style={{
                  background: 'none',
                  border: '1px solid var(--border-light, #e2e8f0)',
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.75rem',
                  borderRadius: '0.35rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmPurge(true)}
              className="btn"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                borderRadius: '0.35rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
              }}
            >
              <Trash2 size={14} /> Purge Case Memory
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="btn"
            style={{
              padding: '0.4rem 1rem',
              fontSize: '0.85rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light, #e2e8f0)',
              background: 'var(--card-bg, #ffffff)',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CaseMemoryInspectionModal;
