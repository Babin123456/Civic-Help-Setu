import { MOCK_SERVICES } from '../data/services';
import { escapeHtml } from '../utils/printHtml';
import qrcode from 'qrcode-generator';

// Custom catalogue records are localStorage-only and cannot be resolved on a
// recipient's phone. Only bundled public routes are shareable across devices.
const publicIds = new Set(MOCK_SERVICES.map((service) => service.id));

export const canShareServiceQr = (service, { preview = false } = {}) =>
  Boolean(service && !preview && service.archived !== true && publicIds.has(service.id));

export const serviceQrUrl = (service, origin) => {
  if (!canShareServiceQr(service)) return null;
  const base = new URL(origin);
  if (!['https:', 'http:'].includes(base.protocol)) throw new Error('Invalid site origin');
  return new URL(`/services/${encodeURIComponent(service.id)}`, base.origin).href;
};

// Render the matrix ourselves so React and the downloaded document can use SVG
// without injecting library-generated HTML. Four modules form the quiet zone.
export const qrMatrixPath = (url) => {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const count = qr.getModuleCount();
  const cells = [];
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) cells.push(`M${col + 4},${row + 4}h1v1h-1z`);
    }
  }
  return { path: cells.join(''), size: count + 8 };
};

export const buildServiceQrHandout = (service, origin) => {
  const url = serviceQrUrl(service, origin);
  if (!url) return null;
  const { path, size } = qrMatrixPath(url);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(service.name)} — service handout</title><style>body{font:18px/1.5 system-ui,sans-serif;color:#000;background:#fff;margin:2rem auto;padding:1rem;max-width:40rem}svg{display:block;width:240px;height:240px;margin:1rem 0}a{color:#000;overflow-wrap:anywhere}@media print{body{margin:0;max-width:none}.screen-only{display:none}}</style></head><body><h1>${escapeHtml(service.name)}</h1><p>Department: ${escapeHtml(service.department || 'See service guide')}</p><svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="QR code opening the service guide" viewBox="0 0 ${size} ${size}" width="240" height="240" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg><p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p><p>Scan to open the current public guide. Requirements may change; verify details with the relevant department.</p><p class="screen-only">Use your browser's Print command to print this handout or save it as PDF. The QR image is embedded and works without an internet connection; opening the destination guide still requires connectivity.</p></body></html>`;
};

export const downloadServiceQrHandout = (service, origin) => {
  const html = buildServiceQrHandout(service, origin);
  if (!html) return false;
  const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = 'civic-service-handout.html';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser time to start the download before releasing the Blob.
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  return true;
};
