import React, { useState } from 'react';
import {
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldCheck,
  Send,
  X
} from 'lucide-react';
import {
  sendServiceChecklistEmail
} from '../../services/checklistEmailService';

/**
 * EmailChecklistModal
 *
 * Allows citizens to email a structured requirements checklist to themselves
 * or to a designated trusted helper / family member with explicit privacy consent.
 */
export default function EmailChecklistModal({
  isOpen,
  onClose,
  service
}) {
  const [recipientType, setRecipientType] = useState('self'); // 'self' | 'helper'
  const [recipientEmail, setRecipientEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [personalNote, setPersonalNote] = useState('');
  const [helperConsentConfirmed, setHelperConsentConfirmed] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  if (!isOpen) return null;

  const serviceTitle = service?.title || service?.name || 'Selected Civic Service';
  const documents = Array.isArray(service?.documents) ? service.documents : service?.requiredDocuments || [];

  const handleSend = async (e) => {
    e.preventDefault();
    if (!recipientEmail || !recipientEmail.includes('@')) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    if (recipientType === 'helper' && !helperConsentConfirmed) {
      setStatusMessage({
        type: 'error',
        text: 'You must confirm that you have consent to send this checklist to your helper.'
      });
      return;
    }

    setIsSending(true);
    setStatusMessage(null);

    const result = await sendServiceChecklistEmail({
      service,
      recipientEmail,
      senderName,
      isHelper: recipientType === 'helper',
      helperConsentConfirmed,
      personalNote
    });

    setIsSending(false);

    if (result.success) {
      setStatusMessage({
        type: 'success',
        text: `Checklist successfully sent to ${recipientEmail}!`
      });
      setTimeout(() => {
        setStatusMessage(null);
        onClose();
      }, 2500);
    } else {
      setStatusMessage({
        type: 'error',
        text: result.error || 'Failed to send email. Please try again.'
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checklist-email-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-xl w-full flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 id="checklist-email-modal-title" className="text-xl font-bold text-slate-900 dark:text-white">
                Email Service Checklist
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Send required documents and fee details to yourself or a helper
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSend} className="p-6 overflow-y-auto space-y-5 flex-1">
          {statusMessage && (
            <div
              className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Service Summary Card */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 flex items-start gap-3">
            <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm block">
                {serviceTitle}
              </span>
              <p className="text-slate-500 dark:text-slate-400">
                Includes {documents.length} document verification items, prerequisites, and official fee notes.
              </p>
            </div>
          </div>

          {/* Recipient Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-2">
              Who are you sending this to?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRecipientType('self')}
                className={`py-2 px-3 text-sm font-medium rounded-lg border text-center transition-colors ${
                  recipientType === 'self'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-600 dark:text-emerald-300'
                    : 'bg-white border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                Send to Myself
              </button>
              <button
                type="button"
                onClick={() => setRecipientType('helper')}
                className={`py-2 px-3 text-sm font-medium rounded-lg border text-center transition-colors ${
                  recipientType === 'helper'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-600 dark:text-emerald-300'
                    : 'bg-white border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                Send to a Helper / Facilitator
              </button>
            </div>
          </div>

          {/* Email input */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
              Recipient Email Address *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder={recipientType === 'self' ? 'your.email@example.com' : 'helper.family@example.com'}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Sender Name if helper */}
          {recipientType === 'helper' && (
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
                Your Name (for recipient context)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 mb-1">
              Optional Note
            </label>
            <textarea
              rows={2}
              value={personalNote}
              onChange={(e) => setPersonalNote(e.target.value)}
              placeholder="e.g. Please help me review item #2 before my appointment on Monday."
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Helper Consent Checkbox */}
          {recipientType === 'helper' && (
            <label className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-200 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={helperConsentConfirmed}
                onChange={(e) => setHelperConsentConfirmed(e.target.checked)}
                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                I confirm that I am sharing this service preparation checklist with a trusted family member or authorized helper, and acknowledge that no private credentials or ID numbers will be transmitted.
              </span>
            </label>
          )}

          {/* Privacy Callout */}
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/30 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Data Protection Guardrail: The checklist email contains only publicly verified catalogue guidance. No Aadhaar numbers, personal documents, or sensitive data are included.
            </span>
          </div>

          {/* Submit button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSending}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium rounded-lg text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <Send className="w-4 h-4" />
              {isSending ? 'Sending Checklist...' : 'Send Checklist Email'}
            </button>
          </div>
        </form>

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
