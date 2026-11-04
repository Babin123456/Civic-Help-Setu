import React, { useState } from 'react';
import {
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  getEmailDeliveryLogs,
  sendTransactionalEmail,
  EMAIL_TYPES,
  DELIVERY_STATUS,
} from '../../services/transactionalEmailDeliveryService';

export default function EmailDeliveryMonitoringPanel() {
  const [logs, setLogs] = useState(() => getEmailDeliveryLogs());
  const [testEmail, setTestEmail] = useState('');
  const [selectedType, setSelectedType] = useState(EMAIL_TYPES.APPLICATION_RECEIPT);
  const [testResult, setTestResult] = useState(null);
  const [sending, setSending] = useState(false);

  const refreshLogs = () => {
    setLogs(getEmailDeliveryLogs());
  };

  const handleTestSend = async (e) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes('@')) return;

    setSending(true);
    setTestResult(null);

    const res = await sendTransactionalEmail({
      to: testEmail,
      type: selectedType,
      payload: {
        serviceName: 'Demo Civic Application',
        referenceId: 'DEMO-REF-9988',
        actionRequired: 'Verify Contact Information',
        dueDate: 'Within 7 business days',
        trackingUrl: 'https://civichelpsetu.gov.in/track',
      },
    });

    setSending(false);
    setTestResult(res);
    refreshLogs();
  };

  return (
    <div
      className="email-delivery-monitoring-panel"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '0.75rem',
        padding: '1.75rem',
        marginTop: '1.5rem',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Mail className="w-5 h-5 text-indigo-500" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              Transactional Email Delivery &amp; Sandbox Monitor
            </h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem', marginBottom: 0 }}>
            Inspect outbound transactional notifications, verify retry bounds, and test templates in simulated sandbox mode.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshLogs}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.45rem 0.85rem',
            borderRadius: '0.4rem',
            border: '1px solid var(--border-color)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: '0.825rem',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Logs
        </button>
      </div>

      {/* Safety Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          padding: '0.75rem 1rem',
          borderRadius: '0.5rem',
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          color: '#2563eb',
          fontSize: '0.825rem',
          marginBottom: '1.5rem',
        }}
      >
        <ShieldCheck className="w-4 h-4 flex-shrink-0" />
        <span>
          <strong>Data Minimization Guardrail:</strong> Outbound recipient email addresses are masked in delivery logs. Sensitive attachments or internal tokens are never logged.
        </span>
      </div>

      {/* Test Send Form */}
      <div
        style={{
          background: 'var(--bg-secondary, rgba(0,0,0,0.02))',
          padding: '1.25rem',
          borderRadius: '0.65rem',
          border: '1px solid var(--border-color)',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
          Dispatch Template Test (Sandbox Safe)
        </div>

        <form onSubmit={handleTestSend} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
              Recipient Address
            </label>
            <input
              type="email"
              required
              placeholder="test@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem',
                borderRadius: '0.4rem',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
              Select Template
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem',
                borderRadius: '0.4rem',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              <option value={EMAIL_TYPES.APPLICATION_RECEIPT}>Application Submission Receipt</option>
              <option value={EMAIL_TYPES.APPLICATION_STATUS_UPDATE}>Application Status Milestone Update</option>
              <option value={EMAIL_TYPES.DEADLINE_REMINDER}>Upcoming Due Date Reminder</option>
              <option value={EMAIL_TYPES.CHECKLIST_DISPATCH}>Document Checklist Dispatch</option>
              <option value={EMAIL_TYPES.ADMIN_OPERATIONS_DIGEST}>Administrator Operations Digest</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={sending}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.5rem 1rem',
              borderRadius: '0.4rem',
              background: 'var(--accent-main)',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: sending ? 'wait' : 'pointer',
            }}
          >
            <Send className="w-3.5 h-3.5" /> {sending ? 'Dispatching...' : 'Test Send'}
          </button>
        </form>

        {testResult && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.35rem',
              background: testResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: testResult.success ? '#059669' : '#dc2626',
              fontSize: '0.8rem',
              fontWeight: '600',
            }}
          >
            {testResult.success
              ? `Email processed (${testResult.isSandbox ? 'Simulated Sandbox Mode' : 'Live Delivery'}). Message ID: ${testResult.messageId}`
              : `Delivery failed: ${testResult.error}`}
          </div>
        )}
      </div>

      {/* Delivery Log Table */}
      <div>
        <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
          Recent Delivery Transactions ({logs.length})
        </h4>

        {logs.length === 0 ? (
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>
            No email delivery events recorded yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {logs.slice(0, 8).map((log) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.45rem',
                  border: '1px solid var(--border-color)',
                  background: 'var(--card-bg)',
                  fontSize: '0.8rem',
                }}
              >
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                    {log.subject}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    To: {log.to} | Template: {log.type} | Attempts: {log.attempts}
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '0.35rem',
                    background:
                      log.status === DELIVERY_STATUS.DELIVERED
                        ? 'rgba(16, 185, 129, 0.1)'
                        : log.status === DELIVERY_STATUS.SIMULATED
                          ? 'rgba(59, 130, 246, 0.1)'
                          : 'rgba(239, 68, 68, 0.1)',
                    color:
                      log.status === DELIVERY_STATUS.DELIVERED
                        ? '#059669'
                        : log.status === DELIVERY_STATUS.SIMULATED
                          ? '#2563eb'
                          : '#dc2626',
                  }}
                >
                  {log.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
