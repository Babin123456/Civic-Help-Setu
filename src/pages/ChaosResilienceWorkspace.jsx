/**
 * src/pages/ChaosResilienceWorkspace.jsx
 * Standalone accessible workspace for Civic Operations Chaos Engineering & Resilience (#1192).
 * Accessible at /chaos-engineering and /admin?tab=chaos-engineering.
 */

import { ShieldAlert, ArrowLeft } from 'lucide-react';
import CivicChaosResiliencePanel from '../components/admin/CivicChaosResiliencePanel';

export default function ChaosResilienceWorkspace() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <a
            href="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </a>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-red-600" />
            Civic Operations Chaos Engineering &amp; Resilience Console
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-3xl">
            Controlled non-production fault injection suite for Civic Help Setu. Tests timeouts, partial outages, rate limits, and stale caches across Firebase, model providers, maps, email, and storage while guaranteeing zero citizen draft loss.
          </p>
        </div>
      </div>

      <CivicChaosResiliencePanel />
    </div>
  );
}
