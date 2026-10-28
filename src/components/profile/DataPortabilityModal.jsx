import React, { useState, useEffect } from 'react';
import {
  Download,
  FileJson,
  FileSpreadsheet,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  BookMarked,
  CheckSquare,
  Clock,
  FileText,
  Lock,
} from 'lucide-react';
import {
  generateExportPreview,
  buildCitizenDataExport,
  triggerDownload,
  EXPORT_SCHEMA_VERSION,
} from '../../services/dataPortabilityService';

const CATEGORY_ICONS = {
  saved_services: BookMarked,
  checklists: CheckSquare,
  reminders: Clock,
  notes: FileText,
};

const DataPortabilityModal = ({ isOpen, onClose, currentUser }) => {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [downloadSuccess, setDownloadSuccess] = useState('');

  useEffect(() => {
    if (isOpen && currentUser) {
      try {
        setError('');
        setDownloadSuccess('');
        const p = generateExportPreview(currentUser);
        setPreview(p);
      } catch (err) {
        setError(err.message || 'Failed to generate export preview.');
      }
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleDownloadJson = () => {
    try {
      const { jsonString } = buildCitizenDataExport(currentUser);
      const filename = `civicbridge-data-export-${new Date().toISOString().split('T')[0]}.json`;
      const ok = triggerDownload(jsonString, filename, 'application/json');
      if (ok) {
        setDownloadSuccess('Complete portable JSON archive downloaded successfully.');
      } else {
        setError('Unable to trigger browser download.');
      }
    } catch (err) {
      setError(err.message || 'Export generation failed.');
    }
  };

  const handleDownloadCsv = (categoryKey, filenamePrefix) => {
    try {
      const { csvExports } = buildCitizenDataExport(currentUser);
      const csvData = csvExports[categoryKey];
      if (!csvData) {
        setError(`No CSV data found for category: ${categoryKey}`);
        return;
      }
      const filename = `civicbridge-${filenamePrefix}-${new Date().toISOString().split('T')[0]}.csv`;
      const ok = triggerDownload(csvData, filename, 'text/csv');
      if (ok) {
        setDownloadSuccess(`${filenamePrefix} CSV table downloaded successfully.`);
      } else {
        setError('Unable to trigger browser download.');
      }
    } catch (err) {
      setError(err.message || 'Export generation failed.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="data-portability-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '1.25rem',
          background: 'var(--bg-card, #1e293b)',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '0.75rem',
                background: 'rgba(56, 189, 248, 0.15)',
                color: 'var(--accent-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Download size={22} />
            </div>
            <div>
              <h3 id="data-portability-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>
                Citizen Data Portability Export
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Download a complete, readable copy of your personal services, checklists, and application notes.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.4rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Security Exclusion Notice Banner */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            background: 'rgba(16, 185, 129, 0.08)',
            borderBottom: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-start',
            fontSize: '0.775rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.45,
          }}
        >
          <Lock size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: '#10b981' }}>Security & Privacy Boundary: </strong>
            Credentials, session tokens, passwords, and raw encrypted vault file binaries are excluded by design to prevent unauthorized data exposure.
          </div>
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {error && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                color: '#ef4444',
                fontSize: '0.85rem',
              }}
            >
              {error}
            </div>
          )}

          {downloadSuccess && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid #10b981',
                color: '#10b981',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{downloadSuccess}</span>
            </div>
          )}

          {/* User & Version Metadata Card */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '0.65rem',
              background: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.825rem',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div>
              <span style={{ color: 'var(--text-tertiary)' }}>Account ID: </span>
              <strong style={{ color: 'var(--text-primary)' }}>{preview?.userId}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-tertiary)' }}>Standard Schema: </span>
              <strong style={{ color: 'var(--accent-main)' }}>v{EXPORT_SCHEMA_VERSION}</strong>
            </div>
          </div>

          {/* Included Categories Preview */}
          <div>
            <h4 style={{ margin: '0 0 0.65rem', fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              Data Categories Included in Export ({preview?.totalRecords || 0} total records)
            </h4>

            {preview?.isEmpty ? (
              <div
                style={{
                  padding: '2rem 1rem',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '0.75rem',
                  border: '1px dashed var(--border-main)',
                  color: 'var(--text-secondary)',
                }}
              >
                <AlertCircle size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <div style={{ fontWeight: '600' }}>No saved personal data yet</div>
                <div style={{ fontSize: '0.775rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>
                  You currently have no saved services, checklists, or application reminders in your account.
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {preview?.categories.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat.id] || Layers;
                  return (
                    <div
                      key={cat.id}
                      style={{
                        padding: '0.85rem',
                        borderRadius: '0.65rem',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <Icon size={18} color="var(--accent-main)" />
                        <span style={{ fontSize: '0.825rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                          {cat.label}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: '800',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '99px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: 'var(--accent-main)',
                        }}
                      >
                        {cat.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Export Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              Choose Export Format
            </h4>

            {/* Complete JSON Download Button */}
            <button
              type="button"
              onClick={handleDownloadJson}
              disabled={preview?.isEmpty}
              className="btn btn-primary"
              style={{
                padding: '0.75rem 1.25rem',
                fontSize: '0.925rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.65rem',
                opacity: preview?.isEmpty ? 0.5 : 1,
                cursor: preview?.isEmpty ? 'not-allowed' : 'pointer',
              }}
            >
              <FileJson size={18} />
              <span>Download Complete Archive (.JSON)</span>
            </button>

            {/* Category CSV Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleDownloadCsv('savedServices', 'saved-services')}
                disabled={preview?.isEmpty || preview?.counts.saved_services === 0}
                className="btn btn-secondary"
                style={{
                  flex: '1 1 140px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.775rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                }}
              >
                <FileSpreadsheet size={14} /> Saved Services (.CSV)
              </button>

              <button
                type="button"
                onClick={() => handleDownloadCsv('checklists', 'checklists')}
                disabled={preview?.isEmpty || preview?.counts.checklists === 0}
                className="btn btn-secondary"
                style={{
                  flex: '1 1 140px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.775rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                }}
              >
                <FileSpreadsheet size={14} /> Checklists (.CSV)
              </button>

              <button
                type="button"
                onClick={() => handleDownloadCsv('reminders', 'reminders')}
                disabled={preview?.isEmpty || preview?.counts.reminders === 0}
                className="btn btn-secondary"
                style={{
                  flex: '1 1 140px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.775rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                }}
              >
                <FileSpreadsheet size={14} /> Reminders (.CSV)
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '0.45rem 1.25rem', fontSize: '0.85rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataPortabilityModal;
