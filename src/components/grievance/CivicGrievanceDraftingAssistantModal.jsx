import { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Copy,
  Check,
  AlertTriangle,
  Info,
  ShieldCheck,
  Plus,
  Trash2,
  Sparkles,
  Bookmark,
  ExternalLink,
} from 'lucide-react';
import {
  GRIEVANCE_CATEGORIES,
  RESOLUTION_TYPES,
  generateGrievanceDraft,
  getStoredGrievanceDrafts,
  saveGrievanceDraft,
  deleteGrievanceDraft,
} from '../../services/civicGrievanceDraftingService.js';
import { useToast } from '../../context/ToastContext.jsx';

const CivicGrievanceDraftingAssistantModal = ({
  isOpen,
  onClose,
  defaultApplication = null,
}) => {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'saved'
  const [category, setCategory] = useState(GRIEVANCE_CATEGORIES[0]);
  const [departmentName, setDepartmentName] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [location, setLocation] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [previousRefNumber, setPreviousRefNumber] = useState('');
  const [requestedResolution, setRequestedResolution] = useState(RESOLUTION_TYPES[0]);
  const [evidenceList, setEvidenceList] = useState([]);
  const [newEvidenceInput, setNewEvidenceInput] = useState('');

  // Privacy controls
  const [omitPersonalDetails, setOmitPersonalDetails] = useState(true);
  const [citizenName, setCitizenName] = useState('');
  const [citizenPhone, setCitizenPhone] = useState('');
  const [citizenAddress, setCitizenAddress] = useState('');

  // Result state
  const [generatedDraft, setGeneratedDraft] = useState(null);
  const [editedText, setEditedText] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setSavedDrafts(getStoredGrievanceDrafts());
      if (defaultApplication) {
        if (defaultApplication.id) {
          setPreviousRefNumber(defaultApplication.id);
        }
        if (defaultApplication.department || defaultApplication.serviceName) {
          setDepartmentName(defaultApplication.department || defaultApplication.serviceName);
        }
      }
    }
  }, [isOpen, defaultApplication]);

  if (!isOpen) return null;

  const handleAddEvidence = () => {
    const trimmed = newEvidenceInput.trim();
    if (trimmed && !evidenceList.includes(trimmed)) {
      setEvidenceList([...evidenceList, trimmed]);
      setNewEvidenceInput('');
    }
  };

  const handleRemoveEvidence = (idxToRemove) => {
    setEvidenceList(evidenceList.filter((_, idx) => idx !== idxToRemove));
  };

  const handleGenerate = (e) => {
    e.preventDefault();
    if (!issueDescription.trim()) {
      toast?.warning?.('Please provide an issue description to draft your petition.');
      return;
    }

    const facts = {
      category,
      departmentName,
      issueDescription,
      location,
      incidentDate,
      previousRefNumber,
      requestedResolution,
      evidenceList,
      citizenName: omitPersonalDetails ? '' : citizenName,
      citizenPhone: omitPersonalDetails ? '' : citizenPhone,
      citizenAddress: omitPersonalDetails ? '' : citizenAddress,
    };

    const draft = generateGrievanceDraft(facts);
    if (draft.isValid) {
      setGeneratedDraft(draft);
      setEditedText(draft.draftText);
      toast?.success?.('Formal grievance draft generated based strictly on your facts.');
    } else {
      toast?.error?.(draft.error || 'Failed to generate draft.');
    }
  };

  const handleCopy = () => {
    if (!editedText) return;
    navigator.clipboard?.writeText(editedText);
    setCopied(true);
    toast?.info?.('Grievance draft copied to clipboard!');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSave = () => {
    if (!generatedDraft) return;
    const toSave = {
      ...generatedDraft,
      draftText: editedText,
      savedAt: new Date().toISOString(),
    };
    const success = saveGrievanceDraft(toSave);
    if (success) {
      setSavedDrafts(getStoredGrievanceDrafts());
      toast?.success?.('Draft saved locally in your browser.');
    } else {
      toast?.error?.('Could not save draft locally.');
    }
  };

  const handleDeleteSaved = (draftId) => {
    deleteGrievanceDraft(draftId);
    setSavedDrafts(getStoredGrievanceDrafts());
    toast?.info?.('Saved draft removed.');
  };

  const handleLoadSaved = (draft) => {
    setGeneratedDraft(draft);
    setEditedText(draft.draftText);
    setActiveTab('create');
    toast?.info?.(`Loaded draft: ${draft.category}`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="grievance-drafter-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          borderRadius: '1rem',
          border: '1px solid var(--border-main)',
          backgroundColor: 'var(--bg-primary, #ffffff)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-main)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-secondary, #f8fafc)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.6rem',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
              }}
            >
              <FileText size={22} />
            </div>
            <div>
              <h2 id="grievance-drafter-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                Civic Grievance Drafting Assistant
              </h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Structure professional petitions without AI invention or hallucinations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Grievance Drafting Assistant"
            className="btn btn-ghost"
            style={{ padding: '0.5rem', borderRadius: '0.5rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-main)',
            padding: '0 1.5rem',
            gap: '1rem',
            backgroundColor: 'var(--bg-secondary, #f8fafc)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            style={{
              padding: '0.75rem 0.25rem',
              fontWeight: 600,
              fontSize: '0.9rem',
              borderBottom: activeTab === 'create' ? '2px solid var(--accent-main, #2563eb)' : '2px solid transparent',
              color: activeTab === 'create' ? 'var(--accent-main, #2563eb)' : 'var(--text-secondary)',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
            }}
          >
            Draft Grievance Petition
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            style={{
              padding: '0.75rem 0.25rem',
              fontWeight: 600,
              fontSize: '0.9rem',
              borderBottom: activeTab === 'saved' ? '2px solid var(--accent-main, #2563eb)' : '2px solid transparent',
              color: activeTab === 'saved' ? 'var(--accent-main, #2563eb)' : 'var(--text-secondary)',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Bookmark size={15} /> Saved Drafts ({savedDrafts.length})
          </button>
        </div>

        {/* Body Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {activeTab === 'create' ? (
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              {/* Grounded AI notice */}
              <div
                style={{
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.06)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  display: 'flex',
                  gap: '0.75rem',
                }}
              >
                <ShieldCheck size={20} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.85rem', lineHeight: '1.45', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Fact-Controlled Drafting:</strong> This tool builds
                  formal grievance text solely from the factual information you input. It never fabricates dates,
                  reference numbers, or official statements. Any missing detail is tagged as a bracketed placeholder{' '}
                  <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: '3px' }}>
                    [LIKE THIS]
                  </code>{' '}
                  for your verification.
                </div>
              </div>

              {/* Input Form */}
              <form onSubmit={handleGenerate} style={{ display: 'grid', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                      Civic Category *
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.7rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-main)',
                      }}
                    >
                      {GRIEVANCE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                      Target Authority / Department (Optional)
                    </label>
                    <input
                      type="text"
                      value={departmentName}
                      onChange={(e) => setDepartmentName(e.target.value)}
                      placeholder="e.g. Municipal Corporation, PWD, Jal Board"
                      style={{
                        width: '100%',
                        padding: '0.7rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-main)',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Issue Description & Core Facts *
                  </label>
                  <textarea
                    rows={4}
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    placeholder="Describe what occurred, who was affected, and the current state of the issue in your own words..."
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-main)',
                    }}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                      Location / Ward / Address (Optional)
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Main Market Road, Ward 12"
                      style={{
                        width: '100%',
                        padding: '0.7rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-main)',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                      Date / Duration (Optional)
                    </label>
                    <input
                      type="text"
                      value={incidentDate}
                      onChange={(e) => setIncidentDate(e.target.value)}
                      placeholder="e.g. Since 25 Oct 2026 or Ongoing for 2 weeks"
                      style={{
                        width: '100%',
                        padding: '0.7rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-main)',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                      Prior Token / Reference # (Optional)
                    </label>
                    <input
                      type="text"
                      value={previousRefNumber}
                      onChange={(e) => setPreviousRefNumber(e.target.value)}
                      placeholder="e.g. TKN-2026-9812"
                      style={{
                        width: '100%',
                        padding: '0.7rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-main)',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Requested Remedial Action
                  </label>
                  <select
                    value={requestedResolution}
                    onChange={(e) => setRequestedResolution(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.7rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-main)',
                    }}
                  >
                    {RESOLUTION_TYPES.map((res) => (
                      <option key={res} value={res}>
                        {res}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Evidence items */}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Supporting Evidence Items (Photos, Receipts, Letters)
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      value={newEvidenceInput}
                      onChange={(e) => setNewEvidenceInput(e.target.value)}
                      placeholder="e.g. Photograph of water leakage taken on Oct 28"
                      style={{
                        flex: 1,
                        padding: '0.7rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-main)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddEvidence}
                      className="btn btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <Plus size={16} /> Add Item
                    </button>
                  </div>
                  {evidenceList.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                      {evidenceList.map((item, idx) => (
                        <span
                          key={idx}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.3rem 0.6rem',
                            borderRadius: '0.4rem',
                            backgroundColor: 'var(--bg-secondary, #f1f5f9)',
                            fontSize: '0.8rem',
                          }}
                        >
                          {item}
                          <button
                            type="button"
                            onClick={() => handleRemoveEvidence(idx)}
                            style={{
                              border: 'none',
                              background: 'none',
                              cursor: 'pointer',
                              color: '#ef4444',
                              padding: 0,
                            }}
                          >
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Privacy toggle */}
                <div
                  style={{
                    padding: '0.9rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--bg-secondary, #f8fafc)',
                    border: '1px solid var(--border-main)',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={omitPersonalDetails}
                      onChange={(e) => setOmitPersonalDetails(e.target.checked)}
                    />
                    Omit personal contact details from draft (Recommended for privacy)
                  </label>
                  {!omitPersonalDetails && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
                      <input
                        type="text"
                        placeholder="Your Name"
                        value={citizenName}
                        onChange={(e) => setCitizenName(e.target.value)}
                        style={{ padding: '0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border-main)' }}
                      />
                      <input
                        type="text"
                        placeholder="Phone Number"
                        value={citizenPhone}
                        onChange={(e) => setCitizenPhone(e.target.value)}
                        style={{ padding: '0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border-main)' }}
                      />
                      <input
                        type="text"
                        placeholder="Address"
                        value={citizenAddress}
                        onChange={(e) => setCitizenAddress(e.target.value)}
                        style={{ padding: '0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border-main)' }}
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <Sparkles size={18} /> Structure Grievance Draft
                </button>
              </form>

              {/* Output Preview */}
              {generatedDraft && (
                <div
                  style={{
                    marginTop: '1rem',
                    padding: '1.25rem',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--border-main)',
                    backgroundColor: 'var(--bg-card, #ffffff)',
                    display: 'grid',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                        Synthesized Grievance Draft
                      </h3>
                      {generatedDraft.hasUnstatedFacts && (
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#b45309' }}>
                          Notice: {generatedDraft.placeholdersCount} unstated detail(s) rendered as bracketed placeholders. Please review and fill them before filing.
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                      >
                        {copied ? <Check size={15} color="#16a34a" /> : <Copy size={15} />}
                        {copied ? 'Copied!' : 'Copy Draft'}
                      </button>
                      <button
                        type="button"
                        onClick={handleSave}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                      >
                        <Bookmark size={15} /> Save Draft
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={12}
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    style={{
                      width: '100%',
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      lineHeight: '1.5',
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-main)',
                      backgroundColor: 'var(--bg-secondary, #f8fafc)',
                      whiteSpace: 'pre-wrap',
                    }}
                  />

                  {/* Submission Disclaimer */}
                  <div
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'rgba(234, 88, 12, 0.08)',
                      border: '1px solid rgba(234, 88, 12, 0.25)',
                      fontSize: '0.8rem',
                      color: '#9a3412',
                      lineHeight: '1.4',
                      display: 'flex',
                      gap: '0.5rem',
                    }}
                  >
                    <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong>Official Submission Notice:</strong> Civic Help Setu does NOT submit complaints to
                      government offices. Please copy your finalized draft and lodge it through designated grievance
                      channels such as your state's CM Helpline, municipal web portal, or CPGRAMS (pgportal.gov.in).
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Saved Drafts Tab */
            <div style={{ display: 'grid', gap: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Previously drafted grievance petitions stored securely in your local browser storage.
              </p>
              {savedDrafts.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <Bookmark size={32} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
                  <p>No saved drafts yet. Generate and save a petition from the drafting tab.</p>
                </div>
              ) : (
                savedDrafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="card"
                    style={{
                      padding: '1rem',
                      borderRadius: '0.75rem',
                      border: '1px solid var(--border-main)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>{draft.category}</h4>
                      <p style={{ margin: '0.2rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Subject: {draft.subjectLine}
                      </p>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        Saved: {new Date(draft.savedAt || draft.generatedAt).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => handleLoadSaved(draft)}
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                      >
                        Load & Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSaved(draft.id)}
                        className="btn btn-ghost"
                        style={{ padding: '0.4rem', color: '#ef4444' }}
                        aria-label="Delete saved draft"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-main)',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: 'var(--bg-secondary, #f8fafc)',
          }}
        >
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CivicGrievanceDraftingAssistantModal;