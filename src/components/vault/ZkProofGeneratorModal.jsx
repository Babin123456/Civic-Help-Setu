import { useState, useId } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  Download,
  X,
  FileCheck,
  Info,
  Lock,
} from 'lucide-react';
import qrcode from 'qrcode-generator';
import {
  PREDEFINED_POLICIES,
  createPolicyChallenge,
} from '../../services/zkVerifierPolicyService';
import { issueCredentialForPersona } from '../../services/zkCredentialIssuerService';
import { generateAttributeProof } from '../../services/zkAttributeProofService';
import {
  ZK_PROTOTYPE_DISCLAIMER,
  SYNTHETIC_TEST_PERSONAS,
} from '../../data/zkProofContracts';

/**
 * Generates an SVG path string for a QR code of given data.
 */
function renderQrSvg(dataString) {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(dataString);
    qr.make();
    const count = qr.getModuleCount();
    const cells = [];
    for (let r = 0; r < count; r += 1) {
      for (let c = 0; c < count; c += 1) {
        if (qr.isDark(r, c)) {
          cells.push(`M${c},${r}h1v1h-1z`);
        }
      }
    }
    return (
      <svg
        viewBox={`0 0 ${count} ${count}`}
        style={{ width: '180px', height: '180px', margin: '0 auto', display: 'block' }}
        role="img"
        aria-label="Scannable Zero-Knowledge Proof QR Code"
      >
        <rect width={count} height={count} fill="#ffffff" />
        <path d={cells.join(' ')} fill="#0f172a" />
      </svg>
    );
  } catch (err) {
    console.warn('QR code generation truncated for large payload:', err);
    return null;
  }
}

