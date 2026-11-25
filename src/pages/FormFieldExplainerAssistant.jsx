import { useState, useMemo } from 'react';
import {
  FileText,
  Shield,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Languages,
  Info,
  Layers,
  Search,
  Sparkles,
  HelpCircle,
  Clock,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import StandardPageHeader from '../components/common/StandardPageHeader';
import {
  getAllCataloguedForms,
  getFormById,
  getFieldExplanation,
  validateFieldFormat,
  evaluateConditionalField,
  detectFormVersionChange,
  getPendingReviewQueue,
} from '../services/formFieldExplainerService';
import { FIELD_CATEGORIES } from '../data/upFormFieldExplainerCatalogue';
import { useLanguage } from '../context/LanguageContext';

export default function FormFieldExplainerAssistant() {
  const { language: appLanguage, isPlainLanguage: appPlainLang } = useLanguage();

  const [selectedFormId, setSelectedFormId] = useState('up_income_certificate_v1');
  const [selectedFieldId, setSelectedFieldId] = useState('applicant_name_hi');
  const [targetLang, setTargetLang] = useState(appLanguage || 'hi');
  const [usePlainLanguage, setUsePlainLanguage] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');

  // Interactive sandbox state for live formatting checks (strictly in-memory, never stored)
  const [sandboxInput, setSandboxInput] = useState('');

  // Simulated upstream conditional context to preview conditional branch states
  const [simulatedContext, setSimulatedContext] = useState({
    applicant_occupation: 'AGRICULTURE',
    area_type: 'RURAL',
    stay_duration_years: 25,
    caste_category: 'OBC',
    grievance_department_category: 'REVENUE_LAND_DISPUTE',
    is_reminder_or_reappeal: false,
  });

  // Admin / Review queue state for drift inspection
  const [showDriftInspector, setShowDriftInspector] = useState(false);
  const [driftNotification, setDriftNotification] = useState(null);

  const forms = useMemo(() => getAllCataloguedForms(true), []);
  const activeForm = useMemo(() => getFormById(selectedFormId) || forms[0], [selectedFormId, forms]);

  // Handle switching forms
  const handleSelectForm = (formId) => {
    setSelectedFormId(formId);
    const form = getFormById(formId);
    if (form && form.fields.length > 0) {
      setSelectedFieldId(form.fields[0].fieldId);
    }
    setSandboxInput('');
  };

  // Filtered fields based on search query and category
  const filteredFields = useMemo(() => {
    if (!activeForm || !activeForm.fields) return [];
    return activeForm.fields.filter((field) => {
      const matchesCategory = activeCategory === 'ALL' || field.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchesCategory;

      const matchesSearch =
        field.label.toLowerCase().includes(q) ||
        field.fieldId.toLowerCase().includes(q) ||
        (field.plainLanguageExplanation && field.plainLanguageExplanation.toLowerCase().includes(q)) ||
        (field.whereToFind && field.whereToFind.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [activeForm, activeCategory, searchQuery]);

  // Current field explanation
  const currentExplanation = useMemo(() => {
    if (!activeForm || !selectedFieldId) return null;
    return getFieldExplanation(
      activeForm.formId,
      selectedFieldId,
      targetLang,
      usePlainLanguage || appPlainLang
    );
  }, [activeForm, selectedFieldId, targetLang, usePlainLanguage, appPlainLang]);

  // Active field object
  const activeFieldDef = useMemo(() => {
    if (!activeForm) return null;
    return activeForm.fields.find((f) => f.fieldId === selectedFieldId) || null;
  }, [activeForm, selectedFieldId]);

  // Conditional evaluation of current field
  const conditionalStatus = useMemo(() => {
    if (!activeFieldDef) return { isApplicable: true };
    return evaluateConditionalField(activeFieldDef, simulatedContext);
  }, [activeFieldDef, simulatedContext]);

  // Sandbox format validation result
  const sandboxValidation = useMemo(() => {
    if (!activeFieldDef || !sandboxInput.trim()) return null;
    return validateFieldFormat(activeFieldDef, sandboxInput.trim());
  }, [activeFieldDef, sandboxInput]);

  // Trigger simulated drift for demonstration of acceptance criteria
  const handleSimulateVersionDrift = () => {
    const res = detectFormVersionChange(activeForm.formId, '2025.1', {
      detectedUrl: activeForm.sourceUrl,
      reason: 'Administrative notification: format update by UP Directorate',
    });
    setDriftNotification(res.message);
  };

  const pendingReviewCount = getPendingReviewQueue().length;

  return (
    <div className="section" style={{ padding: '2rem 1rem' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Page Header */}
        <StandardPageHeader
          eyebrow="Uttar Pradesh Government Public Services"
          eyebrowIcon={<BookOpen size={16} />}
          badgeText="Verified UP Portal Guidance"
          badgeType="accent"
          title="Multilingual Form Field Explainer & Error-Prevention Assistant"
          subtitle="Field-by-field guidance in plain language for official Uttar Pradesh government forms. Understand requirements, check format rules with synthetic examples, and avoid scrutiny rejection."
        />

        {/* Global Educational & Safety Banner */}
        <div
          role="note"
          aria-label="Educational boundary warning"
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '0.75rem',
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            marginBottom: '1.75rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.85rem',
          }}
        >
          <Info size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
          <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
            <strong>Educational Assistance & Submission Boundary:</strong> This assistant provides explanatory guidance
            and format validation to help citizens understand official forms before applying. Civic Help Setu{' '}
            <strong>never fills, stores, or submits government applications</strong>. Final submissions must always be
            completed directly on the official department portal.
          </div>
        </div>

        {/* Outdated Guidance Alert (if form version changed) */}
        {activeForm.status !== 'ACTIVE' && (
          <div
            role="alert"
            style={{
              padding: '1rem 1.25rem',
              borderRadius: '0.75rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              marginBottom: '1.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <AlertTriangle size={22} color="#ef4444" />
              <div>
                <strong style={{ color: '#ef4444' }}>Official Form Guidance Under Review:</strong>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  A newer administrative version of this form was detected. Explanations for version {activeForm.version} are
                  pending re-verification by department cataloguers.
                </p>
              </div>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.65rem',
                background: '#ef4444',
                color: '#fff',
                borderRadius: '99px',
                fontWeight: 700,
              }}
            >
              UNDER REVIEW
            </span>
          </div>
        )}

        {/* Form Selector Tabs (5 UP Forms) */}
        <div style={{ marginBottom: '1.75rem' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.65rem',
            }}
          >
            Select Official UP Government Form (5 High-Volume Portals)
          </label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {forms.map((form) => {
              const isSelected = form.formId === selectedFormId;
              return (
                <button
                  key={form.formId}
                  type="button"
                  onClick={() => handleSelectForm(form.formId)}
                  style={{
                    textAlign: 'left',
                    padding: '0.9rem 1rem',
                    borderRadius: '0.75rem',
                    border: isSelected
                      ? '2px solid var(--accent-main, #3b82f6)'
                      : '1px solid var(--border-light, #e2e8f0)',
                    background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card, #ffffff)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '99px',
                        background: isSelected ? 'var(--accent-main, #3b82f6)' : 'var(--glass-bg, #f1f5f9)',
                        color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                        fontWeight: 700,
                      }}
                    >
                      v{form.version}
                    </span>
                    {form.status !== 'ACTIVE' && (
                      <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700 }}>Under Review</span>
                    )}
                  </div>
                  <strong style={{ fontSize: '0.92rem', lineHeight: 1.3 }}>{form.title}</strong>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>
                    {form.departmentIssuer.split(',')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Form Official Provenance Banner */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '0.75rem',
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-light, #e2e8f0)',
            marginBottom: '1.75rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Shield size={16} color="#10b981" />
              <strong style={{ fontSize: '0.92rem' }}>Verified Department Provenance:</strong>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {activeForm.departmentIssuer}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
              <span>Jurisdiction: <strong>{activeForm.jurisdiction}</strong></span>
              <span>Form Version: <strong>{activeForm.version}</strong></span>
              <span>Last Department Verification: <strong>{activeForm.lastVerifiedDate}</strong></span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <a
              href={activeForm.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.82rem',
                color: 'var(--accent-main, #3b82f6)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <span>Official Department Portal</span>
              <ExternalLink size={14} />
            </a>
            <button
              type="button"
              onClick={() => setShowDriftInspector(!showDriftInspector)}
              style={{
                fontSize: '0.78rem',
                padding: '0.35rem 0.65rem',
                borderRadius: '0.5rem',
                background: 'var(--glass-bg, #f1f5f9)',
                border: '1px solid var(--border-light, #e2e8f0)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Audit Drift ({pendingReviewCount} in Queue)
            </button>
          </div>
        </div>

        {/* Drift Inspector Drawer (Test and Admin tool) */}
        {showDriftInspector && (
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '0.75rem',
              background: 'var(--glass-bg, #f8fafc)',
              border: '1px dashed var(--border-main, #cbd5e1)',
              marginBottom: '1.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={16} />
                <strong>Form Version Drift & Review Queue Inspector</strong>
              </div>
              <button
                type="button"
                onClick={handleSimulateVersionDrift}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
              >
                Simulate Portal Version Drift (Detect v2025.1)
              </button>
            </div>
            {driftNotification && (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: '#ef4444' }}>{driftNotification}</p>
            )}
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              When a government authority updates a form layout, the drift detector automatically sets the form to
              UNDER_REVIEW, withdraws active explanations, and sends it to the cataloguer queue.
            </p>
          </div>
        )}

        {/* Language & Plain-Language Controls */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: '0.85rem 1.25rem',
            background: 'var(--bg-card, #ffffff)',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light, #e2e8f0)',
            marginBottom: '1.5rem',
          }}
        >
          {/* Target Language Selection */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Languages size={18} color="var(--accent-main, #3b82f6)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Explanation Language:</span>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {[
                { code: 'hi', label: 'हिन्दी (Hindi)' },
                { code: 'en', label: 'English' },
                { code: 'bn', label: 'বাংলা (Bengali)' },
                { code: 'ta', label: 'தமிழ் (Tamil)' },
              ].map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setTargetLang(lang.code)}
                  style={{
                    padding: '0.3rem 0.65rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: targetLang === lang.code ? '1px solid var(--accent-main, #3b82f6)' : '1px solid var(--border-light, #e2e8f0)',
                    background: targetLang === lang.code ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                    color: targetLang === lang.code ? 'var(--accent-main, #3b82f6)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Plain Language Mode Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={usePlainLanguage}
              onChange={(e) => setUsePlainLanguage(e.target.checked)}
              style={{ width: '1rem', height: '1rem' }}
            />
            <Sparkles size={15} color="#f59e0b" />
            <span style={{ fontWeight: 600 }}>Plain-Language Explanations (No Administrative Jargon)</span>
          </label>
        </div>

        {/* Main Assistant Two-Column Workspace */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 350px) 1fr',
            gap: '1.5rem',
            alignItems: 'start',
          }}
        >
          {/* Left Column: Field Search & Navigator */}
          <div
            style={{
              background: 'var(--bg-card, #ffffff)',
              borderRadius: '0.75rem',
              border: '1px solid var(--border-light, #e2e8f0)',
              padding: '1.25rem',
            }}
          >
            {/* Search Box */}
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <Search
                size={16}
                color="var(--text-tertiary)"
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Search form fields..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem 0.55rem 2.25rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light, #e2e8f0)',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                  background: 'var(--bg-main, #f8fafc)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={() => setActiveCategory('ALL')}
                style={{
                  padding: '0.25rem 0.55rem',
                  borderRadius: '99px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: activeCategory === 'ALL' ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
                  background: activeCategory === 'ALL' ? 'var(--accent-main)' : 'transparent',
                  color: activeCategory === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                All Fields ({activeForm.fields.length})
              </button>
              {Object.entries(FIELD_CATEGORIES).map(([catKey, catLabel]) => {
                const count = activeForm.fields.filter((f) => f.category === catLabel).length;
                if (count === 0) return null;
                const isSelected = activeCategory === catLabel;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setActiveCategory(catLabel)}
                    style={{
                      padding: '0.25rem 0.55rem',
                      borderRadius: '99px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      border: isSelected ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
                      background: isSelected ? 'var(--accent-main)' : 'transparent',
                      color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {catLabel.split(' ')[0]} ({count})
                  </button>
                );
              })}
            </div>

            {/* Field List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '550px', overflowY: 'auto' }}>
              {filteredFields.length === 0 ? (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', textAlign: 'center', margin: '2rem 0' }}>
                  No fields match your search filter.
                </p>
              ) : (
                filteredFields.map((field) => {
                  const isSelected = field.fieldId === selectedFieldId;
                  const localizedTitle = field.translations?.[targetLang] || field.label;
                  return (
                    <button
                      key={field.fieldId}
                      type="button"
                      onClick={() => {
                        setSelectedFieldId(field.fieldId);
                        setSandboxInput('');
                      }}
                      style={{
                        textAlign: 'left',
                        padding: '0.75rem 0.85rem',
                        borderRadius: '0.5rem',
                        border: isSelected
                          ? '1px solid var(--accent-main, #3b82f6)'
                          : '1px solid var(--border-light, #f1f5f9)',
                        background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? 700 : 500, color: 'var(--text-primary)' }}>
                          {localizedTitle}
                        </span>
                        <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                          {field.isSensitive && (
                            <span title="Sensitive Field" style={{ color: '#ef4444' }}>
                              <ShieldAlert size={14} />
                            </span>
                          )}
                          {field.isConditional && (
                            <span title="Conditional Field" style={{ color: '#f59e0b' }}>
                              <Layers size={14} />
                            </span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                        {field.category}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Detailed Field Explainer & Validation Sandbox */}
          {currentExplanation ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Field Guidance Card */}
              <div
                style={{
                  background: 'var(--bg-card, #ffffff)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--border-light, #e2e8f0)',
                  padding: '1.5rem',
                }}
              >
                {/* Header with Title and Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--accent-main, #3b82f6)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {currentExplanation.category}
                    </span>
                    <h2 style={{ margin: '0.2rem 0', fontSize: '1.35rem', fontWeight: 700 }}>
                      {currentExplanation.label}
                    </h2>
                    {currentExplanation.originalLabel !== currentExplanation.label && (
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                        Official Form Label: {currentExplanation.originalLabel}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {currentExplanation.isSensitive && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.3rem 0.65rem',
                          borderRadius: '99px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#ef4444',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        <ShieldAlert size={14} />
                        Sensitive Field
                      </span>
                    )}
                    {currentExplanation.isConditional && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.3rem 0.65rem',
                          borderRadius: '99px',
                          background: 'rgba(245, 158, 11, 0.1)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          color: '#f59e0b',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        <Layers size={14} />
                        Conditional Field
                      </span>
                    )}
                  </div>
                </div>

                {/* Sensitive Security Warning Banner */}
                {currentExplanation.isSensitive && (
                  <div
                    role="alert"
                    style={{
                      padding: '0.9rem 1.1rem',
                      borderRadius: '0.5rem',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      marginBottom: '1.25rem',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                    }}
                  >
                    <ShieldAlert size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                    <div style={{ fontSize: '0.85rem', color: '#991b1b' }}>
                      <strong>Official Portal Security Rule: </strong>
                      {currentExplanation.sensitivityWarning}
                      <div style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Never share personal numbers or OTPs with cyber-cafe agents or unauthorized websites.
                      </div>
                    </div>
                  </div>
                )}

                {/* Conditional Field Rule Banner */}
                {currentExplanation.isConditional && (
                  <div
                    style={{
                      padding: '0.9rem 1.1rem',
                      borderRadius: '0.5rem',
                      background: conditionalStatus.isApplicable ? 'rgba(245, 158, 11, 0.08)' : 'var(--glass-bg, #f1f5f9)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      marginBottom: '1.25rem',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <HelpCircle size={16} color="#f59e0b" />
                      <strong style={{ color: conditionalStatus.isApplicable ? '#b45309' : 'var(--text-secondary)' }}>
                        When does this field apply? (Source Rule)
                      </strong>
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-primary)' }}>
                      {conditionalStatus.reason}
                    </p>
                    {currentExplanation.conditionalRules && (
                      <div style={{ marginTop: '0.65rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Simulate Condition:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const { dependsOnField, expectedValue } = currentExplanation.conditionalRules;
                            setSimulatedContext((prev) => ({
                              ...prev,
                              [dependsOnField]: prev[dependsOnField] === expectedValue ? 'OTHER_STATE' : expectedValue,
                            }));
                          }}
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '0.4rem',
                            background: 'var(--glass-bg, #f1f5f9)',
                            border: '1px solid var(--border-light, #cbd5e1)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                          }}
                        >
                          Toggle {currentExplanation.conditionalRules.dependsOnField} State
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Section 1: Plain Language Explanation */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.4rem', color: 'var(--text-secondary)' }}>
                    What this field is asking (Plain Language)
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                    {currentExplanation.plainLanguageExplanation}
                  </p>
                </div>

                {/* Section 2: Where to find this in your documents */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.4rem', color: 'var(--text-secondary)' }}>
                    Where to find this information
                  </h3>
                  <div
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '0.5rem',
                      background: 'var(--glass-bg, #f8fafc)',
                      border: '1px solid var(--border-light, #e2e8f0)',
                      fontSize: '0.88rem',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                    }}
                  >
                    <FileText size={17} color="var(--accent-main, #3b82f6)" />
                    <span>{currentExplanation.whereToFind}</span>
                  </div>
                </div>

                {/* Section 3: Synthetic Fictional Example */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.4rem', color: 'var(--text-secondary)' }}>
                    Example of expected input format
                  </h3>
                  <div
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      background: 'var(--bg-main, #f1f5f9)',
                      border: '1px dashed var(--border-main, #94a3b8)',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {currentExplanation.fictionalExample}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem', display: 'block' }}>
                    Note: Examples use strictly fictional dummy data. Never enter someone else's personal information.
                  </span>
                </div>

                {/* Section 4: Official Source Citation */}
                {currentExplanation.officialSourceCitation && (
                  <div style={{ borderTop: '1px solid var(--border-light, #e2e8f0)', paddingTop: '0.85rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                      Official Rule Reference: <strong>{currentExplanation.officialSourceCitation}</strong> (Form Version {currentExplanation.formVersion})
                    </span>
                  </div>
                )}
              </div>

              {/* Live Interactive Format Tester & Error Prevention Sandbox */}
              <div
                style={{
                  background: 'var(--bg-card, #ffffff)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--border-light, #e2e8f0)',
                  padding: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={18} color="#10b981" />
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                      Live Format Validation & Error-Prevention Sandbox
                    </h3>
                  </div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '99px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      color: '#10b981',
                      fontWeight: 700,
                    }}
                  >
                    In-Memory Only (Zero PII Saved)
                  </span>
                </div>

                <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Test your draft format to check whether it meets the statutory department pattern before visiting the portal.
                </p>

                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <input
                    type="text"
                    value={sandboxInput}
                    onChange={(e) => setSandboxInput(e.target.value)}
                    placeholder={`Test format (e.g. ${currentExplanation.fictionalExample.split('(')[0].trim()})`}
                    style={{
                      flex: 1,
                      padding: '0.65rem 0.85rem',
                      borderRadius: '0.5rem',
                      border: sandboxValidation
                        ? sandboxValidation.isValid
                          ? '1px solid #10b981'
                          : '1px solid #ef4444'
                        : '1px solid var(--border-light, #cbd5e1)',
                      fontSize: '0.9rem',
                      background: 'var(--bg-main, #ffffff)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  {sandboxInput && (
                    <button
                      type="button"
                      onClick={() => setSandboxInput('')}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Live Format Feedback Card */}
                {sandboxValidation && (
                  <div
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '0.5rem',
                      background: sandboxValidation.isValid ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                      border: `1px solid ${sandboxValidation.isValid ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                    }}
                  >
                    {sandboxValidation.isValid ? (
                      <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                    ) : (
                      <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                    )}
                    <div style={{ fontSize: '0.85rem' }}>
                      <strong style={{ color: sandboxValidation.isValid ? '#10b981' : '#ef4444' }}>
                        {sandboxValidation.isValid ? 'Format Pattern Verified' : 'Format Verification Issue'}
                      </strong>
                      <p style={{ margin: '0.2rem 0', color: 'var(--text-primary)' }}>
                        {sandboxValidation.isValid
                          ? 'Your sample input adheres to the statutory format rule for this department.'
                          : sandboxValidation.error}
                      </p>
                      {sandboxValidation.tip && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                          <strong>Tip: </strong> {sandboxValidation.tip}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Ready to Apply / Submission Link Box */}
              <div
                style={{
                  background: 'var(--bg-card, #ffffff)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--border-light, #e2e8f0)',
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <strong style={{ fontSize: '0.95rem' }}>Ready to complete your official application?</strong>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Have your verified documents ready and proceed to the statutory issuing portal.
                  </p>
                </div>
                <a
                  href={activeForm.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    textDecoration: 'none',
                    fontSize: '0.88rem',
                    padding: '0.65rem 1.15rem',
                  }}
                >
                  <span>Proceed to Official {activeForm.jurisdiction} Portal</span>
                  <ArrowRight size={16} />
                </a>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <p>Select a field from the left panel to inspect plain-language guidance.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
