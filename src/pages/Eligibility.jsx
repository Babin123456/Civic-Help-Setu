import { useState } from 'react';
import { Sparkles, ShieldCheck, Bookmark, HelpCircle, Calculator } from 'lucide-react';
import UniversalEligibilityWizard from '../components/eligibility/UniversalEligibilityWizard';
import SavedAssessmentsList from '../components/eligibility/SavedAssessmentsList';
import EntitlementCalculatorModal from '../components/eligibility/EntitlementCalculatorModal';
import UnsavedChangesDialog from '../components/common/UnsavedChangesDialog';
import ApplicantProfileSwitcher from '../components/eligibility/ApplicantProfileSwitcher';

const Eligibility = () => {
  const [activeTab, setActiveTab] = useState('wizard');
  const [refreshCount, setRefreshCount] = useState(0);
  const [isCalcOpen, setIsCalcOpen] = useState(false);

  const [wizardDirty, setWizardDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState(null);

  // Switching tabs unmounts the wizard, so unsaved answers need the same warning.
  const requestTab = (tab) => {
    if (tab === activeTab) return;
    if (activeTab === 'wizard' && wizardDirty) setPendingTab(tab);
    else setActiveTab(tab);
  };

  const discardAndSwitch = () => {
    setActiveTab(pendingTab);
    setPendingTab(null);
  };

  const handleAssessmentSaved = () => {
    setRefreshCount((prev) => prev + 1);
  };

  return (
    <div className="section animate-fade-in" style={{ paddingBottom: '6rem' }}>
      <div className="container" style={{ maxWidth: '900px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--accent-main)',
              fontSize: '0.875rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '0.5rem',
            }}
          >
            <Sparkles size={18} /> Citizen Entitlement Guide
          </div>
          <h1 style={{ fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', fontWeight: '800', marginBottom: '0.75rem' }}>
            Interactive Eligibility Checker
          </h1>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', maxWidth: '650px', margin: '0 auto' }}>
            Answer a few quick questions to see which key central and state civic schemes may be relevant to you. This is guidance, not an official eligibility decision.
          </p>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '2rem',
          }}
        >
          <button
            type="button"
            onClick={() => requestTab('wizard')}
            style={{
              padding: '0.6rem 1.5rem',
              borderRadius: '99px',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: 'pointer',
              border: activeTab === 'wizard' ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
              background: activeTab === 'wizard' ? 'var(--accent-main)' : 'var(--glass-bg)',
              color: activeTab === 'wizard' ? 'var(--bg-main)' : 'var(--text-secondary)',
              transition: 'all 0.2s',
            }}
          >
            Run Eligibility Wizard
          </button>
          <button
            type="button"
            onClick={() => requestTab('saved')}
            style={{
              padding: '0.6rem 1.5rem',
              borderRadius: '99px',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: 'pointer',
              border: activeTab === 'saved' ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
              background: activeTab === 'saved' ? 'var(--accent-main)' : 'var(--glass-bg)',
              color: activeTab === 'saved' ? 'var(--bg-main)' : 'var(--text-secondary)',
              transition: 'all 0.2s',
            }}
          >
            Saved Assessments
          </button>
          <button
            type="button"
            onClick={() => setIsCalcOpen(true)}
            style={{
              padding: '0.6rem 1.5rem',
              borderRadius: '99px',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: 'pointer',
              border: '1px solid #16a34a',
              background: '#f0fdf4',
              color: '#15803d',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
          >
            <Calculator size={16} />
            <span>Welfare Subsidy Maximizer</span>
          </button>
        </div>

        {/* Transparent logic privacy banner */}
        <div
          className="glass-panel"
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '0.75rem',
            marginBottom: '1.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            border: '1px solid var(--border-light)',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
          }}
        >
          <ShieldCheck size={18} color="var(--accent-main)" style={{ flexShrink: 0 }} />
          <span>
            <strong>Auditable & Private:</strong> Eligibility criteria are evaluated locally in your browser using verified government scheme guidelines. Your financial and demographic answers are not uploaded to any remote server.
          </span>
        </div>

        <ApplicantProfileSwitcher onProfileChanged={() => setRefreshCount((c) => c + 1)} />

        {/* Content based on active tab */}
        {activeTab === 'wizard' ? (
          <UniversalEligibilityWizard onAssessmentSaved={handleAssessmentSaved} onDirtyChange={setWizardDirty} />
        ) : (
          <SavedAssessmentsList refreshTrigger={refreshCount} />
        )}

        <UnsavedChangesDialog
          isOpen={pendingTab !== null}
          onStay={() => setPendingTab(null)}
          onDiscard={discardAndSwitch}
        />

        {/* Welfare Entitlement Maximizer Modal */}
        <EntitlementCalculatorModal isOpen={isCalcOpen} onClose={() => setIsCalcOpen(false)} />
      </div>
    </div>
  );
};

export default Eligibility;
