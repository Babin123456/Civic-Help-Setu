import React from 'react';
import { stripUrlForSharing } from '../../utils/dataMinimization';

const QRCodeView = ({ url, size = 180 }) => {
  // Only origin + path goes to the QR service, never a query string or fragment.
  const encoded = encodeURIComponent(stripUrlForSharing(url || window.location.href));
  const qrEndpoint = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=10`;

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0.75rem',
        background: '#ffffff',
        borderRadius: '1rem',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
      }}
    >
      <img
        src={qrEndpoint}
        alt="Scan QR to open on mobile"
        width={size}
        height={size}
        style={{ display: 'block', borderRadius: '0.5rem' }}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <span style={{ fontSize: '0.75rem', color: '#4b5563', marginTop: '0.4rem', fontWeight: '600' }}>
        Scan to view on Mobile
      </span>
    </div>
  );
};

export default QRCodeView;
