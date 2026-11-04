import { useState } from 'react';
import { ShieldCheck, Upload, AlertCircle, FileCheck, Check } from 'lucide-react';
import {
  DOCUMENT_TYPES,
  validateAadhaar,
  validatePan,
  validatePassport,
  validateVoterId,
  validateDrivingLicense,
  inspectDocumentFile,
  generatePreflightAudit,
  validatePreflightFile,
  STANDARD_PORTAL_LIMITS
} from '../../services/documentValidatorService';
import PreflightAuditModal from './PreflightAuditModal';

export default function DocumentPreflightChecker({ onAuditComplete }) {
  const [docType, setDocType] = useState(DOCUMENT_TYPES.AADHAAR);
  const [identifier, setIdentifier] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [activeAudit, setActiveAudit] = useState(null);
  const [validationResult, setValidationResult] = useState(null);

  const handleIdentifierChange = (e) => {
    const val = e.target.value;
    setIdentifier(val);

    if (!val.trim()) {
      setValidationResult(null);
      return;
    }

    let res = null;
    if (docType === DOCUMENT_TYPES.AADHAAR) {
      res = validateAadhaar(val);
    } else if (docType === DOCUMENT_TYPES.PAN) {
      res = validatePan(val);
    } else if (docType === DOCUMENT_TYPES.PASSPORT) {
      res = validatePassport(val);
    } else if (docType === DOCUMENT_TYPES.VOTER_ID) {
      res = validateVoterId(val);
    } else if (docType === DOCUMENT_TYPES.DRIVING_LICENSE) {
      res = validateDrivingLicense(val);
    }
    setValidationResult(res);
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const validation = validatePreflightFile(file);
    if (!validation.valid) {
      setFileError(validation.error);
      setSelectedFile(null);
      e.target.value = '';
      return;
    }

    setFileError('');
    setSelectedFile(file);
  };

  const handleRunFullAudit = (e) => {
    e.preventDefault();
    if (fileError) return;
    const docData = {
      title: `${docType.replace('_', ' ')} Pre-flight`,
      type: docType,
      identifier,
      expiryDate: expiryDate || null,
      file: selectedFile
    };

    const audit = generatePreflightAudit(docData);
    setActiveAudit(audit);
    if (onAuditComplete) {
      onAuditComplete(audit);
    }
  };

  return (
    <div
      style={{
        background: 'var(--card-bg, #ffffff)',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        padding: '20px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '8px', color: '#2563eb' }}>
          <ShieldCheck size={22} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
            Document Pre-flight Readiness Inspector
          </h3>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
            Check checksums, masking rules, and government portal file constraints before submitting.
          </p>
        </div>
      </div>

      <form onSubmit={handleRunFullAudit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {/* Doc Type Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
              Document Category
            </label>
            <select
              value={docType}
              onChange={(e) => {
                setDocType(e.target.value);
                setIdentifier('');
                setValidationResult(null);
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.88rem',
                background: '#fff'
              }}
            >
              <option value={DOCUMENT_TYPES.AADHAAR}>Aadhaar Card (UIDAI)</option>
              <option value={DOCUMENT_TYPES.PAN}>PAN Card (Income Tax)</option>
              <option value={DOCUMENT_TYPES.PASSPORT}>Indian Passport</option>
              <option value={DOCUMENT_TYPES.VOTER_ID}>Voter ID Card (EPIC)</option>
              <option value={DOCUMENT_TYPES.DRIVING_LICENSE}>Driving License (Sarathi)</option>
            </select>
          </div>

          {/* Identifier Input */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
              Document / Certificate Number
            </label>
            <input
              type="text"
              placeholder={
                docType === DOCUMENT_TYPES.AADHAAR
                  ? 'e.g. 2345 6789 0120'
                  : docType === DOCUMENT_TYPES.PAN
                  ? 'e.g. ABCDE1234F'
                  : 'Enter registration number'
              }
              value={identifier}
              onChange={handleIdentifierChange}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: validationResult
                  ? validationResult.valid
                    ? '1px solid #16a34a'
                    : '1px solid #dc2626'
                  : '1px solid #cbd5e1',
                fontSize: '0.88rem'
              }}
            />
            {validationResult && (
              <div
                style={{
                  fontSize: '0.76rem',
                  marginTop: '4px',
                  color: validationResult.valid ? '#16a34a' : '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {validationResult.valid ? <Check size={12} /> : <AlertCircle size={12} />}
                {validationResult.message}
              </div>
            )}
          </div>

          {/* Expiry Date */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
              Validity / Expiry Date (Optional)
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.88rem'
              }}
            />
          </div>
        </div>

        {/* File upload inspection dropzone */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                background: '#f1f5f9',
                borderRadius: '8px',
                border: fileError ? '1px dashed #dc2626' : '1px dashed #94a3b8',
                cursor: 'pointer',
                fontSize: '0.84rem',
                color: '#334155',
                fontWeight: 500
              }}
            >
              <Upload size={16} />
              <span>{selectedFile ? selectedFile.name : 'Attach Document File'}</span>
              <input
                type="file"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                accept=".pdf,.jpg,.jpeg,.png"
                aria-invalid={fileError ? 'true' : undefined}
                aria-describedby={fileError ? 'preflight-file-hint preflight-file-error' : 'preflight-file-hint'}
              />
            </label>

            <button
              type="submit"
              disabled={Boolean(fileError)}
              style={{
                padding: '9px 18px',
                background: '#2563eb',
                color: '#ffffff',
                borderRadius: '8px',
                border: 'none',
                cursor: fileError ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: fileError ? 0.6 : 1
              }}
            >
              <FileCheck size={16} />
              Run Pre-flight Audit
            </button>
          </div>

          <p id="preflight-file-hint" style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
            Allowed formats: {STANDARD_PORTAL_LIMITS.ALLOWED_TYPES_HINT}.
          </p>

          {fileError && (
            <p id="preflight-file-error" role="alert" style={{ margin: 0, color: '#dc2626', fontSize: '0.8rem', fontWeight: 500 }}>
              {fileError}
            </p>
          )}
        </div>
      </form>

      {activeAudit && (
        <PreflightAuditModal audit={activeAudit} onClose={() => setActiveAudit(null)} />
      )}
    </div>
  );
}
