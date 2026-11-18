import { useState } from 'react';
import {
  RERA_RELIEF_TYPE,
  RERA_FORM_TYPE,
  DEFAULT_STATUTORY_INTEREST_RATE,
} from '../services/reraDisputeService.js';
import {
  saveReraComplaint,
  listReraComplaints,
  deleteReraComplaint,
  verifyComplaintIntegrity,
  exportComplaintDossierJson,
  exportComplaintTextSlip,
} from '../services/reraDisputeStorage.js';
import ReraInterestCalculator from '../components/rera/ReraInterestCalculator.jsx';
import ReraDefectLiabilityCard from '../components/rera/ReraDefectLiabilityCard.jsx';
import ReraPetitionDrafter from '../components/rera/ReraPetitionDrafter.jsx';
import ReraEvidenceChecklist from '../components/rera/ReraEvidenceChecklist.jsx';
import ReraExecutionWarrantCard from '../components/rera/ReraExecutionWarrantCard.jsx';
import ReraAppellateMemoCard from '../components/rera/ReraAppellateMemoCard.jsx';
import ReraEscrowAuditCard from '../components/rera/ReraEscrowAuditCard.jsx';
import {
  Building2,
  Calculator,
  ShieldAlert,
  FileText,
  FileCheck2,
  FolderLock,
  Download,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Gavel,
  Scale,
  DollarSign,
} from 'lucide-react';

