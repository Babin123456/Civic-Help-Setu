import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Play
} from 'lucide-react';
import { verifyPresentation } from '../../services/verifiablePresentationService';
import { isPresentationRevoked } from '../../services/consentReceiptService';

export default function VerifierInspectionModal({
  initialPresentation = null
}) {
  const [inputJson, setInputJson] = useState(() => {
    return initialPresentation ? JSON.stringify(initialPresentation, null, 2) : '';
  });
  const [expectedAudience, setExpectedAudience] = useState(() => {
    return initialPresentation ? initialPresentation.audience : '';
  });
  const [expectedNonce, setExpectedNonce] = useState(() => {
    return initialPresentation ? initialPresentation.nonce : '';
  });
  const [verificationResult, setVerificationResult] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const handleVerify = useCallback(async (presToVerify = null, aud = expectedAudience, non = expectedNonce) => {
    setIsEvaluating(true);
    setVerificationResult(null);

    let parsedPres = presToVerify;
    if (!parsedPres) {
      try {
        parsedPres = JSON.parse(inputJson);
      } catch {
        setVerificationResult({
          valid: false,
          verdict: 'FAIL',
          code: 'JSON_PARSE_ERROR',
          error: 'Input is not a valid JSON presentation envelope.'
        });
        setIsEvaluating(false);
        return;
      }
    }

    try {
      const result = await verifyPresentation(parsedPres, {
        expectedAudience: aud.trim() ? aud.trim() : null,
        expectedNonce: non.trim() ? non.trim() : null,
        isRevokedChecker: isPresentationRevoked
      });
      setVerificationResult(result);
    } catch (err) {
      setVerificationResult({
        valid: false,
        verdict: 'FAIL',
        code: 'EXECUTION_ERROR',
        error: err.message
      });
    } finally {
      setIsEvaluating(false);
    }
  }, [inputJson, expectedAudience, expectedNonce]);

  useEffect(() => {
    let isMounted = true;
    if (initialPresentation) {
      verifyPresentation(initialPresentation, {
        expectedAudience: initialPresentation.audience,
        expectedNonce: initialPresentation.nonce,
        isRevokedChecker: isPresentationRevoked
      })
        .then((res) => {
          if (isMounted) setVerificationResult(res);
        })
        .catch((err) => {
          if (isMounted) {
            setVerificationResult({
              valid: false,
              verdict: 'FAIL',
              code: 'EXECUTION_ERROR',
              error: err.message
            });
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [initialPresentation]);

  return (
    <div
      className="verifier-sandbox"
      style={{
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-light, #e2e8f0)',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}
    >
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={20} color="var(--primary-color)" />
          Verifier Inspection Sandbox (Counter & Desk Scrutiny)
        </h3>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Test and cryptographically evaluate any Verifiable Presentation against relying party parameters, anti-tampering commitments, and active DPDP consent revocation.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label htmlFor="verifier-payload-input" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
            Presentation Envelope JSON:
          </label>
          <textarea
            id="verifier-payload-input"
            rows={6}
            value={inputJson}
            onChange={(e) => setInputJson(e.target.value)}
            placeholder="Paste presentation JSON envelope here..."
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: '0.5rem',
              fontFamily: 'monospace',
              fontSize: '0.78rem',
              border: '1px solid var(--border-light, #e2e8f0)',
              background: 'var(--bg-secondary, #f8fafc)',
              color: 'var(--text-primary)'
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <div>
            <label htmlFor="expected-audience-input" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
              Expected Audience URI:
            </label>
            <input
              id="expected-audience-input"
              type="text"
              value={expectedAudience}
              onChange={(e) => setExpectedAudience(e.target.value)}
              placeholder="e.g. civicbridge:service:meter-connection"
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.35rem', fontSize: '0.82rem', border: '1px solid var(--border-light)' }}
            />
          </div>
          <div>
            <label htmlFor="expected-nonce-input" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
              Expected Challenge Nonce:
            </label>
            <input
              id="expected-nonce-input"
              type="text"
              value={expectedNonce}
              onChange={(e) => setExpectedNonce(e.target.value)}
              placeholder="e.g. chn_xyz123"
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.35rem', fontSize: '0.82rem', border: '1px solid var(--border-light)' }}
            />
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => handleVerify()}
            disabled={isEvaluating || !inputJson.trim()}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}
          >
            <Play size={14} />
            {isEvaluating ? 'Evaluating Cryptographic Commitments...' : 'Evaluate Presentation'}
          </button>
        </div>
      </div>

      {/* Verification Result Display */}
      {verificationResult && (
        <div
          role="region"
          aria-live="polite"
          style={{
            borderRadius: '0.75rem',
            padding: '1.25rem',
            border: `1px solid ${verificationResult.valid ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            background: verificationResult.valid ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {verificationResult.valid ? (
              <CheckCircle2 size={24} color="var(--success-color, #16a34a)" />
            ) : (
              <XCircle size={24} color="var(--danger-color, #dc2626)" />
            )}
            <div>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                VERDICT: {verificationResult.verdict || (verificationResult.valid ? 'PASS' : 'FAIL')}
              </h4>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {verificationResult.valid
                  ? 'All cryptographic attribute commitments and envelope integrity checks passed.'
                  : `Verification failed: ${verificationResult.error || verificationResult.code}`}
              </span>
            </div>
          </div>

          {verificationResult.valid && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.5rem',
                  fontSize: '0.82rem'
                }}
              >
                <div style={{ background: 'var(--bg-card)', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Trust Tier:</span>
                  <strong>{verificationResult.trustTier}</strong>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Disclosed Claims:</span>
                  <strong>{Object.keys(verificationResult.disclosedClaims || {}).length} claims</strong>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Withheld (Minimized):</span>
                  <strong>{verificationResult.withheldClaimsCount} attributes</strong>
                </div>
              </div>

              {/* Claims Table */}
              <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                  Verified Disclosed Attributes:
                </span>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {Object.entries(verificationResult.disclosedClaims || {}).map(([k, v]) => (
                    <li key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{k}:</span>
                      <strong>{String(v)}</strong>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Mandatory Statutory Notice */}
              <div
                role="note"
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(234, 179, 8, 0.1)',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)'
                }}
              >
                <AlertTriangle size={14} color="#ca8a04" style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
                <strong>Statutory Notice:</strong> {verificationResult.statutoryDisclaimer}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
