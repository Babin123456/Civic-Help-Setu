import { useState } from 'react';
import {
  validateFile,
  validateDocumentForm,
  formatFileSize,
  ALLOWED_TYPES_HINT,
} from '../../services/vaultValidation';
import { X, Upload, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';

const CATEGORIES = ['Identity', 'Finance', 'Transport', 'Education', 'Welfare', 'Other'];

const DocumentModal = ({ isOpen, onClose, onSave, existingDocs = [] }) => {
  const [form, setForm] = useState({
    type: '',
    category: 'Identity',
    number: '',
    issuer: '',
    expiryDate: '',
    notes: '',
    fileName: '',
    fileSize: '',
    fileType: '',
    fileSizeBytes: 0,
    verified: false,
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [fileError, setFileError] = useState('');

  if (!isOpen) return null;

  const handleFilePick = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const result = validateFile(file);
    if (!result.valid) {
      setFileError(result.error);
      setForm((prev) => ({ ...prev, fileName: '', fileSize: '', fileType: '', fileSizeBytes: 0 }));
      e.target.value = '';
      return;
    }
    setFileError('');
    setForm((prev) => ({
      ...prev,
      fileName: file.name,
      fileSize: formatFileSize(file.size),
      fileSizeBytes: file.size,
      fileType: file.type,
      type: prev.type || file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const { valid, errors } = validateDocumentForm(form, existingDocs);
    setFieldErrors(errors);
    if (!valid || fileError) return;

    try {
      onSave({
        ...form,
        type: form.type.trim(),
        number: form.number.trim(),
        issuer: form.issuer.trim() || 'Government of India',
      });
    } catch (err) {
      setError(err.message || 'Could not save the document.');
      return;
    }
    onClose();
  };

  const fieldProps = (name) => ({
    id: `doc-${name}`,
    'aria-invalid': fieldErrors[name] ? 'true' : undefined,
    'aria-describedby':
      [name === 'number' ? 'doc-number-hint' : '', fieldErrors[name] ? `doc-${name}-error` : ''].filter(Boolean).join(' ') ||
      undefined,
  });

  const renderFieldError = (name) =>
    fieldErrors[name] ? (
      <p id={`doc-${name}-error`} role="alert" style={{ color: 'var(--error, #ef4444)', fontSize: '0.8rem', marginTop: '0.3rem' }}>
        {fieldErrors[name]}
      </p>
    ) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-doc-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--bg-main)',
          position: 'relative',
          padding: '2rem',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'var(--glass-bg)',
            border: 'none',
            color: 'var(--text-secondary)',
            padding: '0.5rem',
            borderRadius: '50%',
            cursor: 'pointer',
          }}
        >
          <X size={20} />
        </button>

        <div style={{ marginBottom: '1.5rem' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: '700',
              color: 'var(--accent-main)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            Digital Vault
          </span>
          <h2 id="add-doc-title" style={{ fontSize: '1.75rem', fontWeight: '800', marginTop: '0.25rem' }}>
            Add Civic Document
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Only the document details are saved, in this browser on this device. The file itself is not uploaded or stored.
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '0.5rem',
              color: 'var(--error, #ef4444)',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="doc-type" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Document Name / Type *
            </label>
            <input
              {...fieldProps('type')}
              type="text"
              placeholder="e.g. Passport, Voter ID, Ration Card"
              className="input-field"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              style={{ fontSize: '0.95rem', padding: '0.75rem 1rem' }}
            />
            {renderFieldError('type')}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Category
              </label>
              <select
                className="input-field"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                style={{ fontSize: '0.95rem', padding: '0.75rem 1rem', background: 'var(--glass-bg)' }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} style={{ background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="doc-number" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Document Number *
              </label>
              <input
              {...fieldProps('number')}
                type="text"
                  placeholder="e.g. Z1234567"
                className="input-field"
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
                style={{ fontSize: '0.95rem', padding: '0.75rem 1rem' }}
              />
            <p id="doc-number-hint" style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '0.35rem' }}>
              Only the last 4 characters are saved on this device.
            </p>
            {renderFieldError('number')}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label htmlFor="doc-issuer" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Issuing Authority
              </label>
              <input
              {...fieldProps('issuer')}
                type="text"
                placeholder="e.g. UIDAI, Passport Seva"
                className="input-field"
                value={form.issuer}
                onChange={(e) => setForm({ ...form, issuer: e.target.value })}
                style={{ fontSize: '0.95rem', padding: '0.75rem 1rem' }}
              />
            {renderFieldError('issuer')}
            </div>

            <div>
              <label htmlFor="doc-expiryDate" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Expiry Date (if applicable)
              </label>
              <input
              {...fieldProps('expiryDate')}
                type="date"
                className="input-field"
                value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                style={{ fontSize: '0.95rem', padding: '0.75rem 1rem' }}
              />
            {renderFieldError('expiryDate')}
            </div>
          </div>

          <div>
            <label htmlFor="doc-notes" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Notes or Remarks
            </label>
            <input
              {...fieldProps('notes')}
              type="text"
              placeholder="e.g. Renewed in Bangalore regional office"
              className="input-field"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              style={{ fontSize: '0.95rem', padding: '0.75rem 1rem' }}
            />
            {renderFieldError('notes')}
          </div>

          <div
            style={{
              padding: '1.25rem',
              border: '1px dashed var(--border-main)',
              borderRadius: '0.75rem',
              textAlign: 'center',
              background: 'var(--glass-bg-subtle)',
            }}
          >
            <Upload size={24} color="var(--accent-main)" style={{ margin: '0 auto 0.5rem' }} />
            <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600' }}>
              {form.fileName ? `Selected: ${form.fileName} (${form.fileSize})` : 'Attach Document Scan / PDF'}
            </p>
            <p id="doc-file-hint" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
              Allowed: {ALLOWED_TYPES_HINT}. Optional.
            </p>
            {fileError && (
              <p id="doc-file-error" role="alert" style={{ color: 'var(--error, #ef4444)', fontSize: '0.8rem', marginTop: '0.3rem' }}>
                {fileError}
              </p>
            )}
            <label
              style={{
                display: 'inline-block',
                marginTop: '0.5rem',
                fontSize: '0.8rem',
                color: 'var(--accent-main)',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Choose File
              <input
                type="file"
                onChange={handleFilePick}
                aria-invalid={fileError ? 'true' : undefined}
                aria-describedby={fileError ? 'doc-file-hint doc-file-error' : 'doc-file-hint'}
                accept=".pdf,.jpg,.jpeg,.png"
                style={{ display: 'none' }}
              />
            </label>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={form.verified}
              onChange={(e) => setForm({ ...form, verified: e.target.checked })}
            />
            <span>I have verified this document myself (self-declared, not checked by any authority)</span>
          </label>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '0.75rem', fontSize: '0.95rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1, padding: '0.75rem', fontSize: '0.95rem' }}
            >
              Save to Vault
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DocumentModal;
