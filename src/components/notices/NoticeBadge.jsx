import React, { useState, useEffect } from 'react';
import { FileText, ChevronRight } from 'lucide-react';
import { getNoticesForService } from '../../services/noticeDigestService';
import PublicNoticeDigestModal from './PublicNoticeDigestModal';

const NoticeBadge = ({ serviceId, serviceName }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    if (serviceId) {
      setNotices(getNoticesForService(serviceId, null, true));
    }
  }, [serviceId]);

  if (!notices || notices.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="glass-panel"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.4rem 0.85rem',
          borderRadius: '99px',
          background: 'rgba(56, 189, 248, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          color: 'var(--accent-main, #38bdf8)',
          fontSize: '0.825rem',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        aria-label={`View ${notices.length} official notice${notices.length > 1 ? 's' : ''} for ${serviceName}`}
      >
        <FileText size={15} />
        <span>
          {notices.length} Gazette / Official Notice{notices.length > 1 ? 's' : ''} Active
        </span>
        <ChevronRight size={14} />
      </button>

      <PublicNoticeDigestModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        serviceId={serviceId}
        serviceName={serviceName}
      />
    </>
  );
};

export default NoticeBadge;
