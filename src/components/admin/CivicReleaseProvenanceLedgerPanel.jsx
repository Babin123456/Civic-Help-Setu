import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Key,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  RefreshCw,
  FileCheck,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Layers,
  Lock,
} from 'lucide-react';
import {
  getStoredLedger,
  getStoredKeyring,
  verifyLedgerIntegrity,
  recordKeyLifecycleEvent,
  initializeSyntheticReleaseLedger,
} from '../../services/civicReleaseLedgerService.js';

export default function CivicReleaseProvenanceLedgerPanel() {
  const [ledger, setLedger] = useState(() => getStoredLedger());
  const [keyring, setKeyring] = useState(() => getStoredKeyring());
  const [auditResult, setAuditResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [expandedBlockIndex, setExpandedBlockIndex] = useState(null);
  const [filterGuidanceId, setFilterGuidanceId] = useState('all');
  const [selectedKeyForAction, setSelectedKeyForAction] = useState(null);
  const [revocationReason, setRevocationReason] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState(null);

  const runAudit = async (currentLedger = null, currentKeyring = null) => {
    setIsVerifying(true);
    try {
      const res = await verifyLedgerIntegrity(currentLedger, currentKeyring);
      setAuditResult(res);
    } catch {
      // ignore
    } finally {
      setIsVerifying(false);
    }
  };

  const loadData = () => {
    const l = getStoredLedger();
    const k = getStoredKeyring();
    setLedger(l);
    setKeyring(k);
    runAudit(l, k);
  };

  useEffect(() => {
    const l = getStoredLedger();
    const k = getStoredKeyring();
    verifyLedgerIntegrity(l, k).then((res) => {
      setAuditResult(res);
    }).catch(() => {});
  }, []);

  const handleSimulateTamper = (blockIndex) => {
    const updated = [...ledger];
    if (updated[blockIndex]) {
      // Intentionally tamper with block payload hash or manifest content
      if (updated[blockIndex].manifest) {
        updated[blockIndex].manifest.contentDigest = '0000000000000000000000000000000000000000000000000000000000000000';
      } else {
        updated[blockIndex].previousHash = 'tampered-hash-broken-link';
      }
      setLedger(updated);
      runAudit(updated, keyring);
      setActionSuccessMsg(`Simulated tampering injected at Block #${blockIndex}. Re-run integrity check.`);
    }
  };

  const handleResetSynthetic = async () => {
    setIsVerifying(true);
    await initializeSyntheticReleaseLedger();
    loadData();
    setActionSuccessMsg('Initialized fresh synthetic release manifests, chained ledger, and authorized cryptographic keyring.');
  };

  const handleRevokeKey = async (keyId, isCompromised = false) => {
    if (!revocationReason.trim()) {
      alert('Please provide a reason for key revocation.');
      return;
    }
    await recordKeyLifecycleEvent({
      event: 'REVOCATION',
      keyId,
      reason: `${isCompromised ? '[SECURITY BREACH/COMPROMISE] ' : ''}${revocationReason}`,
      actorId: 'civic-security-auditor',
    });
    setSelectedKeyForAction(null);
    setRevocationReason('');
    setActionSuccessMsg(`Key ${keyId} marked as REVOKED / COMPROMISED.`);
    loadData();
  };

  const filteredBlocks = ledger.filter((block) => {
    if (filterGuidanceId === 'all') return true;
    return block.guidanceId === filterGuidanceId;
  });

  return (
    <div className="civic-release-ledger-panel bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Civic Content Provenance Signatures & Release Ledger
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Tamper-evident release manifest registry with ECDSA-signed source snapshots and reviewer approvals.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => runAudit(ledger, keyring)}
            disabled={isVerifying}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
            {isVerifying ? 'Verifying Hashes...' : 'Verify Cryptographic Integrity'}
          </button>

          <button
            onClick={handleResetSynthetic}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Reset Synthetic Ledger
          </button>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-800 dark:text-blue-200 flex items-center justify-between">
          <span>{actionSuccessMsg}</span>
          <button onClick={() => setActionSuccessMsg(null)} className="font-bold ml-2">×</button>
        </div>
      )}

      {/* Cryptographic Ledger Health Summary */}
      {auditResult && (
        <div
          data-testid="ledger-health-banner"
          className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            auditResult.isValid && auditResult.compromisedKeyBlocks.length === 0
              ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {auditResult.isValid && auditResult.compromisedKeyBlocks.length === 0 ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 mt-0.5" />
            )}
            <div>
              <div className="font-semibold text-sm">
                {auditResult.isValid && auditResult.compromisedKeyBlocks.length === 0
                  ? 'All Release Manifests & Block Hashes Verified'
                  : 'Tampering Detected / Compromised Signing Keys Present!'}
              </div>
              <div className="text-xs opacity-90 mt-0.5">
                Chained blocks checked: {auditResult.blockCount} | Broken blocks: {auditResult.brokenBlocks.length} | Compromised keys: {auditResult.compromisedKeyBlocks.length}
              </div>
            </div>
          </div>

          <div className="text-xs font-mono bg-white/70 dark:bg-gray-800/70 px-3 py-1.5 rounded border border-inherit">
            Algorithm: ECDSA P-256 + SHA-256
          </div>
        </div>
      )}

      {/* Authorized Keyring Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            <Key className="w-3.5 h-3.5" />
            Authoritative Signing Keyring ({keyring.length})
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {keyring.map((k) => (
            <div
              key={k.keyId}
              className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                k.status === 'revoked' || k.status === 'compromised'
                  ? 'bg-rose-50/30 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900'
                  : 'bg-gray-50 dark:bg-gray-750 border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{k.keyId}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    k.status === 'active'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                      : k.status === 'rotated'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                  }`}
                >
                  {k.status}
                </span>
              </div>
              <div className="text-gray-600 dark:text-gray-400 text-[11px]">
                {k.metadata?.department || 'Department Authority'} • {k.metadata?.owner || 'Authorized Signer'}
              </div>
              <div className="font-mono text-[10px] text-gray-500 truncate" title={k.fingerprint}>
                FP: {k.fingerprint}
              </div>

              {k.status === 'active' && (
                <div className="pt-1 flex gap-2">
                  <button
                    onClick={() => setSelectedKeyForAction(k.keyId)}
                    className="text-[11px] text-rose-600 hover:underline font-medium"
                  >
                    Revoke / Report Compromised
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {selectedKeyForAction && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-800 rounded-lg text-xs space-y-2">
            <div className="font-semibold text-amber-900 dark:text-amber-100">
              Revoke Key: {selectedKeyForAction}
            </div>
            <input
              type="text"
              placeholder="Reason for revocation (e.g. Annual audit or hardware token breach)..."
              value={revocationReason}
              onChange={(e) => setRevocationReason(e.target.value)}
              className="w-full px-2.5 py-1.5 border rounded text-xs dark:bg-gray-800 dark:border-gray-700"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleRevokeKey(selectedKeyForAction, false)}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold"
              >
                Standard Revocation
              </button>
              <button
                onClick={() => handleRevokeKey(selectedKeyForAction, true)}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold"
              >
                Mark Compromised
              </button>
              <button
                onClick={() => {
                  setSelectedKeyForAction(null);
                  setRevocationReason('');
                }}
                className="px-2 py-1 text-gray-600 hover:text-gray-800 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Block Chain Feed */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5" />
            Chained Release Ledger Blocks ({filteredBlocks.length})
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="guidance-filter" className="text-xs text-gray-600 dark:text-gray-400">
              Filter:
            </label>
            <select
              id="guidance-filter"
              value={filterGuidanceId}
              onChange={(e) => setFilterGuidanceId(e.target.value)}
              className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800"
            >
              <option value="all">All Releases & Blocks</option>
              <option value="tree-pruning-permission">Tree Pruning Permission</option>
              <option value="trade-licence-renewal">Trade Licence Renewal</option>
            </select>
          </div>
        </div>

        {/* Ledger Blocks List */}
        <div className="space-y-3" data-testid="release-ledger-blocks">
          {filteredBlocks.map((block) => {
            const isExpanded = expandedBlockIndex === block.index;
            const isBroken = auditResult?.brokenBlocks.some((b) => b.index === block.index);
            const isCompromised = auditResult?.compromisedKeyBlocks.some((b) => b.index === block.index);

            return (
              <div
                key={block.index}
                className={`border rounded-lg transition-all ${
                  isBroken
                    ? 'border-rose-400 bg-rose-50/20 dark:bg-rose-950/20'
                    : isCompromised
                    ? 'border-amber-400 bg-amber-50/20 dark:bg-amber-950/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850'
                }`}
              >
                {/* Block Header */}
                <div
                  onClick={() => setExpandedBlockIndex(isExpanded ? null : block.index)}
                  className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 select-none"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                      Block #{block.index}
                    </span>
                    <div>
                      <div className="font-semibold text-xs text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <span>{block.guidanceId}</span>
                        {block.version && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
                            v{block.version}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-gray-500 uppercase">
                          ({block.entryType})
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-gray-500 truncate max-w-xs md:max-w-md">
                        Digest: {block.blockHash}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isBroken && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-100 dark:bg-rose-900/50 px-2 py-0.5 rounded">
                        <AlertTriangle className="w-3 h-3" /> TAMPERED
                      </span>
                    )}
                    {isCompromised && !isBroken && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded">
                        <Key className="w-3 h-3" /> KEY REVOKED
                      </span>
                    )}
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 text-xs space-y-3 font-sans">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <span className="text-[11px] font-semibold text-gray-500">Chaining Previous Hash:</span>
                        <div className="font-mono text-[10px] break-all bg-white dark:bg-gray-900 p-1.5 rounded border border-gray-200 dark:border-gray-700">
                          {block.previousHash}
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-gray-500">Payload Hash:</span>
                        <div className="font-mono text-[10px] break-all bg-white dark:bg-gray-900 p-1.5 rounded border border-gray-200 dark:border-gray-700">
                          {block.payloadHash}
                        </div>
                      </div>
                    </div>

                    {block.manifest && (
                      <div className="space-y-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="font-semibold text-xs flex items-center gap-1 text-gray-800 dark:text-gray-200">
                          <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                          Signed Content Manifest ({block.manifest.manifestId})
                        </div>

                        {/* Authoritative Sources */}
                        <div className="space-y-1">
                          <span className="text-[11px] text-gray-500 font-medium">Authoritative Source Snapshots:</span>
                          <div className="space-y-1">
                            {block.manifest.sources?.map((s, idx) => (
                              <div
                                key={idx}
                                className="bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 text-[11px]"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold">{s.publisher}</span>
                                  <a
                                    href={s.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 flex items-center gap-0.5 hover:underline"
                                  >
                                    View Source <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </div>
                                <div className="font-mono text-[10px] text-gray-500 mt-0.5">
                                  Snapshot Digest: {s.snapshotDigest}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Approvals */}
                        <div className="space-y-1">
                          <span className="text-[11px] text-gray-500 font-medium">Human Editorial Approvals:</span>
                          <div className="space-y-1">
                            {block.manifest.approvals?.map((appr, idx) => (
                              <div
                                key={idx}
                                className="bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 text-[11px] flex items-center justify-between"
                              >
                                <div>
                                  <span className="font-semibold">{appr.reviewerId}</span> ({appr.role})
                                  <p className="text-[10px] text-gray-600 dark:text-gray-400">{appr.notes}</p>
                                </div>
                                <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">
                                  APPROVED
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Signature Block */}
                        <div className="bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 text-[11px] space-y-1">
                          <div className="flex items-center justify-between font-semibold">
                            <span className="flex items-center gap-1">
                              <Lock className="w-3 h-3 text-purple-600" />
                              Cryptographic Signature Block
                            </span>
                            <span className="font-mono text-[10px] text-purple-600">{block.manifest.signatureBlock?.algorithm}</span>
                          </div>
                          <div className="font-mono text-[10px] text-gray-500">
                            Key ID: {block.manifest.signatureBlock?.keyId}
                          </div>
                          <div className="font-mono text-[9px] text-gray-400 break-all">
                            Sig: {block.manifest.signatureBlock?.signatureHex}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tampering Testing Simulation Button */}
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => handleSimulateTamper(block.index)}
                        className="text-[10px] text-amber-700 dark:text-amber-300 hover:text-amber-900 font-semibold px-2 py-1 rounded bg-amber-100/60 dark:bg-amber-950/60"
                      >
                        Simulate Tampering on Block #{block.index}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
