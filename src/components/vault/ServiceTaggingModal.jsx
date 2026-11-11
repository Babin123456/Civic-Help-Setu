import { useState } from 'react';
import { X, Tag, Check, ShieldCheck } from 'lucide-react';
import { MOCK_SERVICES } from '../../data/services';
import { tagDocumentToServiceEncrypted, untagDocumentFromServiceEncrypted } from '../../services/vaultStorage';
import { useToast } from '../../context/ToastContext';

const ServiceTaggingModal = ({
  isOpen,
  onClose,
  document: doc,
  onUpdated = () => {},
}) => {
  const { toast } = useToast();
  const [tagged, setTagged] = useState(() => doc?.taggedServices || []);

  if (!isOpen || !doc) return null;

  const handleToggleTag = async (serviceId) => {
    const isTagged = tagged.includes(serviceId);
    try {
      let updated;
      if (isTagged) {
        updated = await untagDocumentFromServiceEncrypted(doc.id, serviceId);
        setTagged(tagged.filter((s) => s !== serviceId));
        toast.info('Unlinked from service.');
      } else {
        updated = await tagDocumentToServiceEncrypted(doc.id, serviceId);
        setTagged([...tagged, serviceId]);
        toast.success('Tagged to service for fast auto-attachment!');
      }
      onUpdated(updated);
    } catch (err) {
      toast.error(err?.message || 'Could not update document service tags.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
      }}
    >
      <div
        className="card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '1.75rem',
          borderRadius: '1.25rem',
          background: 'var(--bg-card, #131b2e)',
          border: '1px solid var(--border-main)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Tag size={20} color="var(--accent-main)" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>
              Tag Services to {doc.type}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Select the civic procedures where this document serves as mandatory identity, age, or address proof.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '340px', overflowY: 'auto', marginBottom: '1.25rem' }}>
          {MOCK_SERVICES.map((srv) => {
            const isSelected = tagged.includes(srv.id);
            return (
              <div
                key={srv.id}
                onClick={() => handleToggleTag(srv.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.6rem',
                  background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                  border: isSelected ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div>
                  <div style={{ fontWeight: isSelected ? '700' : '500', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {srv.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    {srv.category}
                  </div>
                </div>

                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '4px',
                    border: isSelected ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
                    background: isSelected ? 'var(--accent-main)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isSelected && <Check size={14} color="var(--bg-main)" />}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onClose}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceTaggingModal;