export default function ReraDisputeWorkspace() {
  const [activeTab, setActiveTab] = useState('calculator');
  const [notification, setNotification] = useState(null);

  // Petition state
  const [petitionState, setPetitionState] = useState({
    jurisdiction: 'MAHARASHTRA',
    formType: RERA_FORM_TYPE.FORM_M,
    committedPossessionDate: '2023-06-30',
    gracePeriodMonths: 3,
    agreementDate: '2020-12-15',
    evaluationDate: new Date().toISOString().slice(0, 10),
    totalPaidInr: 6500000,
    totalAgreementCostInr: 7500000,
    annualInterestRate: DEFAULT_STATUTORY_INTEREST_RATE,
    reliefType: RERA_RELIEF_TYPE.POSSESSION_DELAY_INTEREST,
    complainant: {
      name: 'Aditi Deshmukh',
      address: 'Flat 302, Bandra West, Mumbai, Maharashtra',
      contact: '9820012345',
    },
    promoter: {
      name: 'Emerald City Developers LLP',
      projectName: 'Emerald Crest Towers',
      reraRegNo: 'P51800012345',
      projectLocation: 'Andheri East, Mumbai Suburban',
    },
    unitDetails: {
      unitNo: 'Wing A - Flat 1204',
    },
    interimReliefs: [
      'Restrain Respondent Promoter from creating third-party alienation on unsold inventory.',
      'Direct disclosure of project designated RERA escrow account bank records.',
    ],
  });

  // Evidence checklist state
  const [checklistState, setChecklistState] = useState({
    agreement_for_sale: true,
    allotment_letter: true,
    payment_receipts: true,
    rera_project_certificate: true,
    delay_correspondence: false,
    site_photographs: false,
    demand_notice_served: false,
  });

  // Saved complaints from local storage
  const [savedComplaints, setSavedComplaints] = useState(() => listReraComplaints());

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handlePetitionFieldChange = (field, value) => {
    setPetitionState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleToggleChecklistItem = (itemId) => {
    setChecklistState((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleSaveComplaint = () => {
    try {
      const saved = saveReraComplaint({
        ...petitionState,
        evidenceChecklist: checklistState,
      });
      setSavedComplaints(listReraComplaints());
      showNotification(`Complaint dossier successfully sealed and saved (${saved.id.slice(0, 10)}...)`);
    } catch (err) {
      showNotification(`Failed to save complaint: ${err.message}`, 'error');
    }
  };

  const handleSaveExecution = (executionPayload) => {
    try {
      const saved = saveReraComplaint(executionPayload);
      setSavedComplaints(listReraComplaints());
      showNotification(`Execution petition saved in vault (${saved.id.slice(0, 10)}...)`);
    } catch (err) {
      showNotification(`Failed to save execution petition: ${err.message}`, 'error');
    }
  };

  const handleSaveAppeal = (appealPayload) => {
    try {
      const saved = saveReraComplaint(appealPayload);
      setSavedComplaints(listReraComplaints());
      showNotification(`REAT appellate record saved in vault (${saved.id.slice(0, 10)}...)`);
    } catch (err) {
      showNotification(`Failed to save appellate record: ${err.message}`, 'error');
    }
  };

  const handleSaveAudit = (auditPayload) => {
    try {
      const saved = saveReraComplaint(auditPayload);
      setSavedComplaints(listReraComplaints());
      showNotification(`Escrow audit report saved in vault (${saved.id.slice(0, 10)}...)`);
    } catch (err) {
      showNotification(`Failed to save escrow audit: ${err.message}`, 'error');
    }
  };

  const handleDeleteComplaint = (id) => {
    const success = deleteReraComplaint(id);
    if (success) {
      setSavedComplaints(listReraComplaints());
      showNotification('Complaint removed from local vault.');
    }
  };

  const handleLoadComplaint = (complaint) => {
    setPetitionState(complaint);
    if (complaint.evidenceChecklist) {
      setChecklistState(complaint.evidenceChecklist);
    }
    setActiveTab('drafter');
    showNotification('Loaded complaint into drafter.');
  };

  const handleDownloadDossier = (complaint) => {
    const json = exportComplaintDossierJson(complaint);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RERA_Dossier_${complaint.id || 'export'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSlip = (complaint) => {
    const text = exportComplaintTextSlip(complaint);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RERA_Petition_${complaint.id || 'export'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Toast Notification */}
      {notification && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            zIndex: 9999,
            padding: '0.75rem 1.25rem',
            borderRadius: '0.5rem',
            background: notification.type === 'error' ? '#ef4444' : '#22c55e',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.9rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          {notification.message}
        </div>
      )}

      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))',
          border: '1px solid var(--border-light, #334155)',
          borderRadius: '1rem',
          padding: '2rem',
          marginBottom: '2rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '0.75rem',
              borderRadius: '0.75rem',
              background: 'rgba(59, 130, 246, 0.2)',
              color: '#3b82f6',
              display: 'flex',
            }}
          >
            <Building2 size={32} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--text-primary, #f8fafc)', fontWeight: 800 }}>
              RERA Homebuyer Dispute & Delayed Possession Workspace
            </h1>
            <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-secondary, #94a3b8)', fontSize: '0.95rem' }}>
              Statutory delay interest calculator (SBI MCLR + 2%), Section 14 defect liability, and Form M/N legal petition generator
            </p>
          </div>
        </div>

        {/* Feature Highlights */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '0.3rem 0.75rem',
              borderRadius: '999px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#3b82f6',
              border: '1px solid rgba(59, 130, 246, 0.3)',
            }}
          >
            Sec. 18 Interest: SBI MCLR + 2.0% p.a.
          </span>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '0.3rem 0.75rem',
              borderRadius: '999px',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            Sec. 14(3): 5-Year Structural Warranty
          </span>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '0.3rem 0.75rem',
              borderRadius: '999px',
              background: 'rgba(34, 197, 94, 0.15)',
              color: '#22c55e',
              border: '1px solid rgba(34, 197, 94, 0.3)',
            }}
          >
            Sec. 29(4): 60-Day Adjudication Ceiling
          </span>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '0.3rem 0.75rem',
              borderRadius: '999px',
              background: 'rgba(168, 85, 247, 0.15)',
              color: '#a855f7',
              border: '1px solid rgba(168, 85, 247, 0.3)',
            }}
          >
            Form M (Authority) & Form N (Compensation)
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div
        role="tablist"
        aria-label="RERA Workspace Tabs"
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-light, #334155)',
          paddingBottom: '0.5rem',
          marginBottom: '1.5rem',
          overflowX: 'auto',
        }}
      >
        <button
          role="tab"
          aria-selected={activeTab === 'calculator'}
          onClick={() => setActiveTab('calculator')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: activeTab === 'calculator' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            color: activeTab === 'calculator' ? '#3b82f6' : 'var(--text-secondary, #94a3b8)',
            fontWeight: activeTab === 'calculator' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <Calculator size={16} /> Delay Interest & Refund
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'defects'}
          onClick={() => setActiveTab('defects')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: activeTab === 'defects' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
            color: activeTab === 'defects' ? '#f59e0b' : 'var(--text-secondary, #94a3b8)',
            fontWeight: activeTab === 'defects' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <ShieldAlert size={16} /> Section 14 Defect Liability
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'escrow'}
          onClick={() => setActiveTab('escrow')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: activeTab === 'escrow' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
            color: activeTab === 'escrow' ? '#10b981' : 'var(--text-secondary, #94a3b8)',
            fontWeight: activeTab === 'escrow' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <DollarSign size={16} /> 70% Escrow Audit
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'drafter'}
          onClick={() => setActiveTab('drafter')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: activeTab === 'drafter' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
            color: activeTab === 'drafter' ? '#a855f7' : 'var(--text-secondary, #94a3b8)',
            fontWeight: activeTab === 'drafter' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <FileText size={16} /> Form M / Form N Drafter
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'execution'}
          onClick={() => setActiveTab('execution')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: activeTab === 'execution' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
            color: activeTab === 'execution' ? '#6366f1' : 'var(--text-secondary, #94a3b8)',
            fontWeight: activeTab === 'execution' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <Gavel size={16} /> Sec. 40 Execution & RRC
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'reat'}
          onClick={() => setActiveTab('reat')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: activeTab === 'reat' ? 'rgba(234, 88, 12, 0.15)' : 'transparent',
            color: activeTab === 'reat' ? '#ea580c' : 'var(--text-secondary, #94a3b8)',
            fontWeight: activeTab === 'reat' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <Scale size={16} /> REAT Appellate (Sec. 43/44)
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'evidence'}
          onClick={() => setActiveTab('evidence')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: activeTab === 'evidence' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
            color: activeTab === 'evidence' ? '#22c55e' : 'var(--text-secondary, #94a3b8)',
            fontWeight: activeTab === 'evidence' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <FileCheck2 size={16} /> Evidence Checklist
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'locker'}
          onClick={() => setActiveTab('locker')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: activeTab === 'locker' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            color: activeTab === 'locker' ? 'var(--text-primary, #f8fafc)' : 'var(--text-secondary, #94a3b8)',
            fontWeight: activeTab === 'locker' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <FolderLock size={16} /> Saved Case Locker ({savedComplaints.length})
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'calculator' && (
        <ReraInterestCalculator
          committedPossessionDate={petitionState.committedPossessionDate}
          onCommittedDateChange={(val) => handlePetitionFieldChange('committedPossessionDate', val)}
          gracePeriodMonths={petitionState.gracePeriodMonths}
          onGracePeriodChange={(val) => handlePetitionFieldChange('gracePeriodMonths', val)}
          totalAgreementCostInr={petitionState.totalAgreementCostInr}
          onAgreementCostChange={(val) => handlePetitionFieldChange('totalAgreementCostInr', val)}
          totalPaidInr={petitionState.totalPaidInr}
          onTotalPaidChange={(val) => handlePetitionFieldChange('totalPaidInr', val)}
          annualInterestRate={petitionState.annualInterestRate}
          onInterestRateChange={(val) => handlePetitionFieldChange('annualInterestRate', val)}
          reliefType={petitionState.reliefType}
          onReliefTypeChange={(val) => handlePetitionFieldChange('reliefType', val)}
        />
      )}

      {activeTab === 'defects' && <ReraDefectLiabilityCard />}

      {activeTab === 'escrow' && <ReraEscrowAuditCard onSaveAudit={handleSaveAudit} />}

      {activeTab === 'drafter' && (
        <ReraPetitionDrafter
          petitionState={petitionState}
          onPetitionFieldChange={handlePetitionFieldChange}
          onSaveComplaint={handleSaveComplaint}
        />
      )}

      {activeTab === 'execution' && (
        <ReraExecutionWarrantCard onSavePetition={handleSaveExecution} />
      )}

      {activeTab === 'reat' && (
        <ReraAppellateMemoCard onSaveAppeal={handleSaveAppeal} />
      )}

      {activeTab === 'evidence' && (
        <ReraEvidenceChecklist
          checklistState={checklistState}
          onToggleItem={handleToggleChecklistItem}
        />
      )}

      {activeTab === 'locker' && (
        <div
          style={{
            background: 'var(--bg-card, #1e293b)',
            border: '1px solid var(--border-light, #334155)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', color: 'var(--text-primary, #f8fafc)' }}>
            Offline Privacy Vault Locker
          </h3>
          <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
            All cases are securely stored in your local browser storage (<code style={{ color: '#3b82f6' }}>civicbridge_rera_complaints</code>) with cryptographic SHA-256 seal verification. Zero server sync.
          </p>

          {savedComplaints.length === 0 ? (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                borderRadius: '0.5rem',
                background: 'var(--bg-primary, #0f172a)',
                color: 'var(--text-secondary, #94a3b8)',
                fontSize: '0.9rem',
              }}
            >
              No complaints saved in this browser yet. Use the Drafter tab to generate and save your case.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {savedComplaints.map((item) => {
                const isIntegrityValid = verifyComplaintIntegrity(item);
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      background: 'var(--bg-primary, #0f172a)',
                      border: '1px solid var(--border-light, #334155)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary, #f8fafc)' }}>
                          {item.promoter?.projectName || 'Untitled Project'}
                        </strong>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '0.15rem 0.4rem',
                            borderRadius: '0.25rem',
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#3b82f6',
                          }}
                        >
                          {item.jurisdiction} - {item.recordType || item.formType}
                        </span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '0.15rem 0.4rem',
                            borderRadius: '0.25rem',
                            background: isIntegrityValid ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: isIntegrityValid ? '#22c55e' : '#ef4444',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          {isIntegrityValid ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                          {isIntegrityValid ? 'DIGITAL SEAL VERIFIED' : 'INTEGRITY MISMATCH'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '0.25rem' }}>
                        Complainant: {item.complainant?.name || 'N/A'} | Unit: {item.unitDetails?.unitNo || 'N/A'} | Paid: Rs. {Number(item.totalPaidInr || 0).toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '0.2rem', fontFamily: 'monospace' }}>
                        SHA-256: {item.digest ? `${item.digest.slice(0, 16)}...${item.digest.slice(-8)}` : 'N/A'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleLoadComplaint(item)}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                      >
                        Load Case
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadDossier(item)}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                      >
                        <Download size={13} /> JSON Dossier
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadSlip(item)}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                      >
                        <Download size={13} /> Text Slip
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteComplaint(item.id)}
                        className="btn btn-secondary"
                        style={{ color: '#ef4444', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                        aria-label="Delete complaint"
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

      {/* Statutory Footer Citation */}
      <div
        style={{
          marginTop: '2.5rem',
          padding: '1.25rem',
          borderRadius: '0.75rem',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-light, #334155)',
          fontSize: '0.8rem',
          color: 'var(--text-secondary, #94a3b8)',
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>Statutory Notice:</strong> This workspace implements legal calculation standards established under the <em>Real Estate (Regulation and Development) Act, 2016 (Act No. 16 of 2016)</em>, state RERA rules, and binding precedents of the Supreme Court of India (<em>Imperia Structures Ltd. v. Anil Patni</em>, <em>Newtech Promoters and Developers v. State of UP</em>). While designed for self-representation before State Authorities and Adjudicating Officers, citizens may seek independent legal counsel for complex multi-party arbitration.
      </div>
    </div>
  );
}
