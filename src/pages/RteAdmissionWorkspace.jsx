import { useState, useEffect } from 'react';
import {
  GraduationCap,
  ShieldAlert,
  FileSpreadsheet,
  FileText,
  Lock,
  Download,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Scale,
  RefreshCw,
} from 'lucide-react';
import RteEligibilityMatrixCard from '../components/rte/RteEligibilityMatrixCard.jsx';
import CapitationFeeAuditorCard from '../components/rte/CapitationFeeAuditorCard.jsx';
import FreeEntitlementReconcilerCard from '../components/rte/FreeEntitlementReconcilerCard.jsx';
import RtePetitionDrafter from '../components/rte/RtePetitionDrafter.jsx';
import {
  listRteGrievanceRecords,
  deleteRteGrievanceRecord,
  verifyRteGrievanceIntegrity,
  exportRteGrievanceDossierJson,
  exportRteGrievanceTextSlip,
} from '../services/rteAdmissionStorage.js';

export default function RteAdmissionWorkspace() {
  const [activeTab, setActiveTab] = useState('eligibility');
  const [eligibilityData, setEligibilityData] = useState(null);
  const [screeningData, setScreeningData] = useState(null);
  const [billingData, setBillingData] = useState(null);
  const [vaultRecords, setVaultRecords] = useState(() => listRteGrievanceRecords());
  const [integrityStatus, setIntegrityStatus] = useState({});
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    let isSubscribed = true;
    vaultRecords.forEach(async (rec) => {
      const isValid = await verifyRteGrievanceIntegrity(rec);
      if (isSubscribed) {
        setIntegrityStatus((prev) => ({ ...prev, [rec.id]: isValid }));
      }
    });
    return () => {
      isSubscribed = false;
    };
  }, [vaultRecords]);

  const refreshVault = () => {
    const list = listRteGrievanceRecords();
    setVaultRecords(list);
  };

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleRecordSaved = (saved) => {
    refreshVault();
    showNotification(`RTE Grievance record ${saved.id} sealed with SHA-256 and saved in vault.`);
  };

  const handleDeleteRecord = (id) => {
    deleteRteGrievanceRecord(id);
    refreshVault();
    showNotification('RTE grievance record permanently removed from vault.', 'info');
  };

  const handleExportJson = (record, dpdpScrubbed = true) => {
    const jsonStr = exportRteGrievanceDossierJson(record, dpdpScrubbed);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rte_dossier_${record.id}_${dpdpScrubbed ? 'dpdp_scrubbed' : 'raw'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportText = (record) => {
    const textStr = exportRteGrievanceTextSlip(record);
    const blob = new Blob([textStr], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rte_petition_${record.id}.txt`;
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
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
            }}
          >
            <GraduationCap size={28} />
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
              Right to Education (RTE) Section 12(1)(c) Quota &amp; Child Rights Workspace
            </h1>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: 'var(--text-secondary, #94a3b8)' }}>
              Evaluate 25% EWS/DG quota eligibility, audit illegal screening and capitation penalties (Section 13), reconcile free entitlements (Section 3(2)), and draft Section 32 petitions for BEO/SCPCR redressal.
            </p>
          </div>
        </div>

        {/* Legal Jurisprudence Alert Banner */}
        <div
          style={{
            background: 'rgba(2, 132, 199, 0.1)',
            border: '1px solid rgba(2, 132, 199, 0.3)',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.85rem',
            color: 'var(--text-primary, #f8fafc)',
          }}
        >
          <Scale size={20} style={{ color: '#38bdf8', flexShrink: 0 }} />
          <div>
            <strong>Binding Supreme Court Authority:</strong> In <em>Society for Unaided Private Schools of Rajasthan v. Union of India (2012) 6 SCC 1</em>, the Supreme Court affirmed that unaided private schools are constitutionally bound to admit at least 25% EWS/DG children with completely free elementary education. Capitation fees or screening interviews of children or parents attract up to 10x fines and loss of school recognition under Section 18.
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            background: notification.type === 'info' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            border: `1px solid ${notification.type === 'info' ? '#3b82f6' : '#22c55e'}`,
            color: 'var(--text-primary, #f8fafc)',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CheckCircle size={18} style={{ color: notification.type === 'info' ? '#3b82f6' : '#22c55e' }} />
          {notification.msg}
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-light, #334155)',
          marginBottom: '1.5rem',
          overflowX: 'auto',
          paddingBottom: '0.25rem',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('eligibility')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.6rem 1rem',
            border: 'none',
            background: 'none',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'eligibility' ? '2px solid #38bdf8' : '2px solid transparent',
            color: activeTab === 'eligibility' ? '#38bdf8' : 'var(--text-secondary, #94a3b8)',
          }}
        >
          <GraduationCap size={16} />
          EWS/DG Quota Eligibility
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('screening')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.6rem 1rem',
            border: 'none',
            background: 'none',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'screening' ? '2px solid #f87171' : '2px solid transparent',
            color: activeTab === 'screening' ? '#f87171' : 'var(--text-secondary, #94a3b8)',
          }}
        >
          <ShieldAlert size={16} />
          Screening &amp; Capitation Audit
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('entitlements')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.6rem 1rem',
            border: 'none',
            background: 'none',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'entitlements' ? '2px solid #facc15' : '2px solid transparent',
            color: activeTab === 'entitlements' ? '#facc15' : 'var(--text-secondary, #94a3b8)',
          }}
        >
          <FileSpreadsheet size={16} />
          Free Entitlements Reconciler
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('petition')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.6rem 1rem',
            border: 'none',
            background: 'none',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'petition' ? '2px solid #38bdf8' : '2px solid transparent',
            color: activeTab === 'petition' ? '#38bdf8' : 'var(--text-secondary, #94a3b8)',
          }}
        >
          <FileText size={16} />
          Section 32 Petition Drafter
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vault')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.6rem 1rem',
            border: 'none',
            background: 'none',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'vault' ? '2px solid #10b981' : '2px solid transparent',
            color: activeTab === 'vault' ? '#10b981' : 'var(--text-secondary, #94a3b8)',
          }}
        >
          <Lock size={16} />
          Confidential Vault ({vaultRecords.length})
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'eligibility' && (
        <RteEligibilityMatrixCard onEligibilityChange={setEligibilityData} />
      )}

      {activeTab === 'screening' && (
        <CapitationFeeAuditorCard onScreeningAuditChange={setScreeningData} />
      )}

      {activeTab === 'entitlements' && (
        <FreeEntitlementReconcilerCard onBillingAuditChange={setBillingData} />
      )}

      {activeTab === 'petition' && (
        <RtePetitionDrafter
          eligibilityData={eligibilityData}
          screeningData={screeningData}
          billingData={billingData}
          onRecordSaved={handleRecordSaved}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Lock size={24} style={{ color: '#10b981' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary, #f8fafc)' }}>
                  Confidential RTE Grievance Vault (`civicbridge_rte_grievance_vault`)
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
                  Client-side offline repository with SHA-256 evidence seals and DPDP Act 2023 sanitized exports.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={refreshVault}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'var(--bg-dark, #0f172a)',
                border: '1px solid var(--border-light, #334155)',
                color: 'var(--text-primary, #f8fafc)',
                padding: '0.4rem 0.8rem',
                borderRadius: '0.5rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {vaultRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary, #94a3b8)' }}>
              No RTE grievance dossiers currently stored. Use the Section 32 Petition Drafter tab to prepare and seal a formal petition.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {vaultRecords.map((record) => {
                const isValid = integrityStatus[record.id];
                return (
                  <div
                    key={record.id}
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '0.75rem',
                      padding: '1.25rem',
                      border: '1px solid var(--border-light, #334155)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary, #f8fafc)' }}>
                            {record.schoolName}
                          </span>
                          <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem', borderRadius: '0.25rem', background: '#0284c7', color: '#fff' }}>
                            {record.category || 'EWS'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '0.2rem' }}>
                          Ref: {record.allotmentSlipId} | Location: {record.districtName}, {record.stateName} | Target: {record.targetGrade}
                        </div>
                      </div>

                      {/* Integrity Seal Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {isValid ? (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '9999px',
                              background: 'rgba(34, 197, 94, 0.2)',
                              color: '#4ade80',
                              border: '1px solid rgba(34, 197, 94, 0.4)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                          >
                            <CheckCircle size={12} /> SHA-256 Valid
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '9999px',
                              background: 'rgba(239, 68, 68, 0.2)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                          >
                            <AlertTriangle size={12} /> Seal Mismatch
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.75rem', fontFamily: 'monospace' }}>
                      Seal: {record.sha256Seal}
                    </div>

                    {/* Action Bar */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => handleExportJson(record, true)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          background: 'var(--bg-dark, #0f172a)',
                          border: '1px solid var(--border-light, #334155)',
                          color: '#38bdf8',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.4rem',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        <Download size={13} /> DPDP Scrubbed JSON
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExportText(record)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          background: 'var(--bg-dark, #0f172a)',
                          border: '1px solid var(--border-light, #334155)',
                          color: '#facc15',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.4rem',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        <Download size={13} /> Legal Petition TXT
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteRecord(record.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#f87171',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.4rem',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={13} /> Purge
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
}
