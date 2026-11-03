import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Trash2,
  Check,
  AlertTriangle,
  Mail,
  History,
  Lock,
} from 'lucide-react';
import {
  createHelperInvitation,
  revokeHelperDelegation,
  getCitizenHelperOverview,
  HELPER_PERMISSIONS,
} from '../../services/helperAccessWorkflowService';

export default function HelperAccessManagementPanel({
  currentUser,
  userApplications = [],
}) {
  const userId = currentUser?.id || currentUser?.username || 'current_user';
  const userName = currentUser?.name || currentUser?.username || 'Citizen Applicant';

  const [overview, setOverview] = useState(() => getCitizenHelperOverview(userId));
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [helperEmail, setHelperEmail] = useState('');
  const [helperName, setHelperName] = useState('');
  const [relationship, setRelationship] = useState('Family Member');
  const [allowDocuments, setAllowDocuments] = useState(false);
  const [notice, setNotice] = useState(null);

  const refreshData = () => {
    setOverview(getCitizenHelperOverview(userId));
  };

  const handleSendInvite = (e) => {
    e.preventDefault();
    if (!helperEmail.trim() || !helperEmail.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    const permissions = [
      HELPER_PERMISSIONS.VIEW_MILESTONES,
      HELPER_PERMISSIONS.VIEW_DEADLINES,
      ...(allowDocuments ? [HELPER_PERMISSIONS.VIEW_DOCUMENTS] : []),
    ];

    try {
      createHelperInvitation(
        userId,
        userName,
        { email: helperEmail, name: helperName, relationship },
        userApplications.map((a) => a.id || a._id),
        permissions
      );

      setHelperEmail('');
      setHelperName('');
      setAllowDocuments(false);
      setShowInviteModal(false);
      refreshData();
      setNotice('Helper invitation sent via email with time-limited access link.');
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRevoke = (delegationId) => {
    revokeHelperDelegation(delegationId, userId);
    refreshData();
    setNotice('Helper access revoked immediately.');
    setTimeout(() => setNotice(null), 4000);
  };

  return (
    <div
      className="helper-access-panel"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '0.75rem',
        padding: '1.75rem',
        marginTop: '1.5rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users className="w-5 h-5 text-indigo-500" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              Trusted Helper & Emergency Contact Access
            </h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem', marginBottom: 0 }}>
            Delegate read-only milestone visibility to trusted family members or facilitators without sharing account passwords.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowInviteModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 0.95rem',
            borderRadius: '0.45rem',
            background: 'var(--accent-main)',
            color: '#ffffff',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          <UserPlus className="w-4 h-4" /> Invite Helper
        </button>
      </div>

      {/* Safety Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.75rem 1rem',
          borderRadius: '0.5rem',
          background: 'rgba(14, 165, 233, 0.08)',
          border: '1px solid rgba(14, 165, 233, 0.25)',
          color: '#0284c7',
          fontSize: '0.825rem',
          marginBottom: '1.25rem',
        }}
      >
        <ShieldCheck className="w-4 h-4 flex-shrink-0" />
        <span>
          <strong>Consent Protection:</strong> Helpers can only view application milestones and timelines.
          They can never edit profile details, change login credentials, or submit applications on your behalf.
        </span>
      </div>

      {notice && (
        <div
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '0.45rem',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#059669',
            fontSize: '0.85rem',
            fontWeight: '600',
            marginBottom: '1rem',
          }}
        >
          {notice}
        </div>
      )}

      {/* Active Helpers */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
          Active Delegations ({overview.activeHelpers.length})
        </h4>

        {overview.activeHelpers.length === 0 ? (
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>
            No trusted helpers have active access to your applications.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {overview.activeHelpers.map((helper) => (
              <div
                key={helper.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-secondary, rgba(0,0,0,0.02))',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                    {helper.helperName} ({helper.helperEmail})
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Relationship: {helper.relationship} | Accepted on: {new Date(helper.acceptedAt).toLocaleDateString()}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRevoke(helper.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '0.35rem',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    background: 'rgba(239, 68, 68, 0.08)',
                    color: '#dc2626',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Revoke Access
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      {overview.pendingInvitations.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            Pending Invitations ({overview.pendingInvitations.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {overview.pendingInvitations.map((inv, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.45rem',
                  background: 'rgba(245, 158, 11, 0.05)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                }}
              >
                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  Invitation sent to <strong>{inv.helperEmail}</strong> ({inv.relationship})
                </div>
                <div style={{ fontSize: '0.75rem', color: '#d97706', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Clock className="w-3.5 h-3.5" /> Awaiting acceptance
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit History */}
      {overview.auditLogs.length > 0 && (
        <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <History className="w-3.5 h-3.5" /> Recent Access Audit Log
          </h4>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {overview.auditLogs.slice(0, 3).map((log) => (
              <div key={log.id}>
                • {new Date(log.timestamp).toLocaleTimeString()}: {log.action} for {log.helperEmail}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal for Helper Invitation */}
      {showInviteModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--card-bg)',
              borderRadius: '0.75rem',
              maxWidth: '480px',
              width: '100%',
              padding: '1.75rem',
              border: '1px solid var(--border-color)',
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 1rem 0' }}>
              Invite Trusted Helper
            </h3>

            <form onSubmit={handleSendInvite} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}>
                  Helper Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="family@example.com"
                  value={helperEmail}
                  onChange={(e) => setHelperEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}>
                  Helper Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={helperName}
                  onChange={(e) => setHelperName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}>
                  Relationship / Role
                </label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="Family Member">Family Member</option>
                  <option value="Emergency Contact">Emergency Contact</option>
                  <option value="Community Volunteer">Community Volunteer</option>
                  <option value="Legal Facilitator">Legal Facilitator</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <input
                  type="checkbox"
                  id="docConsent"
                  checked={allowDocuments}
                  onChange={(e) => setAllowDocuments(e.target.checked)}
                />
                <label htmlFor="docConsent" style={{ fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Explicit Consent: Allow helper to view attached application documents (disabled by default)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.55rem 1.1rem',
                    borderRadius: '0.4rem',
                    background: 'var(--accent-main)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
