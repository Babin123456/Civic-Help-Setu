import React, { useState } from 'react';
import {
  FileText,
  Grid,
  BookmarkCheck,
  User,
  Users,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import './EligibilityTabsAndContext.css';

export const ELIGIBILITY_TABS = [
  { id: 'wizard', label: 'Eligibility Wizard', icon: FileText, description: 'Step-by-step guided questionnaire' },
  { id: 'matrix', label: 'Scheme Matrix', icon: Grid, description: 'Cross-scheme criteria comparison' },
  { id: 'saved', label: 'Saved Assessments', icon: BookmarkCheck, description: 'Historical assessments and results' }
];

export default function EligibilityTabsAndContext({
  activeTab = 'wizard',
  onTabChange,
  applicants = [
    { id: 'self', name: 'Self (Primary)', relation: 'Self', age: 34, incomeTier: 'Low Income' }
  ],
  activeApplicantId = 'self',
  onApplicantChange,
  hasUnsavedChanges = false,
  children
}) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingTab, setPendingTab] = useState(null);

  const activeApplicant = applicants.find((a) => a.id === activeApplicantId) || applicants[0];

  const handleTabClick = (tabId) => {
    if (tabId === activeTab) return;
    if (hasUnsavedChanges) {
      setPendingTab(tabId);
      setShowConfirmModal(true);
    } else {
      onTabChange?.(tabId);
    }
  };

  const confirmSwitch = () => {
    setShowConfirmModal(false);
    if (pendingTab) {
      onTabChange?.(pendingTab);
      setPendingTab(null);
    }
  };

  const cancelSwitch = () => {
    setShowConfirmModal(false);
    setPendingTab(null);
  };

  return (
    <div className="etc-container">
      {/* Top Context Bar: Applicant Info and Profile Switcher */}
      <section className="etc-context-panel" aria-label="Applicant Context">
        <div className="etc-context-info">
          <div className="etc-avatar-badge" aria-hidden="true">
            <User size={18} />
          </div>
          <div className="etc-applicant-details">
            <span className="etc-applicant-tag">EVALUATING FOR</span>
            <div className="etc-applicant-name-row">
              <h3 className="etc-applicant-name">{activeApplicant?.name}</h3>
              <span className="etc-pill">{activeApplicant?.relation}</span>
              {activeApplicant?.age && <span className="etc-pill">{activeApplicant?.age} yrs</span>}
              {activeApplicant?.incomeTier && <span className="etc-pill">{activeApplicant?.incomeTier}</span>}
            </div>
          </div>
        </div>

        {applicants.length > 1 && (
          <div className="etc-switcher-wrapper">
            <label htmlFor="applicant-select" className="etc-switcher-label">
              Switch Applicant:
            </label>
            <select
              id="applicant-select"
              className="etc-select"
              value={activeApplicantId}
              onChange={(e) => onApplicantChange?.(e.target.value)}
            >
              {applicants.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name} ({app.relation})
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      {/* Responsive Accessible Tabs Bar */}
      <nav className="etc-tabs-nav" role="tablist" aria-label="Eligibility view modes">
        {ELIGIBILITY_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              className={`etc-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => handleTabClick(tab.id)}
            >
              <Icon size={16} aria-hidden="true" />
              <div className="etc-tab-text">
                <span className="etc-tab-label">{tab.label}</span>
                <span className="etc-tab-desc">{tab.description}</span>
              </div>
              {isActive && <span className="etc-active-indicator" aria-hidden="true" />}
            </button>
          );
        })}
      </nav>

      {/* Main Tabpanel Container */}
      <main
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="etc-tabpanel"
      >
        {children}
      </main>

      {/* Unsaved Changes Confirmation Modal */}
      {showConfirmModal && (
        <div className="etc-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="etc-modal-card">
            <div className="etc-modal-header">
              <AlertTriangle size={24} className="etc-warning-icon" aria-hidden="true" />
              <h4 id="modal-title">Unsaved Progress Detected</h4>
            </div>
            <p className="etc-modal-body">
              You have active responses in this eligibility evaluation that have not been saved.
              Switching tabs will discard incomplete form edits. Do you wish to proceed?
            </p>
            <div className="etc-modal-actions">
              <button type="button" className="etc-btn etc-btn-secondary" onClick={cancelSwitch}>
                Stay Here
              </button>
              <button type="button" className="etc-btn etc-btn-danger" onClick={confirmSwitch}>
                Discard &amp; Switch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
