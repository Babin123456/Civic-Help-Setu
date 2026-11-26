import { BadgeCheck, KeyRound, PauseCircle, RefreshCw, ShieldOff, Trash2 } from 'lucide-react';

const stateTone = (state) => {
  if (state === 'active') return { color: '#047857', borderColor: 'rgba(16, 185, 129, 0.45)', background: 'rgba(16, 185, 129, 0.12)' };
  if (state === 'pending') return { color: '#92400e', borderColor: 'rgba(245, 158, 11, 0.45)', background: 'rgba(245, 158, 11, 0.12)' };
  return { color: '#b91c1c', borderColor: 'rgba(220, 38, 38, 0.45)', background: 'rgba(220, 38, 38, 0.1)' };
};

const buttonStyle = { display: 'inline-flex', alignItems: 'center', gap: '0.3rem' };

export default function CivicDataApiClientCard({ client, canAdmin, onApprove, onSuspend, onRevoke, onCreateKey, onRotateKey, onRevokeKey }) {
  const activeKeys = client.keys.filter((key) => key.state === 'active');
  return (
    <article aria-labelledby={`client-${client.id}`} style={{ border: '1px solid var(--border-main)', borderRadius: '0.8rem', padding: '1rem', display: 'grid', gap: '0.7rem', background: 'var(--bg-surface)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <h4 id={`client-${client.id}`} style={{ margin: 0 }}>{client.name}</h4>
          <p style={{ margin: '0.2rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {client.environment} · {client.jurisdiction.state} / {client.jurisdiction.district}
          </p>
        </div>
        <span style={{ ...stateTone(client.state), border: '1px solid', borderRadius: '999px', padding: '0.15rem 0.55rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize' }}>
          {client.state}
        </span>
      </div>

      {client.description && <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{client.description}</p>}

      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <strong>Datasets:</strong> {client.allowedDatasetIds.join(', ')} · <strong>Quota:</strong> {client.dailyQuota}/day · <strong>Rate:</strong> {client.rateLimitPerMinute}/min
      </p>

      <div>
        <h5 style={{ margin: '0 0 0.35rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <KeyRound size={15} aria-hidden="true" /> API keys
        </h5>
        {client.keys.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No keys yet. Create one to call the sandbox.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.45rem' }}>
            {client.keys.map((key) => (
              <li key={key.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', border: '1px solid var(--border-main)', borderRadius: '0.5rem', padding: '0.45rem 0.6rem', fontSize: '0.85rem' }}>
                <span>
                  <code>{key.keyPrefix}…{key.keyLast4}</code> · {key.label} · <span style={{ textTransform: 'capitalize' }}>{key.state}</span>
                  {key.lastUsedAt && <span style={{ color: 'var(--text-secondary)' }}> · last used {new Date(key.lastUsedAt).toLocaleString()}</span>}
                </span>
                {key.state === 'active' && (
                  <span style={{ display: 'flex', gap: '0.35rem' }}>
                    <button type="button" className="btn btn-secondary" style={buttonStyle} onClick={() => onRotateKey(key.id)}>
                      <RefreshCw size={13} aria-hidden="true" /> Rotate
                    </button>
                    <button type="button" className="btn btn-secondary" style={buttonStyle} onClick={() => onRevokeKey(key.id)}>
                      <Trash2 size={13} aria-hidden="true" /> Revoke
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
        {client.state === 'active' && (
          <button type="button" className="btn btn-primary" style={buttonStyle} onClick={() => onCreateKey(client.id)}>
            <KeyRound size={14} aria-hidden="true" /> Create key
          </button>
        )}
        {client.state === 'pending' && canAdmin && (
          <button type="button" className="btn btn-primary" style={buttonStyle} onClick={() => onApprove(client.id)}>
            <BadgeCheck size={14} aria-hidden="true" /> Approve
          </button>
        )}
        {(client.state === 'active' || client.state === 'pending') && canAdmin && (
          <button type="button" className="btn btn-secondary" style={buttonStyle} onClick={() => onSuspend(client.id)} disabled={client.state !== 'active'}>
            <PauseCircle size={14} aria-hidden="true" /> Suspend
          </button>
        )}
        {client.state !== 'revoked' && (
          <button type="button" className="btn btn-secondary" style={buttonStyle} onClick={() => onRevoke(client.id)}>
            <ShieldOff size={14} aria-hidden="true" /> Revoke
          </button>
        )}
        <span style={{ alignSelf: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          {activeKeys.length} active {activeKeys.length === 1 ? 'key' : 'keys'}
        </span>
      </div>
    </article>
  );
}
