import React, { useState, useEffect } from 'react';
import {
  Bell,
  Mail,
  CheckCircle,
  AlertTriangle,
  History,
  Send,
  X
} from 'lucide-react';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  getLifecycleEmailLogs,
  sendApplicationLifecycleNotification,
  LIFECYCLE_EVENT_TYPES
} from '../../services/applicationLifecycleEmailService';

/**
 * ApplicationLifecycleNotificationSettingsModal
 *
 * Allows citizens and case managers to configure notification preferences,
 * view dispatched lifecycle emails, and trigger test notifications.
 */
export default function ApplicationLifecycleNotificationSettingsModal({
  isOpen,
  onClose,
  application
}) {
  const [preferences, setPreferences] = useState(getNotificationPreferences());
  const [logs, setLogs] = useState([]);
  const [selectedTab, setSelectedTab] = useState('settings'); // 'settings' | 'history' | 'test'
  const [testEmail, setTestEmail] = useState('');
  const [testEventType, setTestEventType] = useState(LIFECYCLE_EVENT_TYPES.SUBMITTED);
  const [actionStatus, setActionStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPreferences(getNotificationPreferences());
      setLogs(getLifecycleEmailLogs());
      if (application?.applicantEmail) {
        setTestEmail(application.applicantEmail);
      }
    }
  }, [isOpen, application]);

  if (!isOpen) return null;

  const handleTogglePreference = (key) => {
    const updated = { ...preferences, [key]: !preferences[key] };
    setPreferences(updated);
    saveNotificationPreferences(updated);
    setActionStatus({ type: 'success', message: 'Preferences saved.' });
    setTimeout(() => setActionStatus(null), 3000);
  };

  const handleEmailChange = (val) => {
    const updated = { ...preferences, preferredEmail: val };
    setPreferences(updated);
    saveNotificationPreferences(updated);
  };

  const handleSendTestNotification = async (e) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes('@')) {
      setActionStatus({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }

    setIsSubmitting(true);
    setActionStatus(null);

    const targetApp = application || {
      id: 'APP-DEMO-001',
      serviceTitle: 'Sample Civic Application',
      category: 'Citizen Welfare',
      status: 'In Review',
      submittedAt: new Date().toISOString()
    };

    const res = await sendApplicationLifecycleNotification({
      application: targetApp,
      eventType: testEventType,
      recipientEmail: testEmail,
      force: true
    });

    setIsSubmitting(false);

    if (res.success) {
      setActionStatus({
        type: 'success',
        message: `Notification simulated successfully! Dispatched email for ${testEventType}.`
      });
      setLogs(getLifecycleEmailLogs());
    } else {
      setActionStatus({
        type: 'error',
        message: res.error || res.reason || 'Failed to dispatch notification.'
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lifecycle-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 id="lifecycle-modal-title" className="text-xl font-bold text-slate-900 dark:text-white">
                Application Lifecycle Notifications
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage transactional email alerts and track delivery status
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 pt-3 bg-white dark:bg-slate-900">
          <button
            onClick={() => setSelectedTab('settings')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'settings'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Notification Preferences
          </button>
          <button
            onClick={() => setSelectedTab('test')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'test'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Test Dispatch
          </button>
          <button
            onClick={() => setSelectedTab('history')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              selectedTab === 'history'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <History className="w-4 h-4" />
            History ({logs.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {actionStatus && (
            <div
              className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                actionStatus.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              {actionStatus.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{actionStatus.message}</span>
            </div>
          )}

          {/* Tab: Settings */}
          {selectedTab === 'settings' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800">
                <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  Preferred Notification Email
                </label>
                <input
                  type="email"
                  value={preferences.preferredEmail}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="e.g. yourname@example.com"
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Updates will be routed to this address if not specified on the application.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-slate-500" /> Event Triggers
                </h4>

                <label className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer">
                  <div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      Enable All Lifecycle Email Notifications
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Master switch for transactional email delivery
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.emailNotificationsEnabled}
                    onChange={() => handleTogglePreference('emailNotificationsEnabled')}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                </label>

                <div className={`space-y-2 pl-4 border-l-2 border-slate-200 dark:border-slate-800 ${!preferences.emailNotificationsEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <label className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/20 cursor-pointer">
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      Submission Confirmation Receipt
                    </span>
                    <input
                      type="checkbox"
                      checked={preferences.notifyOnSubmission}
                      onChange={() => handleTogglePreference('notifyOnSubmission')}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/20 cursor-pointer">
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      Officer Assignment Notice
                    </span>
                    <input
                      type="checkbox"
                      checked={preferences.notifyOnAssignment}
                      onChange={() => handleTogglePreference('notifyOnAssignment')}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/20 cursor-pointer">
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      Correction / Information Requests
                    </span>
                    <input
                      type="checkbox"
                      checked={preferences.notifyOnCorrections}
                      onChange={() => handleTogglePreference('notifyOnCorrections')}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/20 cursor-pointer">
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      Status Stage Transitions
                    </span>
                    <input
                      type="checkbox"
                      checked={preferences.notifyOnStatusChanges}
                      onChange={() => handleTogglePreference('notifyOnStatusChanges')}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/20 cursor-pointer">
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      Completion & Final Decision Notices
                    </span>
                    <input
                      type="checkbox"
                      checked={preferences.notifyOnCompletion}
                      onChange={() => handleTogglePreference('notifyOnCompletion')}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Test */}
          {selectedTab === 'test' && (
            <form onSubmit={handleSendTestNotification} className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-300">
                You can test email notification formatting and ensure delivery workflows operate properly for current or simulated applications.
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Recipient Email
                </label>
                <input
                  type="email"
                  required
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Lifecycle Event Type
                </label>
                <select
                  value={testEventType}
                  onChange={(e) => setTestEventType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value={LIFECYCLE_EVENT_TYPES.SUBMITTED}>Submission Receipt</option>
                  <option value={LIFECYCLE_EVENT_TYPES.ASSIGNED}>Officer Assigned</option>
                  <option value={LIFECYCLE_EVENT_TYPES.CORRECTION_REQUIRED}>Correction Required</option>
                  <option value={LIFECYCLE_EVENT_TYPES.STATUS_UPDATED}>Status Stage Updated</option>
                  <option value={LIFECYCLE_EVENT_TYPES.COMPLETED}>Completed & Ready</option>
                  <option value={LIFECYCLE_EVENT_TYPES.REJECTED}>Application Rejected</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? 'Simulating Dispatch...' : 'Send Test Notification'}
                </button>
              </div>
            </form>
          )}

          {/* Tab: History */}
          {selectedTab === 'history' && (
            <div className="space-y-3">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No lifecycle notifications have been sent yet.
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
                      <span>To: {log.recipientEmail}</span>
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
