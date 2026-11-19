import { useState, useEffect, useCallback } from 'react';
import {
  Volume2,
  Moon,
  VolumeX,
  FileText,
  Archive,
  Download,
  Trash2,
  Lock,
} from 'lucide-react';
import DecibelLoggerCard from '../components/noisePollution/DecibelLoggerCard.jsx';
import NoiseCurfewAuditorCard from '../components/noisePollution/NoiseCurfewAuditorCard.jsx';
import SilenceZoneBoundaryChecker from '../components/noisePollution/SilenceZoneBoundaryChecker.jsx';
import NoiseComplaintDrafter from '../components/noisePollution/NoiseComplaintDrafter.jsx';
import {
  getStoredNoiseLogs,
  saveNoiseLog,
  deleteNoiseLog,
  exportNoiseLogTextSlip,
  exportNoiseLogJsonSlip,
  verifyNoiseLogIntegrity,
} from '../services/noisePollutionStorage.js';

export default function NoisePollutionWorkspace() {
  const [activeTab, setActiveTab] = useState('decibel_logger');
  const [evaluationData, setEvaluationData] = useState(null);
  const [savedLogs, setSavedLogs] = useState(() => getStoredNoiseLogs());
  const [integrityMap, setIntegrityMap] = useState({});

  const refreshVault = useCallback(async () => {
    const logs = getStoredNoiseLogs();
    setSavedLogs(logs);

    const statusMap = {};
    for (const log of logs) {
      statusMap[log.id] = await verifyNoiseLogIntegrity(log);
    }
    setIntegrityMap(statusMap);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const verifyInitial = async () => {
      const logs = getStoredNoiseLogs();
      const statusMap = {};
      for (const log of logs) {
        statusMap[log.id] = await verifyNoiseLogIntegrity(log);
      }
      if (isMounted) {
        setIntegrityMap(statusMap);
      }
    };
    verifyInitial();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveLog = async (payload) => {
    await saveNoiseLog(payload);
    await refreshVault();
  };

  const handleDeleteLog = (id) => {
    if (window.confirm('Delete this noise violation log from local vault?')) {
      deleteNoiseLog(id);
      refreshVault();
    }
  };

  const handleExportText = (log) => {
    const text = exportNoiseLogTextSlip(log);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rule7_Noise_Complaint_${log.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = (log) => {
    const json = exportNoiseLogJsonSlip(log, true);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Noise_Log_DPDP_${log.id}.json`;
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
            EPA 1986 &amp; NOISE RULES 2000
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
            CPCB ENVIRONMENTAL NORMS
          </span>
        </div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
          Ambient Noise Pollution &amp; Statutory SDM Redressal Workspace
        </h1>
        <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', maxWidth: '900px', lineHeight: 1.5 }}>
          Time-weighted sound measurement auditor, Rule 5 night-time curfew compliance detector, 100-meter silence zone perimeter checker,
          and court-ready Rule 7 statutory complaint generator addressed to Sub-Divisional Magistrates and Police Commissioners.
        </p>
      </div>

      {/* Tabs */}
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
          onClick={() => setActiveTab('decibel_logger')}
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
            background: activeTab === 'decibel_logger' ? '#3b82f6' : 'transparent',
            color: activeTab === 'decibel_logger' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          <Volume2 size={16} />
          Decibel Logger &amp; Limits
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('curfew_auditor')}
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
            background: activeTab === 'curfew_auditor' ? '#818cf8' : 'transparent',
            color: activeTab === 'curfew_auditor' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          <Moon size={16} />
          Rule 5 Curfew &amp; DG Sets
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('silence_zone')}
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
            background: activeTab === 'silence_zone' ? '#10b981' : 'transparent',
            color: activeTab === 'silence_zone' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          <VolumeX size={16} />
          Silence Zone (100m)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('complaint_drafter')}
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
            background: activeTab === 'complaint_drafter' ? '#ef4444' : 'transparent',
            color: activeTab === 'complaint_drafter' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          <FileText size={16} />
          SDM Complaint Drafter
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
          Saved Logs ({savedLogs.length})
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'decibel_logger' && (
        <DecibelLoggerCard onEvaluationChange={setEvaluationData} />
      )}

      {activeTab === 'curfew_auditor' && (
        <NoiseCurfewAuditorCard />
      )}

      {activeTab === 'silence_zone' && (
        <SilenceZoneBoundaryChecker />
      )}

      {activeTab === 'complaint_drafter' && (
        <NoiseComplaintDrafter
          evaluationData={evaluationData}
          onSaveLog={handleSaveLog}
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
                Offline Decibel Log Vault &amp; Digital Seals
              </h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Client-side encrypted local records with SHA-256 tamper seals under key <code>civicbridge_noise_pollution_logs</code>
              </p>
            </div>
          </div>

          {savedLogs.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                background: 'var(--bg-card-secondary, #0f172a)',
                borderRadius: '0.75rem',
                border: '1px dashed var(--border-light, #334155)',
              }}
            >
              <Volume2 size={36} color="var(--text-secondary)" style={{ marginBottom: '0.75rem', opacity: 0.6 }} />
              <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>No noise violation logs saved yet</p>
              <small style={{ color: 'var(--text-secondary)' }}>
                Measure an offending sound in the Decibel Logger and click &quot;Save Log to Vault&quot; in the SDM Complaint Drafter.
              </small>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {savedLogs.map((log) => {
                const isValid = integrityMap[log.id];
                return (
                  <div
                    key={log.id}
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
                          {log.observedDbA} dB(A) Recorded (+{log.exceedanceDbA} dB Exceedance)
                        </strong>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '999px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            fontWeight: 600,
                          }}
                        >
                          {log.zoneKey}
                        </span>
                      </div>
                      <small style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                        Location: {log.location?.incidentLocation || log.incidentLocation || 'Local Ward'} | Saved: {new Date(log.createdAt).toLocaleString('en-IN')}
                      </small>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}>
                        <Lock size={12} color={isValid ? '#22c55e' : '#ef4444'} />
                        <span style={{ color: isValid ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                          {isValid ? 'Verified SHA-256 Digital Seal' : 'Warning: Tampered Record'}
                        </span>
                        <code style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          ({String(log.digitalSeal).slice(0, 12)}...)
                        </code>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleExportText(log)}
                        title="Download formatted Rule 7 memorandum"
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
                        Text Notice
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExportJson(log)}
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
                        onClick={() => handleDeleteLog(log.id)}
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
