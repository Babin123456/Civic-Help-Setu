import { useState } from 'react';
import {
  Scale,
  Calculator,
  ShieldAlert,
  Clock,
  FileCheck,
  FolderLock,
  FileText,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import MaintenanceApportionmentCalculator from '../components/seniorTribunal/MaintenanceApportionmentCalculator.jsx';
import Section23PropertyRevocationCard from '../components/seniorTribunal/Section23PropertyRevocationCard.jsx';
import TribunalSlaTimeline from '../components/seniorTribunal/TribunalSlaTimeline.jsx';
import EvidenceChecklistDrawer from '../components/seniorTribunal/EvidenceChecklistDrawer.jsx';
import TribunalPetitionBuilder from '../components/seniorTribunal/TribunalPetitionBuilder.jsx';
import {
  getPetitions,
  deletePetition,
  verifyPetitionIntegrity,
  downloadPetitionTextFile,
  downloadPetitionJsonDossier,
} from '../services/seniorCitizenTribunalStorage.js';

const SeniorCitizenTribunalWorkspace = () => {
  const [activeTab, setActiveTab] = useState('drafter');
  const [savedPetitions, setSavedPetitions] = useState(() => getPetitions());
  const [builderInitialData, setBuilderInitialData] = useState(null);

  const loadSaved = () => {
    const list = getPetitions();
    setSavedPetitions(list);
  };

  const handleDeleteSaved = (id) => {
    deletePetition(id);
    loadSaved();
  };

  const handleApplyCalculationToDraft = (calc) => {
    setBuilderInitialData((prev) => ({
      ...prev,
      monthlyClaim: calc.netDeficit,
    }));
    setActiveTab('drafter');
  };

  const handleApplySection23ToDraft = (evalRes) => {
    setBuilderInitialData((prev) => ({
      ...prev,
      caseType: 'PROPERTY_REVOCATION_SEC23',
      narrative: `Grounds: The transfer deed is voidable under Section 23 of the 2007 Act. Findings: ${evalRes.findings
        .map((f) => f.title)
        .join('; ')}.`,
    }));
    setActiveTab('drafter');
  };

  const handleDraftAppellateAppeal = () => {
    setBuilderInitialData((prev) => ({
      ...prev,
      narrative:
        'APPELLATE APPEAL UNDER SECTION 16: The Maintenance Tribunal has failed to dispose of this application within the statutory 90-day ceiling mandated under Section 5(6) of Act 56 of 2007.',
    }));
    setActiveTab('drafter');
  };

  return (
    <div
      className="container page-container"
      style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '2rem 1rem 4rem',
      }}
    >
      {/* Header Banner */}
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.35rem 0.85rem',
            borderRadius: '9999px',
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            color: 'var(--accent-main, #38bdf8)',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '0.75rem',
          }}
        >
          <Scale size={14} />
          <span>Statutory Protection Under Central Act 56 of 2007</span>
        </div>
        <h1
          style={{
            fontSize: '2.1rem',
            fontWeight: 800,
            margin: '0 0 0.5rem',
            color: 'var(--text-primary)',
          }}
        >
          Senior Citizen Maintenance & Property Protection Tribunal Workspace
        </h1>
        <p
          style={{
            fontSize: '0.95rem',
            color: 'var(--text-secondary)',
            maxWidth: '750px',
            margin: '0 auto',
            lineHeight: '1.5',
          }}
        >
          Statutory petition generator, equitable sibling liability calculator, Section 23
          property gift deed revocation validator, and 90-day Sub-Divisional Magistrate (SDM)
          inquiry tracker for elderly parents.
        </p>
      </div>

      {/* Tabs Navigation */}
      <div
        role="tablist"
        aria-label="Tribunal workspace sections"
        style={{
          display: 'flex',
          gap: '0.5rem',
          overflowX: 'auto',
          paddingBottom: '0.5rem',
          marginBottom: '1.75rem',
          borderBottom: '1px solid var(--border-main, #334155)',
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'drafter'}
          onClick={() => setActiveTab('drafter')}
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background:
              activeTab === 'drafter'
                ? 'var(--accent-main, #38bdf8)'
                : 'var(--glass-bg, rgba(255, 255, 255, 0.03))',
            color: activeTab === 'drafter' ? '#0f172a' : 'var(--text-secondary)',
            whiteSpace: 'nowrap',
          }}
        >
          <FileText size={16} />
          <span>Petition Drafter</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'calculator'}
          onClick={() => setActiveTab('calculator')}
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background:
              activeTab === 'calculator'
                ? 'var(--accent-main, #38bdf8)'
                : 'var(--glass-bg, rgba(255, 255, 255, 0.03))',
            color: activeTab === 'calculator' ? '#0f172a' : 'var(--text-secondary)',
            whiteSpace: 'nowrap',
          }}
        >
          <Calculator size={16} />
          <span>Maintenance Calculator</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sec23'}
          onClick={() => setActiveTab('sec23')}
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background:
              activeTab === 'sec23'
                ? 'var(--accent-main, #38bdf8)'
                : 'var(--glass-bg, rgba(255, 255, 255, 0.03))',
            color: activeTab === 'sec23' ? '#0f172a' : 'var(--text-secondary)',
            whiteSpace: 'nowrap',
          }}
        >
          <ShieldAlert size={16} />
          <span>Section 23 Property Revocation</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sla'}
          onClick={() => setActiveTab('sla')}
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background:
              activeTab === 'sla'
                ? 'var(--accent-main, #38bdf8)'
                : 'var(--glass-bg, rgba(255, 255, 255, 0.03))',
            color: activeTab === 'sla' ? '#0f172a' : 'var(--text-secondary)',
            whiteSpace: 'nowrap',
          }}
        >
          <Clock size={16} />
          <span>90-Day SLA & Escalations</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'evidence'}
          onClick={() => setActiveTab('evidence')}
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background:
              activeTab === 'evidence'
                ? 'var(--accent-main, #38bdf8)'
                : 'var(--glass-bg, rgba(255, 255, 255, 0.03))',
            color: activeTab === 'evidence' ? '#0f172a' : 'var(--text-secondary)',
            whiteSpace: 'nowrap',
          }}
        >
          <FileCheck size={16} />
          <span>Evidence Checklist</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'locker'}
          onClick={() => {
            loadSaved();
            setActiveTab('locker');
          }}
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background:
              activeTab === 'locker'
                ? 'var(--accent-main, #38bdf8)'
                : 'var(--glass-bg, rgba(255, 255, 255, 0.03))',
            color: activeTab === 'locker' ? '#0f172a' : 'var(--text-secondary)',
            whiteSpace: 'nowrap',
          }}
        >
          <FolderLock size={16} />
          <span>Saved Petitions ({savedPetitions.length})</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'drafter' && (
        <TribunalPetitionBuilder
          initialData={builderInitialData}
          onSaved={loadSaved}
        />
      )}

      {activeTab === 'calculator' && (
        <MaintenanceApportionmentCalculator
          onApplyCalculation={handleApplyCalculationToDraft}
        />
      )}

      {activeTab === 'sec23' && (
        <Section23PropertyRevocationCard
          onApplyFindings={handleApplySection23ToDraft}
        />
      )}

      {activeTab === 'sla' && (
        <TribunalSlaTimeline
          onDraftAppellateAppeal={handleDraftAppellateAppeal}
        />
      )}

      {activeTab === 'evidence' && (
        <EvidenceChecklistDrawer
          caseType={builderInitialData?.caseType || 'MAINTENANCE_AND_EXPENSES'}
        />
      )}

      {activeTab === 'locker' && (
        <div
          className="card"
          style={{
            padding: '1.5rem',
            borderRadius: '0.75rem',
            background: 'var(--bg-main, #0f172a)',
            border: '1px solid var(--border-main, #334155)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
            <div
              style={{
                padding: '0.5rem',
                borderRadius: '0.5rem',
                background: 'rgba(56, 189, 248, 0.1)',
                color: 'var(--accent-main, #38bdf8)',
              }}
            >
              <FolderLock size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                Saved Tribunal Petitions Locker
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
                Client-side encrypted petition locker with cryptographic SHA-256 seal verification.
              </p>
            </div>
          </div>

          {savedPetitions.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2.5rem 1rem',
                color: 'var(--text-tertiary)',
                fontSize: '0.85rem',
              }}
            >
              No saved petitions found in your local locker. Use the Petition Drafter tab to generate and save one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {savedPetitions.map((p) => {
                const verdict = verifyPetitionIntegrity(p);
                return (
                  <div
                    key={p.id || p.filingReference}
                    style={{
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      background: 'var(--bg-card, #1e293b)',
                      border: '1px solid var(--border-light, #334155)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          {p.petitioner?.name} ({p.caseType})
                        </strong>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '9999px',
                            background: verdict.valid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: verdict.valid ? '#10b981' : '#ef4444',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                          }}
                        >
                          {verdict.valid ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                          <span>{verdict.valid ? 'SEAL VALID' : 'TAMPERED'}</span>
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        Ref: {p.filingReference} • Saved: {p.savedAt ? p.savedAt.slice(0, 10) : 'Recent'} • Monthly Claim: ₹{p.monthlyClaim}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => downloadPetitionTextFile(p)}
                        className="btn btn-secondary"
                        aria-label="Download petition text slip"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <Download size={13} />
                        <span>Slip</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadPetitionJsonDossier(p)}
                        className="btn btn-secondary"
                        aria-label="Download petition JSON dossier"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <Download size={13} />
                        <span>JSON</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSaved(p.id || p.filingReference)}
                        className="btn btn-secondary"
                        aria-label="Delete petition"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: '#ef4444' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SeniorCitizenTribunalWorkspace;
