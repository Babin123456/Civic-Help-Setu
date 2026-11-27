/**
 * National Civic Document Authenticity Check Guidance Hub
 * 
 * A guidance hub that identifies official verification routes for civic documents
 * without claiming to authenticate documents itself.
 * 
 * Safety & Privacy Principles:
 * 1. Zero Document Ingestion: Never upload, scan, or store full document contents.
 * 2. Allowlisted Verification Routes: Only official, source-reviewed URLs are included.
 * 3. QR Destination Preview: Decoded QR targets are shown; unsafe schemes are blocked.
 * 4. No Authenticity Claim: A valid QR code alone does not prove document authenticity.
 * 5. User-Controlled Data: Document numbers are never sent to third parties without explicit action.
 * 6. Suspicious-Link Reporting: Users can report questionable verification links.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  DOCUMENT_VERIFICATION_CATALOGUE,
  validateQrDestination,
  isAllowlistedUrl,
  categorizeDocumentId,
} from '../data/civicDocumentVerificationCatalogue';
import { INDIAN_STATES_AND_UTS } from '../data/jurisdictions';

const NationalCivicDocumentHub = () => {
  const [selectedState, setSelectedState] = useState('all');
  const [selectedDocumentId, setSelectedDocumentId] = useState('AADHAAR_UIDAI');
  const [qrData, setQrData] = useState('');
  const [qrValidation, setQrValidation] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportedUrl, setReportedUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load catalogue entry based on selected ID
  const selectedDocument = useMemo(() => {
    return DOCUMENT_VERIFICATION_CATALOGUE[selectedDocumentId];
  }, [selectedDocumentId]);

  // Filter catalogue by selected state
  const filteredEntries = useMemo(() => {
    return Object.values(DOCUMENT_VERIFICATION_CATALOGUE).filter(
      (entry) => entry.state === selectedState || entry.state === 'all'
    );
  }, [selectedState]);

  // Handle QR data input/change - preview and validate
  const handleQrChange = useCallback((value) => {
    setQrData(value);
    const validation = validateQrDestination(value);
    setQrValidation(validation);
  }, []);

  // Validate QR when data changes
  useEffect(() => {
    if (qrData) {
      const validation = validateQrDestination(qrData);
      setQrValidation(validation);
    }
  }, [qrData]);

  // Report suspicious link
  const handleReportSuspicious = useCallback((url) => {
    setReportedUrl(url);
    setShowReportModal(true);
  }, []);

  const closeReportModal = useCallback(() => {
    setShowReportModal(false);
    setReportedUrl('');
  }, []);

  const confirmReport = useCallback(() => {
    console.log('Suspicious link reported:', reportedUrl);
    setShowReportModal(false);
    setReportedUrl('');
    window.alert('Thank you for reporting this suspicious link. Our team will review it.');
  }, [reportedUrl]);

  useEffect(() => {
    const initialEntry = Object.values(DOCUMENT_VERIFICATION_CATALOGUE).find(
      (e) => e.id === selectedDocumentId
    );
    if (initialEntry) setSelectedDocumentId(initialEntry.id);
  }, [selectedDocumentId]);

  return (
    <section className="section" style={{ paddingTop: '1.5rem', paddingBottom: '3rem' }}>
      <div className="container">
        <dataFreshnessTrustBadge />

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            National Civic Document Authenticity Check Guidance Hub
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '600px' }}>
            Identify official verification routes for civic documents. Select your document type and state below to open verified verification portals.
            <br />
            <strong>Important:</strong> A valid QR code alone does not prove document authenticity. Always verify through official channels.
          </p>
        </div>

        {/* Selection Sidebar */}
        <div style={{ background: 'var(--glass-bg)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '1rem' }}>
            Select Document & State
          </h3>

          {/* Document Type Selector */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>
              Document Type:
            </label>
            <select
              value={selectedDocumentId}
              onChange={(e) => setSelectedDocumentId(e.target.value)}
              style={{
                width: '100%', padding: '0.6rem 1rem', fontSize: '0.9rem',
                borderRadius: '0.5rem', border: '1px solid var(--border-light)',
                background: 'var(--background-primary)', color: 'var(--text-primary)',
              }}
            >
              <option value="">-- Select Document Type --</option>
              {Object.values(DOCUMENT_VERIFICATION_CATALOGUE).map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.documentType} – {entry.issuer}
                </option>
              ))}
            </select>
          </div>

          {/* State Selector */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>
              State / Union Territory:
            </label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              style={{
                width: '100%', padding: '0.6rem 1rem', fontSize: '0.9rem',
                borderRadius: '0.5rem', border: '1px solid var(--border-light)',
                background: 'var(--background-primary)', color: 'var(--text-primary)',
              }}
            >
              <option value="all">All States / Union Territories</option>
              {INDIAN_STATES_AND_UTS.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Official Verification Route Card */}
          {selectedDocument && (
            <div style={{
              border: '1px solid var(--border-main)', borderRadius: '0.75rem',
              padding: '1.25rem', marginTop: '1rem', background: 'var(--background-primary)',
            }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--accent-main)', marginBottom: '0.75rem' }}>
                Official Verification Route
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                <a
                  href={selectedDocument.officialVerificationURL}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--accent-main)', textDecoration: 'underline' }}
                >
                  {selectedDocument.officialVerificationURL || 'No central verification portal available'}
                </a>
              </p>
              {selectedDocument.state === 'state_wise' && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                  Verification URL is state-specific. Select your state for portal-specific guidance.
                </p>
              )}
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                {selectedDocument.verificationMethod || 'Official portal verification'}
              </p>
            </div>
          )}

          {/* QR Code Section */}
          {selectedDocument && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px dashed var(--border-main)' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--accent-main)', marginBottom: '0.75rem' }}>
                QR / Barcode Instructions
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                {selectedDocument.qrInstructions}
              </p>

              {/* QR Preview Area */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '0.4rem' }}>
                  Enter QR code data (or paste QR-encoded URL):
                </label>
                <textarea
                  rows={3}
                  value={qrData || ''}
                  onChange={(e) => handleQrChange(e.target.value)}
                  style={{
                    width: '100%', padding: '0.6rem 1rem', fontSize: '0.85rem',
                    borderRadius: '0.5rem', border: '1px solid var(--border-light)',
                    background: 'var(--background-primary)', color: 'var(--text-primary)',
                    resize: 'vertical', height: '80px',
                  }}
                  placeholder="Paste QR-encoded data here..."
                  disabled={!isAllowlistedUrl(selectedDocument.officialVerificationURL || '')}
                />
              </div>

              {/* QR Validation Result */}
              {qrValidation && (
                <div style={{
                  padding: '0.75rem', borderRadius: '0.5rem',
                  marginTop: '0.75rem',
                  ...qrValidation.safe
                    ? { background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }
                    : { background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' },
                  color: qrValidation.safe ? 'var(--text-tertiary)' : 'var(--error-color, #ef4444)',
                  fontSize: '0.85rem',
                }}>
                  {qrValidation.safe ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: 'var(--success, #10b981)' }}>✓</span>
                      <span>{qrValidation.reason}</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: 'var(--error-color, #ef4444)' }}>✗</span>
                      <span>{qrValidation.reason}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Warning about QR authenticity */}
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '0.5rem', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <p style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: '500', marginBottom: '0.3rem' }}>
                  ⚠ Important Warning
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  A valid QR code alone does not prove document authenticity. QR codes can be replicated or altered.
                  Always cross-check decoded content with the official verification portal linked above.
                  <br />
                  <strong>Never</strong> scan QR codes from unsolicited messages or unknown sources.
                </p>
              </div>
            </div>
          )}

          {/* State-specific portals */}
          {selectedDocument && selectedDocument.state === 'state_wise' && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--background-primary)', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--accent-main)', marginBottom: '0.5rem' }}>
                {selectedDocument.documentType} – State-Specific Guidance
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Verification URL is state-specific. Consult your state\'s government portal for verification options.
              </p>
            </div>
          )}

          {/* No official verification service notice */}
          {!selectedDocument.officialVerificationURL && selectedDocument.state !== 'all' && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(100, 100, 100, 0.1)', borderRadius: '0.5rem', border: '1px solid rgba(100, 100, 100, 0.2)' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                No official verification service exists in the catalogue for this document type and state combination.
                <br />
                Contact the issuing authority directly or visit your state\'s government portal for verification options.
              </p>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {selectedDocument ? (
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '1rem' }}>
                Verification Guidance – {selectedDocument.documentType}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                {selectedDocument.description || 'Select a document type and state above to see official verification routes and guidance.'}
              </p>

              {/* Limitations Section */}
              {selectedDocument.limitations && (
                <div style={{
                  background: 'var(--background-primary)', border: '1px solid var(--border-main)',
                  borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1.5rem',
                }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--accent-main)', marginBottom: '0.5rem' }}>
                    Verification Limitations
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    {selectedDocument.limitations}
                  </p>
                </div>
              )}

              {/* Service cards for related guides */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill', gap: '1.5rem' }}>
                {filteredEntries.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      background: 'var(--background-primary)', border: '1px solid var(--border-main)',
                      borderRadius: '0.5rem', padding: '1rem',
                    }}
                  >
                    <strong>{entry.documentType}</strong>: {entry.issuer}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p>Select a document type and state from the sidebar to begin.</p>
              <p>This hub provides guidance on official verification routes only — it does not authenticate documents.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default NationalCivicDocumentHub;