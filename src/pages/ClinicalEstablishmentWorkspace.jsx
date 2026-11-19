import { useState, useEffect } from 'react';
import {
  HeartPulse,
  ShieldAlert,
  CreditCard,
  FileText,
  Lock,
  Download,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Scale,
  RefreshCw,
} from 'lucide-react';
import EmergencyCareAuditorCard from '../components/clinicalEstablishment/EmergencyCareAuditorCard.jsx';
import StandardBillingAnalyzerCard from '../components/clinicalEstablishment/StandardBillingAnalyzerCard.jsx';
import PatientRightsMatrixCard from '../components/clinicalEstablishment/PatientRightsMatrixCard.jsx';
import DistrictAuthorityComplaintDrafter from '../components/clinicalEstablishment/DistrictAuthorityComplaintDrafter.jsx';
import {
  saveGrievanceRecord,
  listGrievanceRecords,
  deleteGrievanceRecord,
  verifyGrievanceIntegrity,
  exportGrievanceDossierJson,
  exportGrievanceTextSlip,
} from '../services/clinicalEstablishmentStorage.js';

export default function ClinicalEstablishmentWorkspace() {
  const [activeTab, setActiveTab] = useState('emergency');
  const [complianceData, setComplianceData] = useState(null);
  const [billingData, setBillingData] = useState(null);
  const [rightsViolations, setRightsViolations] = useState(null);
  const [vaultRecords, setVaultRecords] = useState(() => listGrievanceRecords());
  const [integrityStatus, setIntegrityStatus] = useState({});
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    let isSubscribed = true;
    vaultRecords.forEach(async (rec) => {
      const isValid = await verifyGrievanceIntegrity(rec);
      if (isSubscribed) {
        setIntegrityStatus((prev) => ({ ...prev, [rec.id]: isValid }));
      }
    });
    return () => {
      isSubscribed = false;
    };
  }, [vaultRecords]);

  const refreshVault = () => {
    const list = listGrievanceRecords();
    setVaultRecords(list);
  };

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleSaveToVault = async (payload) => {
    const saved = await saveGrievanceRecord(payload);
    refreshVault();
    showNotification(`Grievance record ${saved.id} sealed with SHA-256 and stored in vault.`);
  };

  const handleDeleteRecord = (id) => {
    deleteGrievanceRecord(id);
    refreshVault();
    showNotification('Grievance record permanently purged from vault.', 'info');
  };

  const handleExportJson = (record, dpdpScrubbed = true) => {
    const jsonStr = exportGrievanceDossierJson(record, dpdpScrubbed);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `grievance_${record.id}_${dpdpScrubbed ? 'dpdp_scrubbed' : 'raw'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportText = (record) => {
    const textStr = exportGrievanceTextSlip(record);
    const blob = new Blob([textStr], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `grievance_memo_${record.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div
            style={{
              padding: '0.6rem',
              borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: '#ffffff',
            }}
          >
            <HeartPulse size={28} />
          </div>
          <div>
            <h1
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                margin: 0,
                color: 'var(--text-primary, #f8fafc)',
              }}
            >
              Clinical Establishment Emergency Care & Patient Rights Workspace
            </h1>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: 'var(--text-secondary, #94a3b8)' }}>
              Audit Emergency Non-Refusal (Section 56 CEA 2010), Analyze Standard Rate Overbilling (Section 12(2)(o)), & Draft DRA Petitions
            </p>
          </div>
        </div>

        {/* Legal Authority Alert */}
        <div
          style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '0.75rem',
            padding: '0.85rem 1.25rem',
            fontSize: '0.85rem',
            color: 'var(--text-secondary, #cbd5e1)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <Scale size={20} style={{ color: '#38bdf8', flexShrink: 0 }} />
          <div>
            <strong>Statutory Mandate: </strong>
            Under Section 56 of the Clinical Establishments Act 2010 and Supreme Court precedent in{' '}
            <em>Pt. Parmanand Katara v. Union of India (1989)</em>, every hospital is legally mandated to stabilize emergency patients without demanding advance deposits or procedural delays.
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            background: notification.type === 'info' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(34, 197, 94, 0.2)',
            border: `1px solid ${notification.type === 'info' ? '#38bdf8' : '#22c55e'}`,
            color: 'var(--text-primary, #f8fafc)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
          }}
        >
          <CheckCircle size={16} />
          {notification.msg}
        </div>
      )}

      {/* Workspace Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          overflowX: 'auto',
          borderBottom: '1px solid var(--border-light, #334155)',
          marginBottom: '1.5rem',
          paddingBottom: '0.25rem',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('emergency')}
          style={{
            padding: '0.6rem 1rem',
            border: 'none',
            background: 'transparent',
            borderBottom: activeTab === 'emergency' ? '2px solid #ef4444' : '2px solid transparent',
            color: activeTab === 'emergency' ? '#ef4444' : 'var(--text-secondary, #94a3b8)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap',
          }}
        >
          <ShieldAlert size={16} />
          Emergency Care Auditor (Sec 56)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('billing')}
          style={{
            padding: '0.6rem 1rem',
            border: 'none',
            background: 'transparent',
            borderBottom: activeTab === 'billing' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'billing' ? '#3b82f6' : 'var(--text-secondary, #94a3b8)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap',
          }}
        >
          <CreditCard size={16} />
          Rate Overbilling Analyzer (Sec 12)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('charter')}
          style={{
            padding: '0.6rem 1rem',
            border: 'none',
            background: 'transparent',
            borderBottom: activeTab === 'charter' ? '2px solid #10b981' : '2px solid transparent',
            color: activeTab === 'charter' ? '#10b981' : 'var(--text-secondary, #94a3b8)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap',
          }}
        >
          <FileText size={16} />
          Patient Rights Charter Matrix
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('drafter')}
          style={{
            padding: '0.6rem 1rem',
            border: 'none',
            background: 'transparent',
            borderBottom: activeTab === 'drafter' ? '2px solid #a855f7' : '2px solid transparent',
            color: activeTab === 'drafter' ? '#a855f7' : 'var(--text-secondary, #94a3b8)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap',
          }}
        >
          <Scale size={16} />
          Statutory Drafter (DM / CMO)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vault')}
          style={{
            padding: '0.6rem 1rem',
            border: 'none',
            background: 'transparent',
            borderBottom: activeTab === 'vault' ? '2px solid #eab308' : '2px solid transparent',
            color: activeTab === 'vault' ? '#eab308' : 'var(--text-secondary, #94a3b8)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap',
          }}
        >
          <Lock size={16} />
          Vault & Digital Seals ({vaultRecords.length})
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'emergency' && (
        <EmergencyCareAuditorCard onComplianceChange={setComplianceData} />
      )}

      {activeTab === 'billing' && (
        <StandardBillingAnalyzerCard onBillingAnalysisChange={setBillingData} />
      )}

      {activeTab === 'charter' && (
        <PatientRightsMatrixCard onViolationsChange={setRightsViolations} />
      )}

      {activeTab === 'drafter' && (
        <DistrictAuthorityComplaintDrafter
          compliance={complianceData}
          billingAnalysis={billingData}
          rightsViolations={rightsViolations}
          onSaveToVault={handleSaveToVault}
        />
      )}

      {activeTab === 'vault' && (
        <div
          style={{
            background: 'var(--bg-card, #1e293b)',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid var(--border-light, #334155)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  padding: '0.5rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(234, 179, 8, 0.15)',
                  color: '#eab308',
                }}
              >
                <Lock size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
                  Confidential Patient Grievance Vault (Local-First & DPDP Act Compliant)
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
                  Cryptographically verified with SHA-256 digital seals to ensure tamper-proof legal admissibility
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={refreshVault}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border-light, #475569)',
                background: 'transparent',
                color: 'var(--text-secondary, #94a3b8)',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {vaultRecords.length === 0 ? (
            <div
              style={{
                padding: '2.5rem',
                textAlign: 'center',
                color: 'var(--text-secondary, #94a3b8)',
                background: 'var(--bg-secondary, #0f172a)',
                borderRadius: '0.5rem',
              }}
            >
              <Lock size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
              <p style={{ margin: 0, fontSize: '0.95rem' }}>No patient grievance dossiers currently saved.</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
                Draft a complaint in the Statutory Drafter tab and click "Save Grievance to Vault" to securely seal it.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {vaultRecords.map((record) => {
                const isSealValid = integrityStatus[record.id];
                return (
                  <div
                    key={record.id}
                    style={{
                      padding: '1rem',
                      background: 'var(--bg-secondary, #0f172a)',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light, #334155)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary, #f8fafc)' }}>
                            {record.hospitalName || 'Clinical Establishment'}
                          </h4>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '9999px',
                              background: isSealValid ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              color: isSealValid ? '#22c55e' : '#ef4444',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            {isSealValid ? <CheckCircle size={10} /> : <AlertTriangle size={10} />}
                            {isSealValid ? 'Seal Verified' : 'Integrity Altered'}
                          </span>
                        </div>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
                          District: {record.district || 'N/A'}, {record.state || 'N/A'} | UHID/IPD: {record.ipdNumber || 'N/A'} | Date: {record.createdAt ? new Date(record.createdAt).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => handleExportJson(record, true)}
                          title="Export DPDP Redacted JSON"
                          style={{
                            padding: '0.35rem 0.65rem',
                            borderRadius: '0.375rem',
                            border: '1px solid var(--border-light, #475569)',
                            background: 'transparent',
                            color: '#38bdf8',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <Download size={12} /> DPDP JSON
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportText(record)}
                          title="Export Drafter Text"
                          style={{
                            padding: '0.35rem 0.65rem',
                            borderRadius: '0.375rem',
                            border: '1px solid var(--border-light, #475569)',
                            background: 'transparent',
                            color: '#10b981',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <Download size={12} /> Memo .txt
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(record.id)}
                          title="Purge Record"
                          style={{
                            padding: '0.35rem 0.65rem',
                            borderRadius: '0.375rem',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: '0.7rem',
                        fontFamily: 'monospace',
                        color: 'var(--text-muted, #64748b)',
                        background: 'rgba(0,0,0,0.2)',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '0.25rem',
                        overflowX: 'auto',
                      }}
                    >
                      SHA-256 Digital Seal: {record.digitalSeal || 'N/A'}
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
}
