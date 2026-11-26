import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  FileSearch,
  KeyRound,
  RotateCcw,
  Info,
  ArrowLeft,
  FileCheck,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import {
  PREDEFINED_POLICIES,
  createPolicyChallenge,
} from '../services/zkVerifierPolicyService';
import {
  verifyAttributeProof,
  generateAttributeProof,
} from '../services/zkAttributeProofService';
import {
  issueCredentialForPersona,
} from '../services/zkCredentialIssuerService';
import {
  revokeCredential,
  resetRevocationRegistry,
} from '../services/zkRevocationRegistryService';
import {
  ZK_PROTOTYPE_DISCLAIMER,
} from '../data/zkProofContracts';

export default function ZkAttributeVerifierView() {
  const [activeTab, setActiveTab] = useState('verifier');
  const [selectedPolicyKey, setSelectedPolicyKey] = useState('SENIOR_CITIZEN_CONCESSION_TN');

  // Interactive challenge state
  const [currentChallenge, setCurrentChallenge] = useState(() =>
    createPolicyChallenge('SENIOR_CITIZEN_CONCESSION_TN')
  );

  const [inputProofJson, setInputProofJson] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [parseError, setParseError] = useState('');

  // Revocation simulator state
  const [revocationIssuer, setRevocationIssuer] = useState('did:civic:dept-revenue-tn');
  const [revocationIndex, setRevocationIndex] = useState('5');
  const [revocationFeedback, setRevocationFeedback] = useState('');

  const currentPolicy = PREDEFINED_POLICIES[selectedPolicyKey];

  const handlePolicyChange = (newPolicyKey) => {
    setSelectedPolicyKey(newPolicyKey);
    setVerificationResult(null);
    setParseError('');
    try {
      const freshChallenge = createPolicyChallenge(newPolicyKey);
      setCurrentChallenge(freshChallenge);
    } catch (err) {
      console.warn('Failed to issue fresh challenge:', err);
    }
  };

  const handleRefreshChallenge = () => {
    setVerificationResult(null);
    setParseError('');
    try {
      const freshChallenge = createPolicyChallenge(selectedPolicyKey);
      setCurrentChallenge(freshChallenge);
    } catch (err) {
      setParseError(err.message);
    }
  };

  const handleLoadSampleValidProof = () => {
    setParseError('');
    setVerificationResult(null);
    try {
      // Create fresh challenge matching the current policy
      const challenge = createPolicyChallenge(selectedPolicyKey);
      setCurrentChallenge(challenge);

      // Determine matching persona
      let personaKey = 'SENIOR_CITIZEN_CHENNAI';
      if (selectedPolicyKey === 'ADULT_CIVIC_ELECTOR') {
        personaKey = 'ADULT_TIRUVALLUR';
      } else if (selectedPolicyKey === 'WARD_174_PARTICIPATORY_BUDGET') {
        personaKey = 'SENIOR_CITIZEN_CHENNAI';
      }

      const { credentialEnvelope, secretAttributes } = issueCredentialForPersona(personaKey);
      const proof = generateAttributeProof({
        credentialEnvelope,
        secretAttributes,
        policyRequest: challenge,
      });

      setInputProofJson(JSON.stringify(proof, null, 2));
    } catch (err) {
      setParseError(`Failed to load sample proof: ${err.message}`);
    }
  };

  const handleLoadSampleTamperedProof = () => {
    setParseError('');
    setVerificationResult(null);
    try {
      const challenge = createPolicyChallenge(selectedPolicyKey);
      setCurrentChallenge(challenge);

      const { credentialEnvelope, secretAttributes } = issueCredentialForPersona('SENIOR_CITIZEN_CHENNAI');
      const proof = generateAttributeProof({
        credentialEnvelope,
        secretAttributes,
        policyRequest: challenge,
      });

      // Tamper proof signature
      proof.proofSignature = 'tampered-invalid-signature-hex-1234567890abcdef';
      // Tamper commitment
      if (proof.disclosedCommitments.birthDate) {
        proof.disclosedCommitments.birthDate = '0000000000000000000000000000000000000000000000000000000000000000';
      }

      setInputProofJson(JSON.stringify(proof, null, 2));
    } catch (err) {
      setParseError(`Failed to load tampered proof: ${err.message}`);
    }
  };

  const handleVerify = () => {
    setParseError('');
    setVerificationResult(null);

    if (!inputProofJson.trim()) {
      setParseError('Please paste or load a JSON attribute proof dossier.');
      return;
    }

    let parsedProof;
    try {
      parsedProof = JSON.parse(inputProofJson);
    } catch (e) {
      setParseError(`Invalid JSON format: ${e.message}`);
      return;
    }

    try {
      const result = verifyAttributeProof({
        proofPayload: parsedProof,
        policyRequest: currentChallenge,
      });
      setVerificationResult(result);
    } catch (err) {
      setParseError(`Verification runtime error: ${err.message}`);
    }
  };

  const handleRevokeTestIndex = () => {
    try {
      const idx = parseInt(revocationIndex, 10);
      if (Number.isNaN(idx) || idx < 0) {
        setRevocationFeedback('Index must be a non-negative integer.');
        return;
      }
      revokeCredential(revocationIssuer, idx, 'Simulated test revocation');
      setRevocationFeedback(`Successfully revoked index #${idx} on issuer ${revocationIssuer}.`);
    } catch (err) {
      setRevocationFeedback(`Revocation error: ${err.message}`);
    }
  };

  return (
    <div className="section animate-fade-in" style={{ paddingBottom: '6rem' }}>
      <div className="container" style={{ maxWidth: '960px' }}>
        {/* Navigation Breadcrumb */}
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            to="/vault"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              color: 'var(--text-secondary, #64748b)',
              textDecoration: 'none',
              fontSize: '0.875rem',
            }}
          >
            <ArrowLeft size={16} />
            Back to Document Vault
          </Link>
        </div>

        {/* Page Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'rgba(37, 99, 235, 0.1)',
              color: '#2563eb',
              marginBottom: '1rem',
            }}
          >
            <ShieldCheck size={32} />
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
            Zero-Knowledge Attribute Verifier
          </h1>
          <p style={{ color: 'var(--text-secondary, #64748b)', margin: 0, fontSize: '1rem' }}>
            Selective-disclosure verification portal for age and municipal residency attributes (#1161)
          </p>
        </div>

        {/* Prototype Disclaimer Banner */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '10px',
            background: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-start',
            marginBottom: '2rem',
            fontSize: '0.875rem',
            color: '#854d0e',
          }}
        >
          <Info size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Prototype Boundary Notice:</strong> {ZK_PROTOTYPE_DISCLAIMER}
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            marginBottom: '2rem',
            gap: '1rem',
          }}
          role="tablist"
        >
          <button
            role="tab"
            aria-selected={activeTab === 'verifier'}
            onClick={() => setActiveTab('verifier')}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'verifier' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'verifier' ? '#2563eb' : 'var(--text-secondary, #64748b)',
              fontWeight: activeTab === 'verifier' ? 600 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <FileSearch size={18} />
            Interactive Verifier
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'policies'}
            onClick={() => setActiveTab('policies')}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'policies' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'policies' ? '#2563eb' : 'var(--text-secondary, #64748b)',
              fontWeight: activeTab === 'policies' ? 600 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Layers size={18} />
            Verifier Policies
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'revocation'}
            onClick={() => setActiveTab('revocation')}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'revocation' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'revocation' ? '#2563eb' : 'var(--text-secondary, #64748b)',
              fontWeight: activeTab === 'revocation' ? 600 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <KeyRound size={18} />
            Revocation Simulator
          </button>
        </div>

        {/* Tab 1: Interactive Verifier */}
        {activeTab === 'verifier' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Policy & Challenge Config Card */}
            <div
              style={{
                background: 'var(--card-bg, #ffffff)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label htmlFor="verifier-policy-select" style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.375rem' }}>
                    Active Verification Policy:
                  </label>
                  <select
                    id="verifier-policy-select"
                    value={selectedPolicyKey}
                    onChange={(e) => handlePolicyChange(e.target.value)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color, #cbd5e1)',
                      background: 'var(--input-bg, #ffffff)',
                      color: 'inherit',
                      fontSize: '0.875rem',
                      minWidth: '280px',
                    }}
                  >
                    {Object.entries(PREDEFINED_POLICIES).map(([k, p]) => (
                      <option key={k} value={k}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Challenge Nonce Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      background: 'var(--subtle-bg, #f1f5f9)',
                      border: '1px solid var(--border-color, #e2e8f0)',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary, #64748b)' }}>Challenge Nonce: </span>
                    <code style={{ fontWeight: 600 }}>{currentChallenge?.nonce?.slice(0, 16)}...</code>
                  </div>
                  <button
                    onClick={handleRefreshChallenge}
                    title="Generate fresh challenge nonce"
                    style={{
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color, #cbd5e1)',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
              </div>

              {/* Policy Predicate Summary */}
              {currentPolicy && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: 'rgba(59, 130, 246, 0.05)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    fontSize: '0.875rem',
                  }}
                >
                  <span style={{ fontWeight: 600, color: '#1d4ed8' }}>Required Attributes: </span>
                  {currentPolicy.requiredPredicates.map((p, i) => (
                    <span key={i} style={{ marginRight: '0.75rem' }}>
                      • {p.attribute} ({p.operator} {p.threshold ?? p.allowedValues?.join(', ') ?? p.targetValue})
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Input Dossier Section */}
            <div
              style={{
                background: 'var(--card-bg, #ffffff)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <label htmlFor="proof-textarea" style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  Paste Proof JSON Dossier:
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={handleLoadSampleValidProof}
                    style={{
                      padding: '0.375rem 0.625rem',
                      borderRadius: '6px',
                      border: '1px solid #10b981',
                      background: 'rgba(16, 185, 129, 0.1)',
                      color: '#065f46',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Load Sample Valid Proof
                  </button>
                  <button
                    onClick={handleLoadSampleTamperedProof}
                    style={{
                      padding: '0.375rem 0.625rem',
                      borderRadius: '6px',
                      border: '1px solid #ef4444',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#991b1b',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Load Tampered Proof
                  </button>
                </div>
              </div>

              <textarea
                id="proof-textarea"
                rows={8}
                value={inputProofJson}
                onChange={(e) => setInputProofJson(e.target.value)}
                placeholder='Paste {"schemaVersion": "civicbridge.zk.proof.v1", "policyId": ...} or click "Load Sample Valid Proof"'
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontFamily: 'monospace',
                  fontSize: '0.8125rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: 'var(--input-bg, #ffffff)',
                  color: 'inherit',
                  resize: 'vertical',
                }}
              />

              {parseError && (
                <div style={{ marginTop: '0.75rem', color: '#dc2626', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <AlertTriangle size={16} />
                  <span>{parseError}</span>
                </div>
              )}

              <button
                onClick={handleVerify}
                className="btn btn-primary"
                style={{
                  marginTop: '1rem',
                  width: '100%',
                  padding: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                }}
              >
                <FileCheck size={18} />
                Verify Cryptographic Proof
              </button>
            </div>

            {/* Verification Result Card */}
            {verificationResult && (
              <div
                style={{
                  background: 'var(--card-bg, #ffffff)',
                  border: `2px solid ${verificationResult.verified ? '#10b981' : '#ef4444'}`,
                  borderRadius: '12px',
                  padding: '1.5rem',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                }}
              >
                {/* Result Header Badge */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '1.25rem',
                    padding: '1rem',
                    borderRadius: '8px',
                    background: verificationResult.verified ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  }}
                >
                  {verificationResult.verified ? (
                    <ShieldCheck size={36} color="#059669" />
                  ) : (
                    <ShieldAlert size={36} color="#dc2626" />
                  )}
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: verificationResult.verified ? '#047857' : '#b91c1c' }}>
                      {verificationResult.verified ? 'VERIFIED: ATTRIBUTES SATISFIED' : 'VERIFICATION REJECTED'}
                    </h3>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary, #64748b)' }}>
                      {verificationResult.verified
                        ? 'All requested cryptographic predicates satisfied without exposing raw personal data.'
                        : verificationResult.failureReason || 'Failed verification checks.'}
                    </p>
                  </div>
                </div>

                {/* Audit Checklist Table */}
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9375rem', fontWeight: 600 }}>
                  Cryptographic Audit Trail:
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {verificationResult.checks.schemaValid ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color="#dc2626" />}
                    <span>Schema Validation & Format Integrity</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {verificationResult.checks.policyMatch ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color="#dc2626" />}
                    <span>Verifier Policy & Nonce Identity Match</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {verificationResult.checks.freshnessAndAntiReplay ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color="#dc2626" />}
                    <span>Anti-Replay Protection & 5-minute Freshness TTL</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {verificationResult.checks.trustedIssuer ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color="#dc2626" />}
                    <span>Trusted Authority Issuer Root</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {verificationResult.checks.issuerSignature ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color="#dc2626" />}
                    <span>Authority Cryptographic Signature</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {verificationResult.checks.revocationStatus ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color="#dc2626" />}
                    <span>Revocation Registry Check (Active Status List)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {verificationResult.checks.predicatesSatisfied ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color="#dc2626" />}
                    <span>Mathematical Predicate Proofs Evaluated</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Verifier Policies */}
        {activeTab === 'policies' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {Object.entries(PREDEFINED_POLICIES).map(([k, policy]) => (
              <div
                key={k}
                style={{
                  background: 'var(--card-bg, #ffffff)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>{policy.title}</h3>
                  <code style={{ fontSize: '0.75rem', background: 'var(--subtle-bg, #f1f5f9)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                    {policy.policyId}
                  </code>
                </div>
                <p style={{ color: 'var(--text-secondary, #64748b)', fontSize: '0.875rem', margin: '0 0 1rem 0' }}>
                  {policy.description}
                </p>

                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary, #64748b)' }}>
                  Required Predicates:
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' }}>
                  {policy.requiredPredicates.map((p, idx) => (
                    <div key={idx} style={{ fontSize: '0.8125rem', background: 'var(--subtle-bg, #f8fafc)', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                      <strong>{p.attribute}</strong>: Operator <code>{p.operator}</code>
                      {p.threshold !== undefined && ` (Threshold: ${p.threshold})`}
                      {p.allowedValues && ` (Allowed: [${p.allowedValues.join(', ')}])`}
                      {p.targetValue && ` (Target: "${p.targetValue}")`}
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary, #64748b)' }}>
                  <strong>Trusted Issuers: </strong>
                  {policy.trustedIssuers.join(', ')}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Revocation Simulator */}
        {activeTab === 'revocation' && (
          <div
            style={{
              background: 'var(--card-bg, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '12px',
              padding: '1.5rem',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: 600 }}>
              Credential Revocation Simulator
            </h3>
            <p style={{ color: 'var(--text-secondary, #64748b)', fontSize: '0.875rem', margin: '0 0 1.5rem 0' }}>
              Test revocation handling in the prototype. Marking a credential index as revoked will cause any subsequent proof presentation using that credential to be rejected by the verifier.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label htmlFor="revocation-issuer-select" style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.375rem' }}>
                  Issuer Authority:
                </label>
                <select
                  id="revocation-issuer-select"
                  value={revocationIssuer}
                  onChange={(e) => setRevocationIssuer(e.target.value)}
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
                  <option value="did:civic:dept-revenue-tn">did:civic:dept-revenue-tn (Dept of Revenue)</option>
                  <option value="did:civic:civil-registry-tn">did:civic:civil-registry-tn (Civil Registry)</option>
                  <option value="did:civic:gcc-chennai">did:civic:gcc-chennai (Greater Chennai Corp)</option>
                </select>
              </div>

              <div>
                <label htmlFor="revocation-index-input" style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.375rem' }}>
                  Status List Index (0 - 2047):
                </label>
                <input
                  id="revocation-index-input"
                  type="number"
                  min="0"
                  max="2047"
                  value={revocationIndex}
                  onChange={(e) => setRevocationIndex(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    background: 'var(--input-bg, #ffffff)',
                    color: 'inherit',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <button
                onClick={handleRevokeTestIndex}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Mark Credential as Revoked
              </button>
              <button
                onClick={() => {
                  resetRevocationRegistry();
                  setRevocationFeedback('Revocation registry reset to initial state.');
                }}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  background: 'transparent',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  color: 'inherit',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Reset Registry
              </button>
            </div>

            {revocationFeedback && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  background: 'var(--subtle-bg, #f8fafc)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  fontSize: '0.875rem',
                }}
              >
                {revocationFeedback}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
