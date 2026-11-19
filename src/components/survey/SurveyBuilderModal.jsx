import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Save,
  CheckCircle,
  HelpCircle,
  AlertCircle,
  GitBranch,
  Layers,
  Settings,
} from 'lucide-react';
import { QUESTION_TYPES, SURVEY_STATUS } from '../../data/surveyContract.js';
import { createSurvey, updateSurvey, transitionSurvey } from '../../services/surveyService.js';

const SurveyBuilderModal = ({ survey = null, onClose, onSaveSuccess }) => {
  const isEditing = Boolean(survey);

  // Form states
  const [activeTab, setActiveTab] = useState('meta'); // 'meta' | 'questions' | 'branching' | 'consent'
  const [title, setTitle] = useState(survey?.title || '');
  const [description, setDescription] = useState(survey?.description || '');
  const [department, setDepartment] = useState(survey?.department || '');
  const [category, setCategory] = useState(survey?.category || 'Governance & Public Works');
  const [stateName, setStateName] = useState(survey?.jurisdiction?.state || 'Karnataka');
  const [ward, setWard] = useState(survey?.jurisdiction?.ward || 'Ward 12');
  const [totalTarget, setTotalTarget] = useState(survey?.samplingTarget?.totalTarget || 200);

  // Consent
  const [consentText, setConsentText] = useState(
    survey?.consentConfig?.consentText ||
      'Participation in this civic assessment is voluntary and anonymous. Aggregated summaries assist municipal bodies in evidence-backed planning.'
  );

  // Questions
  const initialQuestions =
    survey?.versions?.find((v) => v.id === survey.activeVersionId)?.questions ||
    survey?.versions?.[0]?.questions || [
      {
        id: `q_${Date.now()}_1`,
        variableName: 'q_primary_assessment',
        prompt: 'How satisfied are you with local municipal delivery?',
        type: QUESTION_TYPES.NUMERIC_RATING,
        min: 1,
        max: 5,
        required: true,
        isSensitive: false,
      },
    ];
  const [questions, setQuestions] = useState(JSON.parse(JSON.stringify(initialQuestions)));

  // Branching rules
  const initialBranching =
    survey?.versions?.find((v) => v.id === survey.activeVersionId)?.branchingRules ||
    survey?.versions?.[0]?.branchingRules || [];
  const [branchingRules, setBranchingRules] = useState(JSON.parse(JSON.stringify(initialBranching)));

  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAddQuestion = () => {
    const newQ = {
      id: `q_${Date.now()}_${questions.length + 1}`,
      variableName: `q_var_${questions.length + 1}`,
      prompt: 'New Question Prompt',
      type: QUESTION_TYPES.SINGLE_CHOICE,
      required: true,
      isSensitive: false,
      options: [
        { value: 'opt_1', label: 'Option 1' },
        { value: 'opt_2', label: 'Option 2' },
      ],
    };
    setQuestions([...questions, newQ]);
  };

  const handleRemoveQuestion = (idx) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handleUpdateQuestion = (idx, patch) => {
    const copy = [...questions];
    copy[idx] = { ...copy[idx], ...patch };
    setQuestions(copy);
  };

  const handleAddBranchingRule = () => {
    if (questions.length < 2) {
      setErrorMsg('Need at least 2 questions to configure branching jumps.');
      return;
    }
    const newRule = {
      sourceQuestionId: questions[0].id,
      condition: 'equals',
      targetValue: 'opt_1',
      action: 'jump_to',
      nextQuestionId: questions[1].id,
    };
    setBranchingRules([...branchingRules, newRule]);
  };

  const handleRemoveBranchingRule = (idx) => {
    setBranchingRules(branchingRules.filter((_, i) => i !== idx));
  };

  const handleSave = async (publishImmediately = false) => {
    setErrorMsg('');
    setSaving(true);

    try {
      const payload = {
        title,
        description,
        department,
        category,
        jurisdiction: { level: 'local', state: stateName, ward },
        samplingTarget: {
          totalTarget: Number(totalTarget),
          minimumSubgroupThreshold: 5,
        },
        consentConfig: {
          consentText,
          retentionDays: 365,
        },
        questions,
        branchingRules,
      };

      let saved;
      if (isEditing) {
        // Update survey
        saved = createSurvey({ ...survey, ...payload });
      } else {
        saved = createSurvey(payload);
      }

      if (publishImmediately) {
        transitionSurvey(saved.id, SURVEY_STATUS.UNDER_REVIEW);
        transitionSurvey(saved.id, SURVEY_STATUS.PUBLISHED, 'Initial publish by builder');
      }

      if (onSaveSuccess) onSaveSuccess(saved);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Validation failed. Please verify required fields.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1000,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="builder-modal-title"
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '940px',
          maxHeight: '92vh',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-light)',
          borderRadius: '1rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--glass-bg)',
          }}
        >
          <div>
            <h2 id="builder-modal-title" style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
              {isEditing ? 'Edit Survey Project & Schema' : 'Create Structured Civic Survey'}
            </h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Configure question metadata, branching logic, sampling targets, and consent text
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0.25rem' }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Strip */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', background: 'var(--glass-bg)', padding: '0 1.25rem', gap: '0.5rem' }}>
          {[
            { id: 'meta', label: '1. General & Target Quota', icon: Settings },
            { id: 'questions', label: `2. Question Schema (${questions.length})`, icon: Layers },
            { id: 'branching', label: `3. Branching Rules (${branchingRules.length})`, icon: GitBranch },
            { id: 'consent', label: '4. Privacy & Consent', icon: HelpCircle },
          ].map((tab) => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '0.75rem 0.9rem',
                  fontSize: '0.82rem',
                  fontWeight: active ? 700 : 500,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: active ? 'var(--accent-main)' : 'var(--text-secondary)',
                  borderBottom: active ? '2px solid var(--accent-main)' : '2px solid transparent',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <Icon size={14} /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {errorMsg && (
            <div
              style={{
                padding: '0.65rem 1rem',
                borderRadius: '0.5rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '0.82rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              role="alert"
            >
              <AlertCircle size={15} /> {errorMsg}
            </div>
          )}

          {activeTab === 'meta' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>Survey Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Ward 12 Municipal Water Supply & Sanitation Survey"
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '0.4rem', border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>Department Name *</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Directorate of Municipal Administration"
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '0.4rem', border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '0.4rem', border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>Sampling Target Quota (Respondents)</label>
                  <input
                    type="number"
                    value={totalTarget}
                    onChange={(e) => setTotalTarget(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '0.4rem', border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>Jurisdiction State</label>
                  <input
                    type="text"
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '0.4rem', border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>Ward / Zone</label>
                  <input
                    type="text"
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '0.4rem', border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>Survey Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Detail the civic objectives of this consultation..."
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '0.4rem', border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
          )}

          {activeTab === 'questions' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Questions are stored with standard alphanumeric variable names for export into analytics tools.
                </span>
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="btn btn-primary"
                  style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <Plus size={14} /> Add Question
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {questions.map((q, idx) => (
                  <div
                    key={q.id}
                    style={{
                      padding: '1rem',
                      borderRadius: '0.75rem',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Item #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(idx)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                        aria-label={`Remove question ${idx + 1}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Question Prompt</label>
                        <input
                          type="text"
                          value={q.prompt}
                          onChange={(e) => handleUpdateQuestion(idx, { prompt: e.target.value })}
                          style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid var(--border-light)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Variable Name (Codebook)</label>
                        <input
                          type="text"
                          value={q.variableName}
                          onChange={(e) => handleUpdateQuestion(idx, { variableName: e.target.value })}
                          style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid var(--border-light)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', alignItems: 'center' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Question Type</label>
                        <select
                          value={q.type}
                          onChange={(e) => handleUpdateQuestion(idx, { type: e.target.value })}
                          style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid var(--border-light)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                        >
                          <option value={QUESTION_TYPES.SINGLE_CHOICE}>Single Choice</option>
                          <option value={QUESTION_TYPES.NUMERIC_RATING}>Numeric Scale (1 to 5)</option>
                          <option value={QUESTION_TYPES.TEXT_SHORT}>Short Free Text</option>
                          <option value={QUESTION_TYPES.DEMOGRAPHIC_VOLUNTARY}>Voluntary Demographic</option>
                        </select>
                      </div>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', marginTop: '1rem' }}>
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) => handleUpdateQuestion(idx, { required: e.target.checked })}
                          style={{ accentColor: 'var(--accent-main)' }}
                        />
                        <span>Required Field</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', marginTop: '1rem' }}>
                        <input
                          type="checkbox"
                          checked={q.isSensitive}
                          onChange={(e) => handleUpdateQuestion(idx, { isSensitive: e.target.checked })}
                          style={{ accentColor: 'var(--accent-main)' }}
                        />
                        <span>Sensitive (k-anonymity suppressed)</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'branching' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Define dynamic condition jumps (e.g., skip follow-up questions if respondent does not use commercial tankers).
                </span>
                <button
                  type="button"
                  onClick={handleAddBranchingRule}
                  className="btn btn-primary"
                  style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <Plus size={14} /> Add Branch Rule
                </button>
              </div>

              {branchingRules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem', background: 'var(--bg-card)', borderRadius: '0.75rem', border: '1px dashed var(--border-light)', color: 'var(--text-secondary)' }}>
                  No branching rules configured. Survey runs sequentially.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {branchingRules.map((rule, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>If answer to</span>
                      <select
                        value={rule.sourceQuestionId}
                        onChange={(e) => {
                          const copy = [...branchingRules];
                          copy[idx].sourceQuestionId = e.target.value;
                          setBranchingRules(copy);
                        }}
                        style={{ padding: '0.35rem', borderRadius: '4px', background: 'var(--bg-main)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                      >
                        {questions.map((q) => (
                          <option key={q.id} value={q.id}>{q.prompt.slice(0, 30)}...</option>
                        ))}
                      </select>

                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>equals</span>
                      <input
                        type="text"
                        value={rule.targetValue}
                        onChange={(e) => {
                          const copy = [...branchingRules];
                          copy[idx].targetValue = e.target.value;
                          setBranchingRules(copy);
                        }}
                        style={{ padding: '0.35rem', borderRadius: '4px', background: 'var(--bg-main)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', fontSize: '0.8rem', width: '100px' }}
                      />

                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>then</span>
                      <select
                        value={rule.action}
                        onChange={(e) => {
                          const copy = [...branchingRules];
                          copy[idx].action = e.target.value;
                          setBranchingRules(copy);
                        }}
                        style={{ padding: '0.35rem', borderRadius: '4px', background: 'var(--bg-main)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                      >
                        <option value="jump_to">Jump to Question</option>
                        <option value="terminate">End Survey Early</option>
                      </select>

                      {rule.action === 'jump_to' && (
                        <select
                          value={rule.nextQuestionId}
                          onChange={(e) => {
                            const copy = [...branchingRules];
                            copy[idx].nextQuestionId = e.target.value;
                            setBranchingRules(copy);
                          }}
                          style={{ padding: '0.35rem', borderRadius: '4px', background: 'var(--bg-main)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                        >
                          {questions.map((q) => (
                            <option key={q.id} value={q.id}>{q.prompt.slice(0, 30)}...</option>
                          ))}
                        </select>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveBranchingRule(idx)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', marginLeft: 'auto' }}
                        aria-label={`Remove rule ${idx + 1}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'consent' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Mandatory Informed Consent Disclosure *
              </label>
              <textarea
                value={consentText}
                onChange={(e) => setConsentText(e.target.value)}
                rows={4}
                style={{ width: '100%', padding: '0.65rem', borderRadius: '0.4rem', border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.85rem', lineHeight: '1.5' }}
              />
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Every civic survey must include explicit statutory consent disclosure before any citizen responses can be collected.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--glass-bg)',
          }}
        >
          <button type="button" onClick={onClose} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>
            Cancel
          </button>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Save size={14} /> Save Draft
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="btn btn-primary"
              style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <CheckCircle size={14} /> Publish Consultation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SurveyBuilderModal;

