/**
 * src/pages/JurisdictionHandoffWorkspace.jsx
 * Dedicated workspace for resolving jurisdiction hand-offs for services spanning multiple authorities (#815).
 *
 * Citizen & Administrator Journey:
 *  - Resolves Ward, Municipal, District, State, and Central administrative boundaries.
 *  - Pairs interactive SVG responsibility map with stage-to-authority hand-off graph.
 *  - Distinguishes saved workspace progress from official government application status.
 *  - Provides accessible text-only alternative and complete keyboard navigation.
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  Bookmark,
  ExternalLink,
  ShieldAlert,
  FileText,
} from 'lucide-react';

import { useToast } from '../context/ToastContext';
import JurisdictionMap from '../components/jurisdiction/JurisdictionMap';
import TextOnlyHandOff from '../components/jurisdiction/TextOnlyHandOff';
import { SAMPLE_SERVICES } from '../data/jurisdictionTestData';
import {
  saveJurisdictionDraft,
  getJurisdictionDraft,
  clearJurisdictionDraft,
} from '../services/jurisdictionHandoffService';
import { getJurisdictionSourceInfo } from '../data/jurisdictionBoundaries';

export default function JurisdictionHandoffWorkspace() {
  const { id: paramServiceId } = useParams();
  const [searchParams] = useSearchParams();

  const queryServiceId = searchParams.get('service') || searchParams.get('serviceId');
  const queryLocality = searchParams.get('locality') || '';
  const queryState = searchParams.get('state') || 'All';

  const defaultServiceId = paramServiceId || queryServiceId || SAMPLE_SERVICES[0]?.id || 'birth-certificate';

  const [selectedServiceId, setSelectedServiceId] = useState(defaultServiceId);
  const [locality, setLocality] = useState(queryLocality);
  const [selectedState, setSelectedState] = useState(queryState);
  const [isTextOnlyView, setIsTextOnlyView] = useState(false);
  const [inspectingAuthority, setInspectingAuthority] = useState(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);

  const toastContext = useToast();
  const toast = toastContext?.toast;
  const showToast = toastContext?.showToast;

  const sourceInfo = useMemo(() => getJurisdictionSourceInfo(), []);

  // Selected service object from catalogue
  const selectedService = useMemo(() => {
    return SAMPLE_SERVICES.find((s) => s.id === selectedServiceId) || SAMPLE_SERVICES[0];
  }, [selectedServiceId]);

  // Check for saved local draft on mount
  useEffect(() => {
    const draft = getJurisdictionDraft();
    if (draft && (draft.serviceId || draft.locality)) {
      setHasDraft(true);
      setDraftSavedAt(draft.savedAt);
    }
  }, []);

  // Restore saved draft
  const handleResumeDraft = () => {
    const draft = getJurisdictionDraft();
    if (!draft) return;

    if (draft.serviceId) setSelectedServiceId(draft.serviceId);
    if (draft.locality) setLocality(draft.locality);
    if (draft.state) setSelectedState(draft.state);

    const msg = 'Restored your saved non-sensitive progress.';
    if (toast?.info) toast.info(msg, 'Draft Resumed');
    else if (showToast) showToast(msg, 'info', 'Draft Resumed');
  };

  // Save current progress
  const handleSaveProgress = () => {
    const ok = saveJurisdictionDraft({
      serviceId: selectedServiceId,
      locality,
      state: selectedState,
      isConfirmed: false,
    });

    if (ok) {
      setHasDraft(true);
      setDraftSavedAt(new Date().toISOString());
      const msg = 'Progress saved privately in your browser session.';
      if (toast?.success) toast.success(msg, 'Progress Saved');
      else if (showToast) showToast(msg, 'success', 'Progress Saved');
    }
  };

  // Discard saved draft
  const handleDiscardDraft = () => {
    clearJurisdictionDraft();
    setHasDraft(false);
    setDraftSavedAt(null);
    const msg = 'Saved progress discarded.';
    if (toast?.info) toast.info(msg, 'Draft Cleared');
    else if (showToast) showToast(msg, 'info', 'Draft Cleared');
  };

  return (
    <div className="section container" style={{ minHeight: '750px', paddingBottom: '3rem' }}>
      {/* Distinction & Legal Guardrail Banner */}
      <div
        role="alert"
        aria-label="Official Status Disclaimer"
        style={{
          background: 'rgba(30, 64, 175, 0.08)',
          border: '1px solid var(--accent-main)',
          borderRadius: '0.75rem',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
        }}
      >
        <ShieldAlert size={22} color="var(--accent-main)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1, fontSize: '0.875rem' }}>
          <strong style={{ color: 'var(--text-primary)' }}>
            Workspace Planning Mode (Not an Official Government Application)
          </strong>
          <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            This map resolves illustrative administrative responsibility across Central, State, District, Municipal, and Ward
            authorities. Saved inputs reflect your personal preparatory research and do <strong>not</strong> create, submit,
            or alter an official government application or statutory timeline.
          </p>
        </div>
      </div>

      {/* Draft Resume Alert */}
      {hasDraft && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid #10b981',
            borderRadius: '0.75rem',
            padding: '0.85rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <Bookmark size={18} color="#10b981" />
            <span>
              You have saved research progress from {draftSavedAt ? new Date(draftSavedAt).toLocaleTimeString() : 'earlier'}.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleResumeDraft}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                borderRadius: '0.375rem',
                background: '#10b981',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Resume Saved Inputs
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                borderRadius: '0.375rem',
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-light)',
                cursor: 'pointer',
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Main Header & Controls */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--accent-main)',
                fontWeight: 700,
              }}
            >
              Multi-Authority Architecture #815
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', margin: '0.25rem 0 0 0', fontWeight: 800 }}>
            Jurisdiction Hand-Off Map &amp; Authority Navigator
          </h1>
          <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Identify responsible authorities across stages, office contact points, official portals, and escalation ladders.
          </p>
        </div>

        {/* Global Toolbar Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setIsTextOnlyView((prev) => !prev)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.85rem',
              fontSize: '0.8rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-main)',
              background: isTextOnlyView ? 'var(--accent-main)' : 'var(--bg-card)',
              color: isTextOnlyView ? '#fff' : 'var(--text-primary)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
            aria-label="Toggle Accessible Text-Only View"
          >
            <FileText size={16} />
            {isTextOnlyView ? 'Show Interactive Map' : 'Accessible Text-Only View'}
          </button>

          <button
            type="button"
            onClick={handleSaveProgress}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.85rem',
              fontSize: '0.8rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--accent-main)',
              background: 'rgba(30, 64, 175, 0.1)',
              color: 'var(--accent-main)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
            aria-label="Save current progress"
          >
            <Bookmark size={16} />
            Save Progress
          </button>
        </div>
      </header>

      {/* Service Selector Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '1rem 1.25rem',
          borderRadius: '0.75rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <label htmlFor="workspace-service-picker" style={{ fontWeight: 600, fontSize: '0.875rem' }}>
          Select Multi-Authority Service:
        </label>
        <select
          id="workspace-service-picker"
          value={selectedServiceId}
          onChange={(e) => setSelectedServiceId(e.target.value)}
          style={{
            flex: 1,
            minWidth: '220px',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-main)',
            background: 'var(--bg-main)',
            color: 'var(--text-primary)',
            fontSize: '0.875rem',
          }}
          aria-label="Select Civic Service"
        >
          {SAMPLE_SERVICES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.category} • {s.jurisdiction?.level?.toUpperCase() || 'MULTI'} Level)
            </option>
          ))}
        </select>
        <Link
          to={`/services/${selectedServiceId}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.8rem',
            color: 'var(--accent-main)',
            textDecoration: 'none',
          }}
        >
          View Full Catalogue Entry <ExternalLink size={14} />
        </Link>
      </div>

      {/* Visual Map or Text-Only Alternative */}
      {isTextOnlyView ? (
        <TextOnlyHandOff
          service={selectedService}
          locality={locality}
          state={selectedState}
          onClose={() => setIsTextOnlyView(false)}
        />
      ) : (
        <JurisdictionMap
          service={selectedService}
          initialLocality={locality}
          initialState={selectedState}
          onAuthoritySelect={(auth) => setInspectingAuthority(auth)}
        />
      )}

      {/* Workspace Data Provenance Footer */}
      <footer style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
        <p>Maintained Registry: {sourceInfo.dataSource} (v{sourceInfo.version}, updated {sourceInfo.lastUpdated}) | Deterministic Boundaries</p>
      </footer>

      {/* Inspecting Authority Modal / Drawer */}
      {inspectingAuthority && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="authority-detail-heading"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '540px',
              width: '100%',
              padding: '1.75rem',
              borderRadius: '0.75rem',
              background: 'var(--bg-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    color: 'var(--accent-main)',
                    fontWeight: 700,
                  }}
                >
                  {inspectingAuthority.level?.toUpperCase()} AUTHORITY
                </span>
                <h3 id="authority-detail-heading" style={{ margin: '0.25rem 0 0 0', fontSize: '1.2rem' }}>
                  {inspectingAuthority.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingAuthority(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                }}
                aria-label="Close authority details"
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              {inspectingAuthority.description || 'Statutory authority responsible for processing this journey stage.'}
            </p>

            <dl style={{ display: 'grid', gap: '0.75rem', fontSize: '0.875rem' }}>
              <div>
                <dt style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>Direct Office Contact</dt>
                <dd style={{ fontWeight: 500, margin: '0.2rem 0 0 0' }}>{inspectingAuthority.contact || 'Helpdesk available at local office'}</dd>
              </div>
              <div>
                <dt style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>Official Authority Portal</dt>
                <dd style={{ margin: '0.2rem 0 0 0' }}>
                  {inspectingAuthority.portal ? (
                    <a href={inspectingAuthority.portal} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-main)' }}>
                      {inspectingAuthority.portal} <ExternalLink size={12} style={{ display: 'inline' }} />
                    </a>
                  ) : (
                    'Portal link unavailable'
                  )}
                </dd>
              </div>
              <div>
                <dt style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>Escalation &amp; Grievance Path</dt>
                <dd style={{ fontWeight: 500, margin: '0.2rem 0 0 0' }}>{inspectingAuthority.escalation || 'District Appellate Officer'}</dd>
              </div>
              <div>
                <dt style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>Statutory Provenance</dt>
                <dd style={{ color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>{inspectingAuthority.source || 'Maintained Jurisdiction Registry'}</dd>
              </div>
            </dl>

            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setInspectingAuthority(null)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  background: 'var(--accent-main)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
