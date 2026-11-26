/**
 * src/components/evidenceLocker/EvidenceLockerDisclaimer.jsx
 * Accessible Disclaimer & Statutory Notice for Digital Evidence Locker (#1186).
 *
 * Emphasizes:
 * - Deterministic rules outside LLM prompts
 * - AI untrusted suggestion notice & human provenance
 * - Explicit human approval for high-impact legal/civic actions
 * - Non-AI fallback notice
 * - Zero-recovery boundary statement (user owns encryption key)
 */

import { ShieldAlert, AlertTriangle, KeyRound, Info, CheckCircle2 } from 'lucide-react';

export default function EvidenceLockerDisclaimer() {
  return (
    <div
      role="region"
      aria-label="Evidence Locker Security & Statutory Notice"
      className="p-4 mb-6 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 text-amber-900 dark:text-amber-200"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-6 h-6 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div className="space-y-2 text-sm leading-relaxed">
          <div className="font-semibold text-base flex items-center gap-2">
            Civic Service Evidence Locker: Client-Side Security & Statutory Boundary Notice
          </div>
          <p>
            This evidence locker provides <strong>zero-knowledge client-side encryption</strong> (AES-256-GCM + PBKDF2) to organize and preserve sensitive civic records before deciding to share them with public authorities.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
            <div className="flex items-start gap-2 p-2.5 rounded bg-white/70 dark:bg-neutral-900/50 border border-amber-200 dark:border-amber-800/60">
              <KeyRound className="w-4 h-4 flex-shrink-0 text-amber-700 dark:text-amber-400 mt-0.5" />
              <div>
                <strong className="block font-semibold">Zero Server Key Escrow</strong>
                Passphrases and recovery mnemonics are <em>never</em> sent to or stored on any server. If you lose your master passphrase and 12-word recovery mnemonic, records cannot be decrypted or recovered by maintainers.
              </div>
            </div>

            <div className="flex items-start gap-2 p-2.5 rounded bg-white/70 dark:bg-neutral-900/50 border border-amber-200 dark:border-amber-800/60">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-700 dark:text-amber-400 mt-0.5" />
              <div>
                <strong className="block font-semibold">Non-AI Fallback & Human Discretion</strong>
                All cryptographic integrity calculations and access grants are deterministic. AI assistance (if any) provides untrusted drafting suggestions and does not autonomously submit or verify official claims.
              </div>
            </div>

            <div className="flex items-start gap-2 p-2.5 rounded bg-white/70 dark:bg-neutral-900/50 border border-amber-200 dark:border-amber-800/60">
              <Info className="w-4 h-4 flex-shrink-0 text-amber-700 dark:text-amber-400 mt-0.5" />
              <div>
                <strong className="block font-semibold">Revocable & Time-Bounded Sharing</strong>
                When generating a share grant for a lawyer or civic grievance cell, set an expiry timestamp and max access count. You can revoke shared access at any second.
              </div>
            </div>

            <div className="flex items-start gap-2 p-2.5 rounded bg-white/70 dark:bg-neutral-900/50 border border-amber-200 dark:border-amber-800/60">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-amber-700 dark:text-amber-400 mt-0.5" />
              <div>
                <strong className="block font-semibold">BSA 2023 / Section 63 Admissibility</strong>
                SHA-256 byte digests mathematically prove uncorrupted file integrity from the time of capture. They do not constitute official administrative issuance.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
