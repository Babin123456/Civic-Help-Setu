import { useState } from 'react';
import { X, PlusCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import {
  CREDENTIAL_SCHEMA_TYPES,
  CREDENTIAL_SCHEMA_DEFINITIONS,
  TRUST_TIERS
} from '../../data/walletContracts';

export default function CredentialImportModal({
  onClose,
  onAddCredential,
  onResetSeeds
}) {
  const [schemaType, setSchemaType] = useState(CREDENTIAL_SCHEMA_TYPES.RESIDENCE_PROOF);
  const [title, setTitle] = useState('');
  const [claims, setClaims] = useState({});

  const schemaDef = CREDENTIAL_SCHEMA_DEFINITIONS[schemaType] || CREDENTIAL_SCHEMA_DEFINITIONS[CREDENTIAL_SCHEMA_TYPES.RESIDENCE_PROOF];

  const handleFieldChange = (key, val, type) => {
    let processedVal = val;
    if (type === 'boolean') {
      processedVal = val === 'true';
    } else if (type === 'number') {
      processedVal = Number(val) || 0;
    }
    setClaims((prev) => ({ ...prev, [key]: processedVal }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const id = `cred_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newCred = {
      id,
      schemaType,
      title: title.trim() || schemaDef.title,
      trustTier: TRUST_TIERS.SELF_ASSERTED,
      issuer: {
        id: 'issuer:citizen:self',
        name: 'Citizen Self-Declared Wallet',
        disclaimer: 'Self-asserted citizen record.'
      },
      createdAt: new Date().toISOString(),
      claims: { ...claims }
    };

    onAddCredential(newCred);
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-credential-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1000
      }}
    >
      <div
        className="modal-content"
        style={{
          background: 'var(--bg-card, #ffffff)',
          color: 'var(--text-primary)',
          borderRadius: '1rem',
          maxWidth: '540px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-light, #e2e8f0)',
          padding: '1.5rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 id="import-credential-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              Add / Declare Civic Credential
            </h2>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Self-asserted local record in your encrypted wallet
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            aria-label="Close dialog"
            style={{ padding: '0.35rem' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="schema-type-select" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Credential Schema Type
            </label>
            <select
              id="schema-type-select"
              value={schemaType}
              onChange={(e) => {
                setSchemaType(e.target.value);
                setClaims({});
              }}
              className="form-control"
              style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', fontSize: '0.9rem' }}
            >
              {Object.values(CREDENTIAL_SCHEMA_DEFINITIONS).map((def) => (
                <option key={def.id} value={def.id}>
                  {def.title} ({def.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="cred-title-input" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Credential Label / Title
            </label>
            <input
              id="cred-title-input"
              type="text"
              placeholder={schemaDef.title}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-control"
              style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', fontSize: '0.9rem' }}
            />
          </div>

          {/* Form attributes based on schema */}
          <div
            style={{
              background: 'var(--bg-secondary, #f8fafc)',
              borderRadius: '0.5rem',
              padding: '0.85rem',
              border: '1px solid var(--border-light, #e2e8f0)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem'
            }}
          >
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Schema Fields for {schemaDef.title}:
            </span>
            {schemaDef.attributes.map((attr) => (
              <div key={attr.key}>
                <label
                  htmlFor={`attr-input-${attr.key}`}
                  style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}
                >
                  {attr.label} {attr.sensitive ? '(Sensitive)' : ''}
                </label>
                {attr.type === 'boolean' ? (
                  <select
                    id={`attr-input-${attr.key}`}
                    value={claims[attr.key] !== undefined ? String(claims[attr.key]) : 'false'}
                    onChange={(e) => handleFieldChange(attr.key, e.target.value, 'boolean')}
                    className="form-control"
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '0.35rem', fontSize: '0.82rem' }}
                  >
                    <option value="false">No / False</option>
                    <option value="true">Yes / True</option>
                  </select>
                ) : (
                  <input
                    id={`attr-input-${attr.key}`}
                    type={attr.type === 'number' ? 'number' : 'text'}
                    placeholder={`Enter ${attr.label}`}
                    value={claims[attr.key] || ''}
                    onChange={(e) => handleFieldChange(attr.key, e.target.value, attr.type)}
                    className="form-control"
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '0.35rem', fontSize: '0.82rem' }}
                  />
                )}
              </div>
            ))}
          </div>

          <div
            role="note"
            style={{
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.25)',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)'
            }}
          >
            <AlertTriangle size={14} color="#ca8a04" style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
            Self-declared credentials are categorized as <code>SELF_ASSERTED</code> and cannot claim official government authority.
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => {
                onResetSeeds();
                onClose();
              }}
              className="btn btn-sm btn-outline"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}
            >
              <RotateCcw size={13} />
              Reset Demo Fixtures
            </button>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={onClose} className="btn btn-sm btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn btn-sm btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <PlusCircle size={14} />
                Save to Wallet
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
