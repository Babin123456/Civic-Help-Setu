import { useState, useEffect, useCallback } from 'react';
import StandardPageHeader from '../components/common/StandardPageHeader';
import ScenarioSelector from '../components/syntheticDataset/ScenarioSelector';
import GenerationProgressBar from '../components/syntheticDataset/GenerationProgressBar';
import PiiCertificationBadge from '../components/syntheticDataset/PiiCertificationBadge';
import DatasetInspectionTable from '../components/syntheticDataset/DatasetInspectionTable';
import LocalStorageLoaderModal from '../components/syntheticDataset/LocalStorageLoaderModal';
import SyntheticDatasetEmptyState from '../components/syntheticDataset/SyntheticDatasetEmptyState';
import {
  listProfiles,
  listArtifacts,
  getArtifactData,
  executeGenerationJob,
  exportArtifactContent,
  purgeExpiredArtifacts,
  isArtifactStale,
} from '../services/syntheticDatasetService';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import {
  Play,
  Download,
  UploadCloud,
  Trash2,
  AlertOctagon,
  AlertTriangle,
  Cpu,
} from 'lucide-react';

export default function SyntheticDatasetWorkspace() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();

  const [profiles] = useState(() => {
    try {
      return listProfiles();
    } catch {
      return [];
    }
  });
  const [selectedProfile, setSelectedProfile] = useState(() => {
    try {
      return listProfiles()[0] || null;
    } catch {
      return null;
    }
  });
  const [activeArtifactMeta, setActiveArtifactMeta] = useState(() => {
    try {
      const artifacts = listArtifacts();
      return artifacts.length > 0 ? artifacts[0] : null;
    } catch {
      return null;
    }
  });

  const [activeBundle, setActiveBundle] = useState(() => {
    try {
      const artifacts = listArtifacts();
      if (artifacts.length > 0) {
        return getArtifactData(artifacts[0].artifactId);
      }
      return null;
    } catch {
      return null;
    }
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState(null);
  const [showLoaderModal, setShowLoaderModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Background purge of expired artifacts
  useEffect(() => {
    try {
      purgeExpiredArtifacts();
    } catch (err) {
      console.warn('Artifact purge error:', err);
    }
  }, []);

  const handleSelectProfile = useCallback((profile) => {
    setSelectedProfile(profile);
    setError(null);
  }, []);

  const handleUpdateCustomProfile = useCallback((updated) => {
    setSelectedProfile(updated);
  }, []);

  const handleGenerate = async (profileToRun = null) => {
    const prof = profileToRun || selectedProfile;
    if (!prof) return;

    setIsGenerating(true);
    setProgressPercent(15);
    setError(null);

    try {
      // Simulate slight progress animation for visual and screen-reader accessibility
      const interval = setInterval(() => {
        setProgressPercent((prev) => (prev < 85 ? prev + 15 : prev));
      }, 120);

      const result = await executeGenerationJob(prof, null, user);
      clearInterval(interval);
      setProgressPercent(100);

      setActiveArtifactMeta(result.artifactMeta);
      setActiveBundle(result.bundle);

      setToastMessage(
        `Generated ${result.bundle.summary.grandTotalRecords} synthetic records with seed ${result.bundle.seed}`
      );
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Generation job failed:', err);
      setError(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = (format) => {
    if (!activeArtifactMeta) return;
    try {
      const exp = exportArtifactContent(activeArtifactMeta.artifactId, format);
      const blob = new Blob([exp.content], { type: exp.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exp.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      setError(err);
    }
  };

  const handleClearArtifact = () => {
    setActiveArtifactMeta(null);
    setActiveBundle(null);
  };

  return (
    <div className="section" style={{ minHeight: '80vh', paddingBottom: '3rem' }}>
      <div className="container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 1rem' }}>
        <StandardPageHeader
          title="Privacy-Safe Synthetic Civic Dataset Generator"
          subtitle="Generate reproducible, schema-aware service guides, citizen applications, and grievance records. Zero production PII, complete referential integrity, and one-click test loading."
          badgeText="Development & Testing"
        />

        {/* System & Offline Status banner if offline */}
        {!isOnline && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: '0.65rem 1rem',
              borderRadius: '0.5rem',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#92400e',
              fontSize: '0.82rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Cpu size={16} aria-hidden="true" />
            <span>
              <strong>Offline Mode Active:</strong> The synthetic generator operates entirely within your browser using deterministic Web PRNG. No server connectivity required.
            </span>
          </div>
        )}

        {/* Transient toast notification */}
        {toastMessage && (
          <div
            role="alert"
            style={{
              padding: '0.65rem 1rem',
              borderRadius: '0.5rem',
              background: '#059669',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '1rem',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            }}
          >
            {toastMessage}
          </div>
        )}

        {/* Error notification banner */}
        {error && (
          <div
            role="alert"
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '0.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#991b1b',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
            }}
          >
            <AlertOctagon size={18} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
            <div>
              <div style={{ fontWeight: 700 }}>Operation Error ({error.code || 'ERR_SYNTH_FAILED'})</div>
              <p style={{ margin: '0.2rem 0 0', lineHeight: 1.4 }}>{error.message}</p>
            </div>
          </div>
        )}

        {/* Step 1: Scenario & Seed Selection */}
        {selectedProfile && (
          <ScenarioSelector
            scenarios={profiles}
            selectedProfile={selectedProfile}
            onSelectProfile={handleSelectProfile}
            onUpdateCustomProfile={handleUpdateCustomProfile}
            disabled={isGenerating}
          />
        )}

        {/* Action Bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem',
            borderRadius: '0.65rem',
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-light, #cbd5e1)',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => handleGenerate()}
              disabled={isGenerating || !selectedProfile}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.88rem' }}
            >
              <Play size={16} aria-hidden="true" />
              {isGenerating ? 'Generating Records...' : 'Generate Synthetic Dataset'}
            </button>

            {activeArtifactMeta && (
              <button
                type="button"
                onClick={() => setShowLoaderModal(true)}
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.88rem' }}
              >
                <UploadCloud size={16} aria-hidden="true" />
                Load to Local Dev DB
              </button>
            )}
          </div>

          {activeArtifactMeta && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleExport('json')}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                aria-label="Download full dataset JSON"
              >
                <Download size={14} aria-hidden="true" /> JSON
              </button>

              <button
                type="button"
                onClick={() => handleExport('csv-applications')}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                aria-label="Download applications CSV"
              >
                <Download size={14} aria-hidden="true" /> Apps CSV
              </button>

              <button
                type="button"
                onClick={() => handleExport('sql')}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                aria-label="Download SQL inserts"
              >
                <Download size={14} aria-hidden="true" /> SQL
              </button>

              <button
                type="button"
                onClick={handleClearArtifact}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', color: '#991b1b' }}
                aria-label="Clear active view"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {/* Progress Bar during generation */}
        {isGenerating && (
          <GenerationProgressBar
            status={progressPercent < 80 ? 'generating' : 'validating'}
            progressPercent={progressPercent}
          />
        )}

        {/* Step 2: Certification Badge & Dataset Inspector */}
        {activeArtifactMeta && activeBundle ? (
          <div>
            {isArtifactStale(activeArtifactMeta) && (
              <div
                role="status"
                style={{
                  padding: '0.65rem 1rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: '#92400e',
                  fontSize: '0.82rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertTriangle size={16} aria-hidden="true" />
                <span>
                  <strong>Stale Schema Notice:</strong> This artifact was generated with schema version {activeArtifactMeta.schemaVersion || 'legacy'}, while the canonical catalog is currently v1.0.0.
                </span>
              </div>
            )}
            <PiiCertificationBadge artifactMeta={activeArtifactMeta} />
            <DatasetInspectionTable bundle={activeBundle} />
          </div>
        ) : (
          !isGenerating && (
            <SyntheticDatasetEmptyState
              onLaunchPreset={(presetId) => {
                const found = profiles.find((p) => p.profileId === presetId);
                if (found) {
                  setSelectedProfile(found);
                  handleGenerate(found);
                }
              }}
            />
          )
        )}

        {/* Local Storage Injector Modal */}
        {activeArtifactMeta && activeBundle && (
          <LocalStorageLoaderModal
            artifactId={activeArtifactMeta.artifactId}
            bundle={activeBundle}
            isOpen={showLoaderModal}
            onClose={() => setShowLoaderModal(false)}
            onSuccess={(res) => {
              setToastMessage(`Loaded ${res.loadedServicesCount} services into local catalog.`);
            }}
          />
        )}
      </div>
    </div>
  );
}
