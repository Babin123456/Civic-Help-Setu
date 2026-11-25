import { useState, useId, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  FileText,
  ExternalLink,
  Lock,
  Globe,
  Phone,
  MapPin,
  Info,
  Search,
  HeartHandshake,
  ArrowLeft,
  CheckCircle2,
  LogOut,
  Building2,
  Trash2
} from 'lucide-react';
import './TransgenderCertificateWelfareGuide.css';

import {
  TRANSGENDER_CERTIFICATE_STATES,
  PRIVACY_AND_SAFE_DEVICE_GUIDANCE,
  MULTILINGUAL_METADATA,
  getTransgenderCertificateStateData,
  getAllSupportedStates,
  getCentralWelfareSchemes
} from '../../data/transgenderCertificateWelfareData';

import {
  resolveTransgenderAuthority,
  evaluateApplicationApplicability,
  getApplicationStageChecklist,
  getCorrectionRoutes,
  getAppealRoutes,
  filterSupportResources
} from '../../services/transgenderCertificateWelfareService';

const LOCAL_STORAGE_PROGRESS_KEY = 'civic_tg_navigator_progress';

export default function TransgenderCertificateWelfareGuide({
  initialStateId = 'national',
  initialTab = 'overview',
  onBack = null
} = {}) {
  const [selectedStateId, setSelectedStateId] = useState(initialStateId);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [resourceCategory, setResourceCategory] = useState('all');
  const [resourceSearch, setResourceSearch] = useState('');
  const [completedSteps, setCompletedSteps] = useState(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(LOCAL_STORAGE_PROGRESS_KEY);
        return saved ? JSON.parse(saved) : {};
      }
    } catch {
      // Ignore localStorage errors
    }
    return {};
  });

  const stateSelectId = useId();

  // Quick exit protection: Esc key triggers instant navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleQuickExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleQuickExit = () => {
    // Replaces location history immediately to an innocuous neutral page
    window.location.replace('https://www.google.com');
  };

  const handleToggleStep = (stepId) => {
    setCompletedSteps((prev) => {
      const next = { ...prev, [stepId]: !prev[stepId] };
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_PROGRESS_KEY, JSON.stringify(next));
        }
      } catch {
        // Safe fallback
      }
      return next;
    });
  };

  const handleClearProgress = () => {
    setCompletedSteps({});
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(LOCAL_STORAGE_PROGRESS_KEY);
      }
    } catch {
      // Safe fallback
    }
  };

  const stateData = getTransgenderCertificateStateData(selectedStateId);
  const allStates = getAllSupportedStates();
  const authority = resolveTransgenderAuthority(selectedStateId);
  const applicability = evaluateApplicationApplicability(selectedStateId);
  const checklist = getApplicationStageChecklist(selectedStateId);
  const correctionRoutes = getCorrectionRoutes(selectedStateId);
  const appealRoutes = getAppealRoutes(selectedStateId);
  const rawResources = filterSupportResources(selectedStateId, resourceCategory);

  const filteredResources = rawResources.filter((res) => {
    if (!resourceSearch.trim()) return true;
    const term = resourceSearch.toLowerCase();
    return (
      res.name.toLowerCase().includes(term) ||
      (res.description && res.description.toLowerCase().includes(term)) ||
      (res.type && res.type.toLowerCase().includes(term))
    );
  });

  const stateSchemes = stateData.welfareSchemes || [];
  const centralSchemes = getCentralWelfareSchemes();
  const displayedSchemes = selectedStateId === 'national'
    ? centralSchemes
    : [...stateSchemes, ...centralSchemes.filter((cs) => !stateSchemes.some((ss) => ss.id === cs.id))];

  const tabs = [
    { id: 'overview', label: '1. Legal Framework & Rules', icon: ShieldCheck },
    { id: 'application', label: '2. Application Route (Form 1)', icon: FileText },
    { id: 'revision', label: '3. Affirmation & Revision', icon: HeartHandshake },
    { id: 'appeals', label: '4. Appeals & Grievances', icon: ShieldAlert },
    { id: 'schemes', label: '5. Welfare & Healthcare Schemes', icon: Building2 },
    { id: 'directory', label: '6. Verified Support Directory', icon: Phone },
    { id: 'privacy', label: '7. Privacy & Safe Device', icon: Lock },
    { id: 'multilingual', label: '8. Multilingual & Plain Language', icon: Globe }
  ];

  return (
    <div className="tc-navigator">
      {/* Top Header Row with Safe Navigation and Quick Exit */}
      <div className="tc-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {onBack && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onBack}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem' }}
            >
              <ArrowLeft size={15} />
              <span>Back to Services</span>
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label htmlFor={stateSelectId} style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Jurisdiction:
            </label>
            <select
              id={stateSelectId}
              value={selectedStateId}
              onChange={(e) => setSelectedStateId(e.target.value)}
              className="tc-filter-select"
            >
              {allStates.map((id) => {
                const s = TRANSGENDER_CERTIFICATE_STATES[id];
                return (
                  <option key={id} value={id}>
                    {s ? s.state : id}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Quick Exit Protection */}
        <button
          type="button"
          onClick={handleQuickExit}
          className="tc-quick-exit-btn"
          title="Instantly leave this page and redirect to Google (or press ESC)"
          aria-label="Quick Exit to safe page"
        >
          <LogOut size={16} />
          <span>Quick Exit (ESC)</span>
        </button>
      </div>

      {/* Main Title & Statutory Scope Banner */}
      <div className="tc-card">
        <div className="tc-card-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span className="tc-badge tc-badge-blue">Statutory Citizen Guide</span>
              <span className="tc-badge tc-badge-green">100% Anonymous &amp; Client-Side</span>
              <span className="tc-badge tc-badge-purple">No Identity Documents Collected</span>
            </div>
            <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.45rem', fontWeight: 800 }}>
              Transgender Certificate &amp; Welfare Scheme Application Navigator
            </h1>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '820px', lineHeight: 1.55 }}>
              Grounded in the <strong>Transgender Persons (Protection of Rights) Act, 2019</strong> and <strong>Rules 2020</strong>. Explore official certificate application routes, medical affirmation gender marker revisions, welfare schemes, and verified emergency helplines without disclosing personal identity.
            </p>
          </div>
        </div>

        {/* Legal Safeguard Callout */}
        <div className="tc-alert-box tc-alert-blue">
          <Info size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#38bdf8' }} />
          <div>
            <strong>Self-Determination Guarantee:</strong> Under Section 4 and Section 5 of the Act, every transgender person has a statutory right to self-perceived gender identity. Physical or medical examination is <strong>strictly prohibited</strong> by law for the initial Certificate of Identity.
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tc-nav-tabs" role="tablist" aria-label="Navigator Sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isCurrent = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              onClick={() => setActiveTab(tab.id)}
              className={`tc-tab-btn ${isCurrent ? 'active' : ''}`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: LEGAL FRAMEWORK & RULES */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="tc-card">
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={20} color="#22c55e" />
              Statutory Authority &amp; Portals: {stateData.state}
            </h2>

            <div className="tc-grid-3" style={{ marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.85rem', borderRadius: '0.65rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                  Competent Issuing Officer:
                </span>
                <strong style={{ fontSize: '0.95rem' }}>{authority.competentOfficer}</strong>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Statutory 30-day processing mandate
                </p>
              </div>

              <div style={{ padding: '0.85rem', borderRadius: '0.65rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                  Application Fee:
                </span>
                <strong style={{ fontSize: '0.95rem', color: '#22c55e' }}>{authority.fee}</strong>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Central rules prohibit charging fees
                </p>
              </div>

              <div style={{ padding: '0.85rem', borderRadius: '0.65rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                  Medical Exam Status:
                </span>
                <strong style={{ fontSize: '0.95rem', color: '#38bdf8' }}>Prohibited by Law</strong>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Affidavit in Form 2 is conclusive
                </p>
              </div>
            </div>

            <div className="tc-grid-2">
              <div style={{ padding: '1rem', borderRadius: '0.65rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                  Official Central Application Portal:
                </span>
                <a
                  href={authority.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-main, #38bdf8)', fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none' }}
                >
                  <span>National Portal for Transgender Persons</span>
                  <ExternalLink size={15} />
                </a>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Official portal run by Ministry of Social Justice and Empowerment (transgender.dosje.gov.in).
                </p>
              </div>

              <div style={{ padding: '1rem', borderRadius: '0.65rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                  State Department / Board Information:
                </span>
                <a
                  href={authority.officialInfoPortal}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-main, #38bdf8)', fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none' }}
                >
                  <span>{stateData.state} Official Portal</span>
                  <ExternalLink size={15} />
                </a>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {stateData.competentAuthority}
                </p>
              </div>
            </div>
          </div>

          <div className="tc-card">
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem', fontWeight: 700 }}>
              Key Statutory Safeguards Under the 2019 Act
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>1. Prohibition of Discrimination (Section 3):</strong> Denial of education, healthcare, employment, housing, or right of movement based on gender identity is an offense.
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>2. End-to-End Online Workflow (Rule 4):</strong> Applications, document uploads, query resolutions, and certificate downloads are conducted digitally without mandatory physical visits.
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>3. Universal Recognition (Section 7(3)):</strong> The Certificate of Identity issued by the District Magistrate is recognized across all Union and State Government departments.
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>4. Statutory Right ({applicability.legalReference}):</strong> {applicability.ruleSummary}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: APPLICATION ROUTE (FORM 1) */}
      {activeTab === 'application' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="tc-card">
            <div className="tc-card-header">
              <div>
                <h2 style={{ margin: '0 0 0.35rem 0', fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={20} color="#38bdf8" />
                  {checklist.stageTitle}
                </h2>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  Official step-by-step route to receive the Certificate of Identity and barcoded Identity Card.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="tc-badge tc-badge-amber">Timeline: {checklist.estimatedTimeline}</span>
                <span className="tc-badge tc-badge-green">Fee: {checklist.fee}</span>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              {checklist.items.map((step) => {
                const isDone = Boolean(completedSteps[step.id]);
                return (
                  <div key={step.id} className="tc-step-row">
                    <div className="tc-step-number">{step.stepNumber}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {step.title}
                        </h3>
                        <button
                          type="button"
                          onClick={() => handleToggleStep(step.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: isDone ? '#22c55e' : 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.82rem',
                            fontWeight: 600
                          }}
                        >
                          <CheckCircle2 size={16} />
                          <span>{isDone ? 'Marked Complete' : 'Mark for Checklist'}</span>
                        </button>
                      </div>

                      <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {step.description}
                      </p>

                      {step.documents && step.documents.length > 0 && (
                        <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: 'var(--bg-main)', border: '1px solid var(--border-light)' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                            Required Documents:
                          </span>
                          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                            {step.documents.map((doc, dIdx) => (
                              <li key={dIdx}>{doc}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Direct Official Link */}
            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <a
                href="https://transgender.dosje.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', textDecoration: 'none' }}
              >
                <span>Open National Portal Registration</span>
                <ExternalLink size={16} />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GENDER AFFIRMATION & CORRECTIONS */}
      {activeTab === 'revision' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="tc-card">
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HeartHandshake size={20} color="#ec4899" />
              {correctionRoutes.title}
            </h2>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {correctionRoutes.description}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {correctionRoutes.steps.map((st, idx) => (
                <div key={st.id || idx} style={{ padding: '1rem', borderRadius: '0.65rem', background: 'var(--bg-secondary)', borderLeft: '3px solid #ec4899' }}>
                  <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem', fontWeight: 700 }}>
                    {st.title}
                  </h3>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {st.description}
                  </p>
                  {st.documents && st.documents.length > 0 && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <strong>Required:</strong> {st.documents.join('; ')}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="tc-alert-box tc-alert-green" style={{ marginTop: '1.25rem' }}>
              <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#22c55e' }} />
              <div>
                <strong>Section 7(3) Universal Modification Mandate:</strong> Once the revised Certificate of Identity is issued by the District Magistrate, the applicant is legally entitled to change their name and gender in all other identity documents (Aadhaar, Passport, PAN, Bank Accounts, Academic Certificates) without having to undergo separate verification.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: APPEALS & GRIEVANCES */}
      {activeTab === 'appeals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="tc-card">
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={20} color="#ef4444" />
              {appealRoutes.title}
            </h2>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {appealRoutes.description}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {appealRoutes.steps.map((ast, idx) => (
                <div key={ast.id || idx} style={{ padding: '1rem', borderRadius: '0.65rem', background: 'var(--bg-secondary)', borderLeft: '3px solid #ef4444' }}>
                  <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem', fontWeight: 700 }}>
                    {ast.title}
                  </h3>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {ast.description}
                  </p>
                  {ast.documents && ast.documents.length > 0 && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <strong>Key Evidence / Submissions:</strong> {ast.documents.join('; ')}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="tc-alert-box tc-alert-amber" style={{ marginTop: '1.25rem' }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#f59e0b' }} />
              <div>
                <strong>30-Day Limitation Window:</strong> Statutory appeals under Rule 11 must be filed within 30 days from the date of communication of the rejection order. Ensure you obtain the formal written rejection memo from the District Magistrate.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: WELFARE & HEALTHCARE SCHEMES */}
      {activeTab === 'schemes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="tc-card">
            <div className="tc-card-header">
              <div>
                <h2 style={{ margin: '0 0 0.35rem 0', fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Building2 size={20} color="#38bdf8" />
                  Welfare Programmes: {stateData.state}
                </h2>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  Central sector schemes and state-specific welfare board initiatives. No eligibility assumptions are made; all schemes are open for anonymous review.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
              {displayedSchemes.map((scheme) => (
                <div key={scheme.id} className="tc-scheme-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {scheme.name}
                    </h3>
                    {scheme.applicationPortal && (
                      <a
                        href={scheme.applicationPortal}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: 'var(--accent-main, #38bdf8)', textDecoration: 'none', fontWeight: 600 }}
                      >
                        <span>Official Portal</span>
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>

                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {scheme.description}
                  </p>

                  <div className="tc-grid-2">
                    <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                      <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)', display: 'block', marginBottom: '0.25rem' }}>
                        Documented Eligibility Criteria:
                      </strong>
                      <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        {scheme.eligibility.map((el, eIdx) => (
                          <li key={eIdx}>{el}</li>
                        ))}
                      </ul>
                    </div>

                    <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                      <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)', display: 'block', marginBottom: '0.25rem' }}>
                        Key Entitlements &amp; Benefits:
                      </strong>
                      <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        {scheme.benefits.map((bn, bIdx) => (
                          <li key={bIdx}>{bn}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: STATE-AWARE SUPPORT DIRECTORY */}
      {activeTab === 'directory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="tc-card">
            <div className="tc-card-header">
              <div>
                <h2 style={{ margin: '0 0 0.35rem 0', fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Phone size={20} color="#22c55e" />
                  Verified Support Resources Directory
                </h2>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  State-aware registry of verified community organizations, free legal aid clinics, and 24x7 crisis helplines.
                </p>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={resourceSearch}
                    onChange={(e) => setResourceSearch(e.target.value)}
                    placeholder="Search resources..."
                    className="tc-filter-select"
                    style={{ paddingLeft: '2rem', width: '180px' }}
                  />
                  <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>

                <select
                  value={resourceCategory}
                  onChange={(e) => setResourceCategory(e.target.value)}
                  className="tc-filter-select"
                >
                  <option value="all">All Categories</option>
                  <option value="Helpline">Helplines</option>
                  <option value="Legal Aid">Legal Aid</option>
                  <option value="Healthcare">Healthcare &amp; Counseling</option>
                  <option value="Shelter">Shelter &amp; Livelihood</option>
                </select>
              </div>
            </div>

            {filteredResources.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No verified support resources matching your current filters.
              </div>
            ) : (
              <div className="tc-grid-2" style={{ marginTop: '1rem' }}>
                {filteredResources.map((res, rIdx) => (
                  <div key={rIdx} className="tc-resource-card">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{res.name}</h3>
                        {res.type && <span className="tc-badge tc-badge-blue">{res.type}</span>}
                      </div>

                      <p style={{ margin: '0.25rem 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        {res.description}
                      </p>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.82rem' }}>
                      {res.contact?.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <Phone size={14} color="#22c55e" />
                          <a href={`tel:${res.contact.phone.replace(/[^0-9+]/g, '')}`} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}>
                            {res.contact.phone}
                          </a>
                          {res.contact.availability && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({res.contact.availability})</span>
                          )}
                        </div>
                      )}

                      {res.contact?.address && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-secondary)' }}>
                          <MapPin size={14} color="#f59e0b" />
                          <span>{res.contact.address}</span>
                        </div>
                      )}

                      {res.website && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.25rem' }}>
                          <ExternalLink size={14} color="#38bdf8" />
                          <a href={res.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-main, #38bdf8)', textDecoration: 'none', fontWeight: 600 }}>
                            Visit Website
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: PRIVACY & SAFE-DEVICE GUIDANCE */}
      {activeTab === 'privacy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="tc-card">
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={20} color="#a855f7" />
              {PRIVACY_AND_SAFE_DEVICE_GUIDANCE.title}
            </h2>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              {PRIVACY_AND_SAFE_DEVICE_GUIDANCE.subtitle}
            </p>

            <div className="tc-grid-2">
              {PRIVACY_AND_SAFE_DEVICE_GUIDANCE.principles.map((pr, pIdx) => (
                <div key={pIdx} style={{ padding: '1rem', borderRadius: '0.65rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                  <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {pr.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {pr.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Local Storage Privacy Management */}
            <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '0.65rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '0.95rem', fontWeight: 700 }}>
                    Local Checklist Progress
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Any steps marked on this device are stored purely in your browser's private local storage. They are never transmitted.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearProgress}
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#ef4444' }}
                >
                  <Trash2 size={15} />
                  <span>Clear Saved Progress</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: MULTILINGUAL & PLAIN LANGUAGE */}
      {activeTab === 'multilingual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="tc-card">
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Globe size={20} color="#f59e0b" />
              {MULTILINGUAL_METADATA.title}
            </h2>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {MULTILINGUAL_METADATA.description}
            </p>

            <div className="tc-grid-4" style={{ marginBottom: '1.5rem' }}>
              {MULTILINGUAL_METADATA.supportedLanguages.map((lang) => (
                <div key={lang.code} style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                  <strong style={{ fontSize: '0.95rem', display: 'block' }}>{lang.native}</strong>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{lang.name}</span>
                </div>
              ))}
            </div>

            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem', fontWeight: 700 }}>
              Plain Language Statutory Glossary
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {MULTILINGUAL_METADATA.glossary.map((g, gIdx) => (
                <div key={gIdx} style={{ padding: '0.85rem', borderRadius: '0.5rem', background: 'var(--bg-secondary)', borderLeft: '3px solid #f59e0b' }}>
                  <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{g.term}</strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {g.definition}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
