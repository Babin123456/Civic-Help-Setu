import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Mail,
  Clock,
  CheckCircle,
  AlertTriangle,
  Send,
  X,
  Shield,
  Layers,
  FileCheck
} from 'lucide-react';
import {
  getDigestConfig,
  saveDigestConfig,
  getDigestLogs,
  aggregateOperationsData,
  sendAdminOperationsDigest
} from '../../services/adminOperationsDigestEmailService';

/**
 * AdminOperationsDigestModal
 *
 * Provides administrative staff with configuration controls for the daily operations digest,
 * operational queue previews, on-demand test dispatch, and delivery audit history.
 */
export default function AdminOperationsDigestModal({
  isOpen,
  onClose
}) {
  const [config, setConfig] = useState(getDigestConfig());
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'settings' | 'history'
  const [testEmail, setTestEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);
  const [isSending, setIsSending] = useState(false);

  const opsData = aggregateOperationsData();

  useEffect(() => {
    if (isOpen) {
      const currentConfig = getDigestConfig();
      setConfig(currentConfig);
      setLogs(getDigestLogs());
      setTestEmail(currentConfig.adminEmails?.[0] || 'admin@civichelpsetu.gov.in');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggle = (key) => {
    const updated = { ...config, [key]: !config[key] };
    setConfig(updated);
    saveDigestConfig(updated);
    setStatusMessage({ type: 'success', text: 'Setting updated successfully.' });
    setTimeout(() => setStatusMessage(null), 2500);
  };

  const handleHourChange = (hour) => {
    const updated = { ...config, deliveryHour: parseInt(hour, 10) };
    setConfig(updated);
    saveDigestConfig(updated);
  };

  const handleTestSend = async (e) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes('@')) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid administrator email address.' });
      return;
    }

    setIsSending(true);
    setStatusMessage(null);

    const res = await sendAdminOperationsDigest({
      targetEmail: testEmail,
      force: true
    });

    setIsSending(false);

    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: `Operations digest successfully dispatched to ${testEmail}!`
      });
      setLogs(getDigestLogs());
    } else {
      setStatusMessage({
        type: 'error',
        text: res.error || res.reason || 'Failed to dispatch digest.'
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-digest-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="admin-digest-title" className="text-xl font-bold text-slate-900 dark:text-white">
                Daily Civic Operations Digest
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automated administrative summary of queues, bottlenecks & SLA breaches
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 pt-3 bg-white dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('preview')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'preview'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Queue Preview
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'settings'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Schedule & Recipients
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Dispatch Logs ({logs.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {statusMessage && (
            <div
              className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Tab 1: Preview */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                  <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {opsData.pendingApplicationsCount}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Pending Apps</div>
                  <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                    {opsData.slaBreachedApplicationsCount} SLA Breached
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                  <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {opsData.openGrievancesCount}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Grievances</div>
                  <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                    {opsData.criticalGrievancesCount} Critical
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                  <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {opsData.pendingCommunityAuditsCount}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Audits Pending</div>
                  <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                    {opsData.staleCatalogueRecordsCount} Stale Entries
                  </div>
                </div>
              </div>

              {/* Top Service Queues */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-500" /> Top Pending Service Volumes
                </h4>
                <div className="space-y-2">
                  {opsData.topPendingServices.map((service) => (
                    <div
                      key={service.name}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-slate-200/60 dark:border-slate-700/60 last:border-0"
                    >
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{service.name}</span>
                      <span className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded font-mono font-semibold">
                        {service.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Send Sample Action */}
              <form onSubmit={handleTestSend} className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-900/50 space-y-3">
                <div className="text-xs text-indigo-900 dark:text-indigo-300 font-medium flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  On-Demand Administrator Test Dispatch
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="admin.duty@civichelpsetu.gov.in"
                    className="flex-1 px-3 py-2 text-xs border border-indigo-200 dark:border-indigo-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={isSending}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-sm shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {isSending ? 'Sending...' : 'Test Send'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tab 2: Settings */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <label className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    Enable Daily Operations Digest
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Master trigger for the daily summary broadcast
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={() => handleToggle('enabled')}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                    Scheduled Dispatch Time
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <select
                      value={config.deliveryHour}
                      onChange={(e) => handleHourChange(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="6">06:00 AM (Early Morning)</option>
                      <option value="8">08:00 AM (Standard Shift Start)</option>
                      <option value="9">09:00 AM (Office Opening)</option>
                      <option value="18">06:00 PM (End of Day Wrap)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                    Timezone
                  </label>
                  <input
                    type="text"
                    disabled
                    value={config.timeZone}
                    className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-semibold uppercase text-slate-700 dark:text-slate-300">
                  Included Digest Modules
                </h4>
                <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                  <span className="text-slate-700 dark:text-slate-300">Pending Applications &amp; SLAs</span>
                  <input
                    type="checkbox"
                    checked={config.includeApplicationsQueue}
                    onChange={() => handleToggle('includeApplicationsQueue')}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </label>
                <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                  <span className="text-slate-700 dark:text-slate-300">Grievances &amp; Escalations</span>
                  <input
                    type="checkbox"
                    checked={config.includeGrievancesQueue}
                    onChange={() => handleToggle('includeGrievancesQueue')}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </label>
                <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                  <span className="text-slate-700 dark:text-slate-300">Community Audits &amp; Broken Links</span>
                  <input
                    type="checkbox"
                    checked={config.includeAuditProposals}
                    onChange={() => handleToggle('includeAuditProposals')}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Tab 3: History */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No daily operations digests have been logged yet.
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg text-xs space-y-1 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {log.subject}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                        {log.status}
                      </span>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>Recipients: {log.recipients.join(', ')}</span>
                      <span>{new Date(log.sentAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
