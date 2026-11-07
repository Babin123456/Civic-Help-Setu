import React, { useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  Download,
  Trash2,
  CheckCircle2,
  Sliders,
  History,
  FileCheck,
  ChevronRight,
  BookOpen,
  EyeOff,
  ServerOff,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  CONSENT_CATEGORIES,
  getConsentPreferences,
  exportUserData,
  getPrivacyAuditLogs,
} from '../services/privacyConsentService.js';
import PrivacyConsentCenterModal from '../components/privacy/PrivacyConsentCenterModal';
import ClearMyDataPanel from '../components/privacy/ClearMyDataPanel';
import { useToast } from '../context/ToastContext';

const POLICY_SECTIONS = [
  { id: 'data-minimization', title: '1. Principles of Data Minimization' },
  { id: 'enforceable-consent', title: '2. Enforceable Consent Architecture' },
  { id: 'portability-erasure', title: '3. Data Portability & Complete Erasure' },
  { id: 'statutory-compliance', title: '4. Statutory DPDP Act 2023 Compliance' },
  { id: 'transparency-audit', title: '5. Transparency & Client Audit Trail' },
];

const Privacy = () => {
  const { toast } = useToast?.() || {};
  const [isCenterOpen, setIsCenterOpen] = useState(false);
  const [preferences, setPreferences] = useState(() => getConsentPreferences());
  const [logsCount, setLogsCount] = useState(() => getPrivacyAuditLogs().length);
  const [activeSection, setActiveSection] = useState('data-minimization');

  useEffect(() => {
    setPreferences(getConsentPreferences());
    setLogsCount(getPrivacyAuditLogs().length);
  }, [isCenterOpen]);

  const handleQuickExport = () => {
    try {
      const data = exportUserData();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(data, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute(
        'download',
        `civicbridge_user_data_export_${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      toast?.success?.('Personal data exported successfully.');
    } catch (err) {
      toast?.error?.(`Export failed: ${err.message}`);
    }
  };

  const scrollToSection = (id) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      element.focus?.();
    }
  };

  return (
    <div className="container max-w-5xl pt-8 pb-24 animate-fade-in" style={{ padding: '2rem 1.5rem' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--accent-main, #38bdf8)',
            fontSize: '0.875rem',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '0.5rem',
            background: 'rgba(56, 189, 248, 0.1)',
            padding: '0.35rem 0.85rem',
            borderRadius: '99px',
            border: '1px solid rgba(56, 189, 248, 0.2)',
          }}
        >
          <Shield size={16} /> DPDP Act 2023 &bull; Citizen-First Privacy
        </div>
        <h1 style={{ fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', fontWeight: '800', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
          Privacy, Consent &amp; Data Rights
        </h1>
        <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary, #94a3b8)', maxWidth: '680px', margin: '0 auto', lineHeight: '1.6' }}>
          Civic-Help-Setu is built on client-side sandboxing, zero server uploads, granular consent,
          and complete unencumbered data portability.
        </p>
      </div>

      {/* Interactive Privacy Action Hub */}
      <section
        className="glass-panel"
        aria-labelledby="privacy-settings-title"
        style={{
          padding: '1.75rem',
          borderRadius: '1rem',
          background: 'var(--card-bg, #121212)',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
          boxShadow: 'var(--shadow-md, 0 12px 32px rgba(0,0,0,0.6))',
          marginBottom: '2.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 id="privacy-settings-title" style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              Your Enforced Privacy Settings
            </h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary, #cbd5e1)' }}>
              Manage opt-in consent categories, download your JSON dossier, or inspect immutable audit logs ({logsCount} entries).
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setIsCenterOpen(true)}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.55rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: '700',
                borderRadius: '99px',
              }}
            >
              <Sliders size={16} />
              <span>Manage Consent Preferences</span>
            </button>

            <button
              type="button"
              onClick={handleQuickExport}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.55rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: '700',
                borderRadius: '99px',
              }}
            >
              <Download size={16} />
              <span>Export My Data (JSON)</span>
            </button>
          </div>
        </div>

        {/* Live Summary Chips */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
          }}
        >
          {Object.values(CONSENT_CATEGORIES).map((cat) => {
            const isGranted = !!preferences[cat.id];
            return (
              <div
                key={cat.id}
                style={{
                  padding: '0.625rem 0.875rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-main, rgba(255, 255, 255, 0.02))',
                  border: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.8rem',
                }}
              >
                <span style={{ fontWeight: '600', color: 'var(--text-secondary, #cbd5e1)' }}>
                  {cat.title}
                </span>
                <span
                  style={{
                    fontWeight: '800',
                    fontSize: '0.75rem',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '99px',
                    background: isGranted ? 'rgba(74, 222, 128, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                    color: isGranted ? '#4ade80' : 'var(--text-muted, #94a3b8)',
                  }}
                >
                  {isGranted ? 'Active' : 'Disabled'}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Main Two-Column Layout: Table of Contents & Policy Content */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '2.5rem',
          alignItems: 'start',
          marginBottom: '3rem',
        }}
      >
        {/* Sticky Table of Contents Sidebar */}
        <aside
          aria-label="Privacy policy navigation"
          className="glass-panel"
          style={{
            padding: '1.5rem',
            borderRadius: '1rem',
            border: '1px solid var(--border-light)',
            background: 'var(--card-bg, rgba(255, 255, 255, 0.03))',
            position: 'sticky',
            top: '2rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--accent-main)' }}>
            <BookOpen size={18} aria-hidden="true" />
            <h3 style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Policy Navigation
            </h3>
          </div>

          <nav>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {POLICY_SECTIONS.map((sec) => {
                const isCurrent = activeSection === sec.id;
                return (
                  <li key={sec.id}>
                    <button
                      type="button"
                      onClick={() => scrollToSection(sec.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.5rem',
                        background: isCurrent ? 'var(--accent-main)' : 'transparent',
                        color: isCurrent ? '#000000' : 'var(--text-secondary)',
                        fontWeight: isCurrent ? '700' : '500',
                        fontSize: '0.85rem',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>{sec.title}</span>
                      <ChevronRight size={14} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-light)',
              fontSize: '0.78rem',
              color: 'var(--text-muted, #94a3b8)',
              lineHeight: '1.5',
            }}
          >
            <div><strong>Zero Server Retention:</strong> No telemetry is tied to citizen identity.</div>
            <div style={{ marginTop: '0.4rem' }}><strong>Storage Scope:</strong> Local browser sandbox only.</div>
          </div>
        </aside>

        {/* Policy Body */}
        <main
          className="privacy-policy-body"
          style={{
            lineHeight: '1.7',
            color: 'var(--text-secondary, #cbd5e1)',
            maxWidth: '680px',
          }}
        >
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '1.5rem' }}>
            Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })} &bull; Statutory Reference: Digital Personal Data Protection Act, 2023 (India)
          </div>

          <section id="data-minimization" tabIndex="-1" style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              1. Principles of Data Minimization &amp; Client-Side Privacy
            </h2>
            <p>
              Civic-Help-Setu operates under a strict architecture of <strong>Zero-Knowledge Civic Tech</strong>.
              Core services do not mandate creating an account, entering an Aadhaar or PAN number, or uploading
              unencrypted identity files to cloud servers. All personal notes, saved service bookmarks, and document
              metadata remain stored exclusively within your local browser sandbox via encrypted web storage.
            </p>
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                flexWrap: 'wrap',
                marginTop: '1rem',
                fontSize: '0.82rem',
              }}
            >
              <span style={{ padding: '0.35rem 0.75rem', borderRadius: '0.5rem', background: 'var(--bg-main)', border: '1px solid var(--border-light)' }}>
                🔒 Masked Credential Storage
              </span>
              <span style={{ padding: '0.35rem 0.75rem', borderRadius: '0.5rem', background: 'var(--bg-main)', border: '1px solid var(--border-light)' }}>
                🚫 No Third-Party Ad Trackers
              </span>
            </div>
          </section>

          <section id="enforceable-consent" tabIndex="-1" style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              2. Enforceable Consent Architecture
            </h2>
            <p>
              Under our granular privacy center, each category of data processing is strictly isolated and controllable:
            </p>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem' }}>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Strictly Necessary Storage:</strong> Ensures persistent theme selection, language locale preferences, and session security tokens.
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Explainable Personalization:</strong> Evaluates your goal inputs and held documents to compute service relevance scores without leaking identity.
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Offline Cache Resilience:</strong> Caches official roadmaps and application stages so you can access government guidance during network outages.
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Assistant Conversational Memory:</strong> Local session memory for AI chat queries that can be purged with a single click.
              </li>
            </ul>
          </section>

          <section id="portability-erasure" tabIndex="-1" style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              3. Right to Data Portability &amp; Complete Erasure
            </h2>
            <p>
              You retain unencumbered ownership of all records created within Civic-Help-Setu. At any time, you may
              export your complete civic dossier as an interoperable JSON package or trigger an irreversible cascading
              account purge that deletes every stored key across your browser device.
            </p>
          </section>

          <section id="statutory-compliance" tabIndex="-1" style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              4. Statutory DPDP Act 2023 Compliance
            </h2>
            <p>
              In alignment with India&apos;s Digital Personal Data Protection Act, 2023 (DPDPA), the platform ensures:
            </p>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem' }}>
              <li style={{ marginBottom: '0.4rem' }}>Explicit, affirmative consent prior to caching personalized profile data.</li>
              <li style={{ marginBottom: '0.4rem' }}>Unconditional right to withdraw consent at any time without penalty.</li>
              <li style={{ marginBottom: '0.4rem' }}>Immediate cessation of data processing upon erasure request.</li>
              <li style={{ marginBottom: '0.4rem' }}>Transparent audit trails recording consent updates locally.</li>
            </ul>
          </section>

          <section id="transparency-audit" tabIndex="-1" style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              5. Transparency &amp; Client Audit Trail
            </h2>
            <p>
              Every time you grant or revoke a consent category, an append-only cryptographic event is timestamped in
              your browser audit log. These audit trails never leave your device unless you choose to export them for
              compliance or verification purposes.
            </p>
          </section>
        </main>
      </div>

      {/* Irreversible Purge Section */}
      <div style={{ marginBottom: '3rem' }}>
        <ClearMyDataPanel />
      </div>

      {/* Modal */}
      <PrivacyConsentCenterModal
        isOpen={isCenterOpen}
        onClose={() => setIsCenterOpen(false)}
      />
    </div>
  );
};

export default Privacy;
