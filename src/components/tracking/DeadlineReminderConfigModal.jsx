import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  Bell,
  Mail,
  CheckCircle,
  AlertTriangle,
  Send,
  X,
  Trash2
} from 'lucide-react';
import {
  getDeadlineReminderConfigs,
  saveDeadlineReminderConfig,
  cancelDeadlineReminder,
  getDeadlineReminderLogs,
  sendDeadlineReminder,
  calculateDaysRemaining
} from '../../services/deadlineReminderEmailService';

/**
 * DeadlineReminderConfigModal
 *
 * Allows citizens to set custom automated email reminders before key civic deadlines,
 * preview reminder content, and test reminder dispatches.
 */
export default function DeadlineReminderConfigModal({
  isOpen,
  onClose,
  application
}) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [actionRequired, setActionRequired] = useState('');
  const [timeZone, setTimeZone] = useState('Asia/Kolkata');
  const [cadenceDays, setCadenceDays] = useState([7, 3, 1]);
  const [statusMessage, setStatusMessage] = useState(null);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('configure'); // 'configure' | 'logs'
  const [isSubmitting, setIsSubmitting] = useState(false);

  const appId = application?.id || application?.applicationId || 'APP-GENERAL-REMINDER';
  const appTitle = application?.serviceTitle || application?.title || 'Civic Application';

  useEffect(() => {
    if (isOpen) {
      const existingConfigs = getDeadlineReminderConfigs();
      const existing = existingConfigs.find((c) => c.applicationId === appId);

      if (existing) {
        setRecipientEmail(existing.recipientEmail || '');
        setDeadlineDate(existing.deadlineDate || '');
        setActionRequired(existing.actionRequired || '');
        setTimeZone(existing.timeZone || 'Asia/Kolkata');
        setCadenceDays(existing.cadenceDays || [7, 3, 1]);
      } else {
        setRecipientEmail(application?.applicantEmail || '');
        // Default deadline to 14 days from now if not given
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 14);
        setDeadlineDate(futureDate.toISOString().split('T')[0]);
        setActionRequired('Submit supporting physical certificates to the district nodal officer.');
      }

      setLogs(getDeadlineReminderLogs().filter((l) => l.applicationId === appId));
    }
  }, [isOpen, appId, application]);

  if (!isOpen) return null;

  const toggleCadence = (days) => {
    if (cadenceDays.includes(days)) {
      setCadenceDays(cadenceDays.filter((d) => d !== days));
    } else {
      setCadenceDays([...cadenceDays, days].sort((a, b) => b - a));
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!recipientEmail || !recipientEmail.includes('@')) {
      setStatusMessage({ type: 'error', text: 'Please provide a valid recipient email address.' });
      return;
    }

    if (!deadlineDate) {
      setStatusMessage({ type: 'error', text: 'Please select a valid deadline date.' });
      return;
    }

    const config = {
      applicationId: appId,
      serviceTitle: appTitle,
      recipientEmail,
      deadlineDate,
      actionRequired,
      timeZone,
      cadenceDays: cadenceDays.length > 0 ? cadenceDays : [3, 1],
      currentStatus: application?.status || 'Pending'
    };

    const res = saveDeadlineReminderConfig(config);
    if (res.success) {
      setStatusMessage({ type: 'success', text: 'Deadline reminders saved and scheduled successfully!' });
      setTimeout(() => setStatusMessage(null), 3500);
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to save configuration.' });
    }
  };

  const handleCancelReminder = () => {
    cancelDeadlineReminder(appId);
    setStatusMessage({ type: 'success', text: 'All automated reminders for this application have been cancelled.' });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleTestSend = async () => {
    setIsSubmitting(true);
    setStatusMessage(null);

    const config = {
      applicationId: appId,
      serviceTitle: appTitle,
      recipientEmail,
      deadlineDate,
      actionRequired,
      timeZone,
      cadenceDays
    };

    const res = await sendDeadlineReminder({
      config,
      recipientEmail,
      daysRemainingOverride: 3,
      force: true
    });

    setIsSubmitting(false);

    if (res.success) {
      setStatusMessage({ type: 'success', text: 'Sample 3-day reminder email dispatched successfully!' });
      setLogs(getDeadlineReminderLogs().filter((l) => l.applicationId === appId));
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to send test reminder.' });
    }
  };

  const daysRemaining = calculateDaysRemaining(deadlineDate, timeZone);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminder-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 id="reminder-modal-title" className="text-xl font-bold text-slate-900 dark:text-white">
                Application Deadline Reminders
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automated email alerts before critical submission or verification cut-offs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 pt-3 bg-white dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('configure')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'configure'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Reminder Settings
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Dispatch History ({logs.length})
          </button>
        </div>

        {/* Body */}
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

          {activeTab === 'configure' ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                    Application ID
                  </label>
                  <input
                    type="text"
                    disabled
                    value={appId}
                    className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                    Service
                  </label>
                  <input
                    type="text"
                    disabled
                    value={appTitle}
                    className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                  Recipient Email *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="e.g. applicant@example.gov.in"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                    Official Deadline Date *
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="date"
                      required
                      value={deadlineDate}
                      onChange={(e) => setDeadlineDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  {daysRemaining !== null && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                      {daysRemaining > 0
                        ? `Approximately ${daysRemaining} days remaining`
                        : daysRemaining === 0
                        ? 'Deadline is TODAY!'
                        : 'Selected date is in the past'}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                    Timezone
                  </label>
                  <select
                    value={timeZone}
                    onChange={(e) => setTimeZone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                  Action Required Note
                </label>
                <textarea
                  rows={2}
                  value={actionRequired}
                  onChange={(e) => setActionRequired(e.target.value)}
                  placeholder="e.g. Submit biometric verification or upload corrected revenue memo."
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-2">
                  Reminder Cadence (Days Before Deadline)
                </label>
                <div className="flex flex-wrap gap-2">
                  {[7, 3, 1, 0].map((days) => {
                    const isSelected = cadenceDays.includes(days);
                    const label = days === 0 ? 'Day of Deadline (0 days)' : `${days} Day${days > 1 ? 's' : ''} Prior`;
                    return (
                      <button
                        type="button"
                        key={days}
                        onClick={() => toggleCadence(days)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          isSelected
                            ? 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-200'
                            : 'bg-white border-slate-300 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg text-sm transition-colors shadow-sm"
                >
                  Save Reminder Schedule
                </button>
                <button
                  type="button"
                  onClick={handleTestSend}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-4 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? 'Sending...' : 'Test Send Sample'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelReminder}
                  className="w-full sm:w-auto px-3 py-2.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 ml-auto transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Cancel Reminders
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No deadline reminders have been sent for this application yet.
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
                      <span>Recipient: {log.recipientEmail}</span>
                      <span>{new Date(log.dispatchedAt).toLocaleString()}</span>
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
