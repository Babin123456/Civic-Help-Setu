import { useState, useEffect } from 'react';
import {
  Store,
  ShieldCheck,
  PackageX,
  MapPinOff,
  FileText,
  Lock,
  Download,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Scale,
  RefreshCw,
} from 'lucide-react';
import EvictionImmunityCard from '../components/vendor/EvictionImmunityCard.jsx';
import SeizureReconcilerCard from '../components/vendor/SeizureReconcilerCard.jsx';
import RelocationNoticeCard from '../components/vendor/RelocationNoticeCard.jsx';
import TvcGrievanceDrafterCard from '../components/vendor/TvcGrievanceDrafterCard.jsx';
import {
  listVendorRightsRecords,
  deleteVendorRightsRecord,
  verifyVendorRightsIntegrity,
  exportVendorRightsDossierJson,
  exportVendorRightsTextSlip,
} from '../services/streetVendorStorage.js';

export default function StreetVendorWorkspace() {
  const [activeTab, setActiveTab] = useState('immunity');
  const [immunityData, setImmunityData] = useState(null);
  const [goodsSeizureData, setGoodsSeizureData] = useState(null);
  const [relocationData, setRelocationData] = useState(null);
  const [vaultRecords, setVaultRecords] = useState(() => listVendorRightsRecords());
  const [integrityStatus, setIntegrityStatus] = useState({});
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    let isSubscribed = true;
    vaultRecords.forEach(async (rec) => {
      const isValid = await verifyVendorRightsIntegrity(rec);
      if (isSubscribed) {
        setIntegrityStatus((prev) => ({ ...prev, [rec.id]: isValid }));
      }
    });
    return () => {
      isSubscribed = false;
    };
  }, [vaultRecords]);

  const refreshVault = () => {
    const list = listVendorRightsRecords();
    setVaultRecords(list);
  };

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleRecordSaved = (saved) => {
    refreshVault();
    showNotification(`Vendor rights appeal ${saved.id} sealed with SHA-256 and saved in vault.`);
  };

  const handleDeleteRecord = (id) => {
    deleteVendorRightsRecord(id);
    refreshVault();
    showNotification('Vendor record permanently purged from vault.', 'info');
  };

  const handleExportJson = (record, dpdpScrubbed = true) => {
    const jsonStr = exportVendorRightsDossierJson(record, dpdpScrubbed);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vendor_dossier_${record.id}_${dpdpScrubbed ? 'dpdp_scrubbed' : 'raw'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportText = (record) => {
    const textStr = exportVendorRightsTextSlip(record);
    const blob = new Blob([textStr], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vendor_appeal_${record.id}.txt`;
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
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: '#ffffff',
            }}
          >
            <Store size={28} />
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
              Street Vendors Protection of Livelihood &amp; TVC Grievance Workspace
            </h1>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: 'var(--text-secondary, #94a3b8)' }}>
              Evaluate Section 3(3) non-eviction immunity, reconcile Section 19 goods confiscations and holding fee caps, audit Section 18 relocations, and draft Section 20 statutory appeals.
            </p>
          </div>
        </div>

        {/* Legal Jurisprudence Alert Banner */}
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.85rem',
            color: 'var(--text-primary, #f8fafc)',
          }}
        >
          <Scale size={20} style={{ color: '#34d399', flexShrink: 0 }} />
          <div>
            <strong>Supreme Court Mandate in Maharashtra Ekta Hawkers Union (2014):</strong> Under Section 3(3) of the Street Vendors Act 2014, no street vendor can be evicted or relocated until the statutory Town Vending Committee (TVC) survey is fully completed and vending certificates are issued. Confiscation of goods without signed inventory memos violates Section 19.
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
          onClick={() => setActiveTab('immunity')}
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
            borderBottom: activeTab === 'immunity' ? '2px solid #34d399' : '2px solid transparent',
            color: activeTab === 'immunity' ? '#34d399' : 'var(--text-secondary, #94a3b8)',
          }}
        >
          <ShieldCheck size={16} />
          Sec 3(3) Eviction Immunity
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('seizure')}
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
            borderBottom: activeTab === 'seizure' ? '2px solid #f87171' : '2px solid transparent',
            color: activeTab === 'seizure' ? '#f87171' : 'var(--text-secondary, #94a3b8)',
          }}
        >
          <PackageX size={16} />
          Sec 19 Seizure Reconciler
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('relocation')}
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
            borderBottom: activeTab === 'relocation' ? '2px solid #facc15' : '2px solid transparent',
            color: activeTab === 'relocation' ? '#facc15' : 'var(--text-secondary, #94a3b8)',
          }}
        >
          <MapPinOff size={16} />
          Sec 18 Relocation Notice
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('drafter')}
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
            borderBottom: activeTab === 'drafter' ? '2px solid #38bdf8' : '2px solid transparent',
            color: activeTab === 'drafter' ? '#38bdf8' : 'var(--text-secondary, #94a3b8)',
          }}
        >
          <FileText size={16} />
          Sec 20 Appeal Drafter
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

      {/* Panels */}
      {activeTab === 'immunity' && (
        <EvictionImmunityCard onImmunityChange={setImmunityData} />
      )}

      {activeTab === 'seizure' && (
        <SeizureReconcilerCard onSeizureAuditChange={setGoodsSeizureData} />
      )}

      {activeTab === 'relocation' && (
        <RelocationNoticeCard onRelocationAuditChange={setRelocationData} />
      )}

      {activeTab === 'drafter' && (
        <TvcGrievanceDrafterCard
          immunityData={immunityData}
          goodsSeizureData={goodsSeizureData}
          relocationData={relocationData}
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
                  Confidential Vendor Rights Vault (`civicbridge_vendor_rights_vault`)
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
                  Offline client-side ledger with SHA-256 evidence seals and DPDP Act 2023 sanitized exports.
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
              No vendor rights dossiers currently stored. Use the Section 20 Appeal Drafter tab to prepare and seal an appeal.
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
                            {record.vendorName}
                          </span>
                          <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem', borderRadius: '0.25rem', background: '#059669', color: '#fff' }}>
                            {record.vendingCategory || 'Street Vendor'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '0.2rem' }}>
                          Location: {record.vendingPitchLocation} | Municipality: {record.municipalityName} ({record.wardNumber})
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
                        <Download size={13} /> Section 20 Appeal TXT
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
