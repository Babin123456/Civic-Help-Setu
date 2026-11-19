import { useState } from 'react';
import {
  Recycle,
  Scale,
  Building2,
  HardHat,
  FileText,
  FileCheck2,
  FolderLock,
  Download,
  Trash2,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import BulkWasteGeneratorCard from '../components/solidWaste/BulkWasteGeneratorCard.jsx';
import VolumetricNgtCalculator from '../components/solidWaste/VolumetricNgtCalculator.jsx';
import CdWasteTrackerCard from '../components/solidWaste/CdWasteTrackerCard.jsx';
import SolidWasteNoticeDrafter from '../components/solidWaste/SolidWasteNoticeDrafter.jsx';
import SolidWasteEvidenceChecklist from '../components/solidWaste/SolidWasteEvidenceChecklist.jsx';
import {
  saveSolidWasteAudit,
  listSolidWasteAudits,
  deleteSolidWasteAudit,
  verifyAuditIntegrity,
  exportAuditDossierJson,
  exportAuditTextSlip,
} from '../services/solidWasteStorage.js';

export default function SolidWasteAuditWorkspace() {
  const [activeTab, setActiveTab] = useState('bwg-audit');
  const [notification, setNotification] = useState(null);

  const [calculationData, setCalculationData] = useState({
    dumpVolumeCuM: 750,
    estimatedTonnage: 337.5,
    estimatedRemediationCostInr: 185625,
    defaultDays: 45,
    finalEnvironmentalCompensationInr: 1080000,
    activeBurningObserved: true,
  });

  const [checklistState, setChecklistState] = useState({
    geotagged_photos: true,
    gps_coordinate_proof: true,
    municipal_grievance_ack: true,
    burning_or_smoke_evidence: false,
    leachate_or_drain_ingress: false,
    rwa_resolution_copy: false,
  });

  const [savedAudits, setSavedAudits] = useState(() => listSolidWasteAudits());

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleToggleChecklistItem = (itemId) => {
    setChecklistState((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleSaveAuditRecord = (auditPayload) => {
    try {
      const saved = saveSolidWasteAudit({
        ...auditPayload,
        evidenceChecklist: checklistState,
      });
      setSavedAudits(listSolidWasteAudits());
      showNotification(`Audit dossier sealed with SHA-256 and saved (${saved.id.slice(0, 10)}...)`);
    } catch (err) {
      showNotification(`Failed to save audit: ${err.message}`, 'error');
    }
  };

  const handleDeleteAudit = (id) => {
    const success = deleteSolidWasteAudit(id);
    if (success) {
      setSavedAudits(listSolidWasteAudits());
      showNotification('Audit removed from local vault.');
    }
  };

  const handleDownloadDossier = (audit) => {
    const json = exportAuditDossierJson(audit);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Solid_Waste_Dossier_${audit.id || 'export'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSlip = (audit) => {
    const text = exportAuditTextSlip(audit);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Solid_Waste_Notice_${audit.id || 'export'}.txt`;
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
            background: notification.type === 'error' ? '#ef4444' : '#10b981',
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
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(6, 78, 59, 0.85))',
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
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#10b981',
              display: 'flex',
            }}
          >
            <Recycle size={32} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--text-primary, #f8fafc)', fontWeight: 800 }}>
              Municipal Solid Waste Dumping &amp; NGT Compensation Workspace
            </h1>
            <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-secondary, #94a3b8)', fontSize: '0.95rem' }}>
              Bulk Waste Generator compliance audits, CPCB volumetric tonnage estimators, and NGT environmental escalation drafters
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
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            SWM Rules 2016: 100 kg/day &amp; 5,000 sq.m BWG Mandate
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
            NGT O.A. 606/2018: EC = PI &times; N &times; R &times; S &times; LF
          </span>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '0.3rem 0.75rem',
              borderRadius: '999px',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            C&amp;D Rules 2016: 4-Stream Debris Segregation
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
            Rule 15/16 Municipal Notice &amp; NGT Section 14 Application
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div
        role="tablist"
        aria-label="Solid Waste Workspace Tabs"
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
          aria-selected={activeTab === 'bwg-audit'}
          onClick={() => setActiveTab('bwg-audit')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: activeTab === 'bwg-audit' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
            color: activeTab === 'bwg-audit' ? '#10b981' : 'var(--text-secondary, #94a3b8)',
            fontWeight: activeTab === 'bwg-audit' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <Building2 size={16} /> Bulk Waste Generator Audit
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'ngt-calculator'}
          onClick={() => setActiveTab('ngt-calculator')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: activeTab === 'ngt-calculator' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
            color: activeTab === 'ngt-calculator' ? '#f59e0b' : 'var(--text-secondary, #94a3b8)',
            fontWeight: activeTab === 'ngt-calculator' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <Scale size={16} /> Tonnage &amp; NGT Fine Estimator
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'cd-waste'}
          onClick={() => setActiveTab('cd-waste')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: activeTab === 'cd-waste' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            color: activeTab === 'cd-waste' ? '#38bdf8' : 'var(--text-secondary, #94a3b8)',
            fontWeight: activeTab === 'cd-waste' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <HardHat size={16} /> C&amp;D Waste Tracker
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'notice-drafter'}
          onClick={() => setActiveTab('notice-drafter')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: activeTab === 'notice-drafter' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
            color: activeTab === 'notice-drafter' ? '#a855f7' : 'var(--text-secondary, #94a3b8)',
            fontWeight: activeTab === 'notice-drafter' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <FileText size={16} /> Statutory Notice Drafter
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'checklist'}
          onClick={() => setActiveTab('checklist')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: activeTab === 'checklist' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
            color: activeTab === 'checklist' ? '#22c55e' : 'var(--text-secondary, #94a3b8)',
            fontWeight: activeTab === 'checklist' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <FileCheck2 size={16} /> Evidentiary Checklist
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'vault'}
          onClick={() => setActiveTab('vault')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: activeTab === 'vault' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            color: activeTab === 'vault' ? 'var(--text-primary, #f8fafc)' : 'var(--text-secondary, #94a3b8)',
            fontWeight: activeTab === 'vault' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <FolderLock size={16} /> Saved Audits Vault ({savedAudits.length})
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'bwg-audit' && <BulkWasteGeneratorCard />}

      {activeTab === 'ngt-calculator' && (
        <VolumetricNgtCalculator onCalculationChange={setCalculationData} />
      )}

      {activeTab === 'cd-waste' && <CdWasteTrackerCard />}

      {activeTab === 'notice-drafter' && (
        <SolidWasteNoticeDrafter
          calculationData={calculationData}
          onSaveNotice={handleSaveAuditRecord}
        />
      )}

      {activeTab === 'checklist' && (
        <SolidWasteEvidenceChecklist
          checklistState={checklistState}
          onToggleItem={handleToggleChecklistItem}
        />
      )}

      {activeTab === 'vault' && (
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
            All solid waste audits and NGT representations are stored in local browser storage (<code style={{ color: '#10b981' }}>civicbridge_solid_waste_audits</code>) with cryptographic SHA-256 digital seals.
          </p>

          {savedAudits.length === 0 ? (
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
              No audits saved in this browser yet. Use the Statutory Notice Drafter tab to generate and seal your case.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {savedAudits.map((item) => {
                const isIntegrityValid = verifyAuditIntegrity(item);
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
                          {item.location?.address || 'Untitled Location'}
                        </strong>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '0.15rem 0.4rem',
                            borderRadius: '0.25rem',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                          }}
                        >
                          {item.location?.city || 'Local Area'} - {item.auditType || 'Rule 15 Notice'}
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
                        Complainant: {item.complainant?.name || 'N/A'} | Tonnage: {item.calculation?.estimatedTonnage || 0} MT | Compensation: Rs. {Number(item.calculation?.finalEnvironmentalCompensationInr || 0).toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '0.2rem', fontFamily: 'monospace' }}>
                        SHA-256: {item.digest ? `${item.digest.slice(0, 16)}...${item.digest.slice(-8)}` : 'N/A'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                        <Download size={13} /> Text Notice
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAudit(item.id)}
                        className="btn btn-secondary"
                        style={{ color: '#ef4444', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                        aria-label="Delete audit"
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
        <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>Statutory Authority:</strong> Formulated in compliance with the <em>Solid Waste Management Rules, 2016 (S.O. 1357(E))</em>, the <em>Construction &amp; Demolition Waste Management Rules, 2016 (G.S.R. 317(E))</em>, CPCB Environmental Compensation Guidelines, and binding judgments of the National Green Tribunal in <em>Almitra H. Patel v. Union of India</em> and <em>O.A. No. 606/2018</em>.
      </div>
    </div>
  );
}