export default function ZkProofGeneratorModal({ isOpen, onClose }) {
  const titleId = useId();
  const [selectedPolicyKey, setSelectedPolicyKey] = useState('SENIOR_CITIZEN_CONCESSION_TN');
  const [selectedPersonaKey, setSelectedPersonaKey] = useState('SENIOR_CITIZEN_CHENNAI');
  const [proofPayload, setProofPayload] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentPolicy = PREDEFINED_POLICIES[selectedPolicyKey];

  const handleGenerateProof = () => {
    setErrorMsg('');
    setProofPayload(null);
    setCopied(false);

    try {
      // 1. Issue/load credential bundle for chosen synthetic persona
      const { credentialEnvelope, secretAttributes } = issueCredentialForPersona(selectedPersonaKey);

      // 2. Create interactive policy challenge
      const policyRequest = createPolicyChallenge(selectedPolicyKey);

      // 3. Generate Zero-Knowledge proof locally in browser
      const proof = generateAttributeProof({
        credentialEnvelope,
        secretAttributes,
        policyRequest,
      });

      setProofPayload(proof);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to generate attribute proof.');
    }
  };

  const handleCopyJson = () => {
    if (!proofPayload) return;
    navigator.clipboard.writeText(JSON.stringify(proofPayload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadJson = () => {
    if (!proofPayload) return;
    const blob = new Blob([JSON.stringify(proofPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zk-proof-${proofPayload.policyId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="modal-overlay animate-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="modal-container"
        style={{
          background: 'var(--card-bg, #ffffff)',
          color: 'var(--text-main, #0f172a)',
          borderRadius: '1rem',
          maxWidth: '680px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          border: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
              }}
            >
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 id={titleId} style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                Zero-Knowledge Attribute Proof Generator
              </h2>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary, #64748b)' }}>
                Selective Disclosure Prototype (#1161)
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary, #64748b)',
              padding: '0.25rem',
              borderRadius: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Prototype Banner */}
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'flex-start',
              fontSize: '0.8125rem',
              color: '#854d0e',
            }}
          >
            <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Cryptographic Prototype:</strong> {ZK_PROTOTYPE_DISCLAIMER}
            </div>
          </div>

          {/* Form Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            {/* Policy Selection */}
            <div>
              <label htmlFor="zk-policy-select" style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.375rem' }}>
                Select Civic Verification Policy:
              </label>
              <select
                id="zk-policy-select"
                value={selectedPolicyKey}
                onChange={(e) => {
                  setSelectedPolicyKey(e.target.value);
                  setProofPayload(null);
                  setErrorMsg('');
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: 'var(--input-bg, #ffffff)',
                  color: 'inherit',
                  fontSize: '0.875rem',
                }}
              >
                {Object.entries(PREDEFINED_POLICIES).map(([k, p]) => (
                  <option key={k} value={k}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Persona Selection */}
            <div>
              <label htmlFor="zk-persona-select" style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.375rem' }}>
                Select Synthetic Citizen Credential:
              </label>
              <select
                id="zk-persona-select"
                value={selectedPersonaKey}
                onChange={(e) => {
                  setSelectedPersonaKey(e.target.value);
                  setProofPayload(null);
                  setErrorMsg('');
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: 'var(--input-bg, #ffffff)',
                  color: 'inherit',
                  fontSize: '0.875rem',
                }}
              >
                {Object.entries(SYNTHETIC_TEST_PERSONAS).map(([k, p]) => (
                  <option key={k} value={k}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Policy Information Card */}
          {currentPolicy && (
            <div
              style={{
                padding: '0.875rem 1rem',
                borderRadius: '8px',
                background: 'var(--subtle-bg, #f8fafc)',
                border: '1px solid var(--border-color, #e2e8f0)',
                fontSize: '0.875rem',
              }}
            >
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 500 }}>{currentPolicy.description}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {currentPolicy.requiredPredicates.map((pred, i) => (
                  <span
                    key={i}
                    style={{
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: '#1d4ed8',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                    }}
                  >
                    {pred.attribute === 'age'
                      ? `Age ≥ ${pred.threshold}`
                      : `${pred.attribute} ${pred.operator} [${pred.allowedValues?.join(', ') || pred.targetValue}]`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Privacy Guarantee */}
          <div
            style={{
              padding: '0.75rem',
              borderRadius: '6px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.8125rem',
              color: '#065f46',
            }}
          >
            <Lock size={16} />
            <span>
              <strong>Zero-Knowledge Guarantee:</strong> Raw Date of Birth and street address remain in your browser memory and will NEVER be transmitted.
            </span>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerateProof}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <ShieldCheck size={18} />
            Compute Attribute Proof in Browser
          </button>

          {/* Error Message */}
          {errorMsg && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#991b1b',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                fontSize: '0.875rem',
              }}
            >
              <ShieldAlert size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Proof Output View */}
          {proofPayload && (
            <div
              style={{
                marginTop: '0.5rem',
                border: '1px solid #10b981',
                borderRadius: '8px',
                padding: '1.25rem',
                background: 'rgba(16, 185, 129, 0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 600, color: '#047857', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <FileCheck size={18} />
                  Mathematical Proof Ready
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)' }}>
                  Nonce: {proofPayload.nonce.slice(0, 10)}...
                </span>
              </div>

              {/* Scannable QR Code */}
              <div style={{ textAlign: 'center', marginBottom: '1rem', background: '#ffffff', padding: '0.75rem', borderRadius: '8px', display: 'inline-block', width: '100%' }}>
                {renderQrSvg(JSON.stringify(proofPayload))}
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                  Scan with Counter Verifier or Mobile Scanner
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  onClick={handleCopyJson}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.375rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    background: 'var(--card-bg, #ffffff)',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                  }}
                >
                  {copied ? <Check size={16} color="#059669" /> : <Copy size={16} />}
                  {copied ? 'Copied to Clipboard' : 'Copy Proof JSON'}
                </button>
                <button
                  onClick={handleDownloadJson}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.375rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    background: 'var(--card-bg, #ffffff)',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                  }}
                >
                  <Download size={16} />
                  Download Proof (.json)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
