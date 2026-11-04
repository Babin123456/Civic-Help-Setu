import { canShareServiceQr, downloadServiceQrHandout, qrMatrixPath, serviceQrUrl } from '../../services/serviceQrHandout';

export default function ServiceQrHandout({ service, preview = false }) {
  if (!canShareServiceQr(service, { preview }) || typeof window === 'undefined') return null;
  const url = serviceQrUrl(service, window.location.origin);
  const { path, size } = qrMatrixPath(url);
  return (
    <details className="glass-panel" style={{ padding: '1rem', marginTop: '1rem' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Show QR code</summary>
      <p>Scan to open this public service guide on another device.</p>
      <svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Scan QR to open service guide" viewBox={`0 0 ${size} ${size}`} width="240" height="240" style={{ maxWidth: '100%', height: 'auto' }} shapeRendering="crispEdges">
        <rect width="100%" height="100%" fill="#fff" />
        <path d={path} fill="#000" />
      </svg>
      <p style={{ overflowWrap: 'anywhere' }}><a href={url}>{url}</a></p>
      <p>The QR image is generated on this device. No application or profile data is included.</p>
      <button type="button" className="btn btn-secondary" onClick={() => downloadServiceQrHandout(service, window.location.origin)}>
        Download printable handout
      </button>
      <p>Open the downloaded HTML file and use your browser's Print command. Black text and a white background keep the handout readable in grayscale.</p>
    </details>
  );
}
