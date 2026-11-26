import { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  PawPrint,
  HeartHandshake,
  FileText,
  Archive,
  Download,
  Trash2,
  Lock,
} from 'lucide-react';
import RabiesPepCalculatorCard from '../components/strayAnimal/RabiesPepCalculatorCard.jsx';
import AbcComplianceAuditCard from '../components/strayAnimal/AbcComplianceAuditCard.jsx';
import CommunityFeederCharterCard from '../components/strayAnimal/CommunityFeederCharterCard.jsx';
import StrayAnimalStatutoryDrafter from '../components/strayAnimal/StrayAnimalStatutoryDrafter.jsx';
import {
  getStoredRecords,
  saveRecord,
  deleteRecord,
  exportRecordTextSlip,
  exportRecordJsonSlip,
  verifyRecordIntegrity,
} from '../services/strayAnimalStorage.js';

export default function StrayAnimalAbcWorkspace() {
  const [activeTab, setActiveTab] = useState('rabies_pep');
  const [pepData, setPepData] = useState(null);
  const [savedRecords, setSavedRecords] = useState(() => getStoredRecords());
  const [integrityStatus, setIntegrityStatus] = useState({});

  const refreshVault = useCallback(async () => {
    const list = getStoredRecords();
    setSavedRecords(list);

    const statusMap = {};
    for (const rec of list) {
      statusMap[rec.id] = await verifyRecordIntegrity(rec);
    }
    setIntegrityStatus(statusMap);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const checkInitialIntegrity = async () => {
      const list = getStoredRecords();
      const statusMap = {};
      for (const rec of list) {
        statusMap[rec.id] = await verifyRecordIntegrity(rec);
      }
      if (isMounted) {
        setIntegrityStatus(statusMap);
      }
    };
    checkInitialIntegrity();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveRecord = async (payload) => {
    await saveRecord(payload);
    await refreshVault();
  };

  const handleDeleteRecord = (id) => {
    if (window.confirm('Delete this record from local vault?')) {
      deleteRecord(id);
      refreshVault();
    }
  };

  const handleExportText = (record) => {
    const text = exportRecordTextSlip(record);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Record_${record.recordType}_${record.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = (record) => {
    const json = exportRecordJsonSlip(record, true);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Record_DPDP_Redacted_${record.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.2rem 0.6rem',
              borderRadius: '999px',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
            }}
          >
            SWM &amp; NRCP COMPLIANT
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.2rem 0.6rem',
              borderRadius: '999px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#3b82f6',
            }}
          >
            ANIMAL BIRTH CONTROL RULES, 2023
          </span>
        </div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
          Municipal Stray Animal Conflict &amp; Rabies PEP Emergency Workspace
        </h1>
        <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', maxWidth: '900px', lineHeight: 1.5 }}>
          Personalized Rabies Post-Exposure Prophylaxis (PEP) vaccination tracker, Animal Birth Control (ABC) Rules 2023 ward auditor,
          Rule 20 community feeder protection charter, and municipal legal requisition generator.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-light, #334155)',
          paddingBottom: '0.75rem',
          marginBottom: '1.5rem',
          overflowX: 'auto',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('rabies_pep')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: activeTab === 'rabies_pep' ? '#ef4444' : 'transparent',
            color: activeTab === 'rabies_pep' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          <ShieldAlert size={16} />
          Rabies PEP Tracker
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('abc_audit')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: activeTab === 'abc_audit' ? '#3b82f6' : 'transparent',
            color: activeTab === 'abc_audit' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          <PawPrint size={16} />
          ABC Rules 2023 Auditor
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('feeder_charter')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: activeTab === 'feeder_charter' ? '#10b981' : 'transparent',
            color: activeTab === 'feeder_charter' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          <HeartHandshake size={16} />
          Rule 20 Feeder Charter
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('statutory_drafter')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: activeTab === 'statutory_drafter' ? '#6366f1' : 'transparent',
            color: activeTab === 'statutory_drafter' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          <FileText size={16} />
          Legal Requisition Drafter
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vault')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: activeTab === 'vault' ? '#eab308' : 'transparent',
            color: activeTab === 'vault' ? '#000000' : 'var(--text-secondary)',
          }}
        >
          <Archive size={16} />
          Saved Vault ({savedRecords.length})
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'rabies_pep' && (
        <RabiesPepCalculatorCard onCalculationChange={setPepData} />
      )}

      {activeTab === 'abc_audit' && (
        <AbcComplianceAuditCard />
      )}

      {activeTab === 'feeder_charter' && (
        <CommunityFeederCharterCard />
      )}

      {activeTab === 'statutory_drafter' && (
        <StrayAnimalStatutoryDrafter
          pepCalculationData={pepData}
          onSaveRecord={handleSaveRecord}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div
              style={{
                padding: '0.6rem',
                background: 'rgba(234, 179, 8, 0.15)',
                borderRadius: '0.75rem',
                color: '#eab308',
              }}
            >
              <Archive size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Offline Vault &amp; Digital Seals
              </h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Client-side encrypted local records with SHA-256 tamper seals under key <code>civicbridge_abc_conflict_records</code>
              </p>
            </div>
          </div>

          {savedRecords.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                background: 'var(--bg-card-secondary, #0f172a)',
                borderRadius: '0.75rem',
                border: '1px dashed var(--border-light, #334155)',
              }}
            >
              <FileText size={36} color="var(--text-secondary)" style={{ marginBottom: '0.75rem', opacity: 0.6 }} />
              <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>No conflict or PEP records saved yet</p>
              <small style={{ color: 'var(--text-secondary)' }}>
                Generate a Rabies PEP Medical Passport or Municipal ABC Requisition in the Drafter and click &quot;Save Record to Vault&quot;.
              </small>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {savedRecords.map((rec) => {
                const isValid = integrityStatus[rec.id];
                return (
                  <div
                    key={rec.id}
                    style={{
                      background: 'var(--bg-card-secondary, #0f172a)',
                      border: '1px solid var(--border-light, #334155)',
                      borderRadius: '0.75rem',
                      padding: '1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          {rec.recordType === 'pep_vaccination_log' ? 'Rabies PEP Vaccination Log' : 'Municipal ABC Requisition'}
                        </strong>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '999px',
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#3b82f6',
                            fontWeight: 600,
                          }}
                        >
                          {rec.wardNumber || 'General Ward'}
                        </span>
                      </div>
                      <small style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                        Saved: {new Date(rec.createdAt).toLocaleString('en-IN')}
                      </small>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}>
                        <Lock size={12} color={isValid ? '#22c55e' : '#ef4444'} />
                        <span style={{ color: isValid ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                          {isValid ? 'Verified SHA-256 Digital Seal' : 'Warning: Tampered Record'}
                        </span>
                        <code style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          ({String(rec.digitalSeal).slice(0, 12)}...)
                        </code>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleExportText(rec)}
                        title="Download formatted text document"
                        style={{
                          padding: '0.45rem 0.75rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: '1px solid var(--border-light, #334155)',
                          background: 'transparent',
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <Download size={14} />
                        Text Slip
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExportJson(rec)}
                        title="Export DPDP-scrubbed JSON"
                        style={{
                          padding: '0.45rem 0.75rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: '1px solid var(--border-light, #334155)',
                          background: 'transparent',
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <Download size={14} />
                        JSON (DPDP)
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteRecord(rec.id)}
                        title="Delete from vault"
                        style={{
                          padding: '0.45rem',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                        }}
                      >
                        <Trash2 size={16} />
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
