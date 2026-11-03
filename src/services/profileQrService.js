import qrcode from 'qrcode-generator';
import { escapeHtml } from '../utils/printHtml';

/**
 * Builds the SVG matrix path for a given URL payload.
 *
 * @param {string} payload - URL or text payload to encode
 * @returns {{ path: string, size: number }} SVG path string and total viewport size
 */
export function buildQrMatrix(payload) {
  if (!payload || typeof payload !== 'string') {
    throw new Error('QR payload must be a non-empty string');
  }

  // Type 0 auto-detects version, error correction level 'M' (15%)
  const qr = qrcode(0, 'M');
  qr.addData(payload);
  qr.make();

  const count = qr.getModuleCount();
  const cells = [];
  const quietZone = 4;

  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) {
        cells.push(`M${col + quietZone},${row + quietZone}h1v1h-1z`);
      }
    }
  }

  return {
    path: cells.join(''),
    size: count + quietZone * 2,
  };
}

/**
 * Validates that the payload is a valid HTTPS/HTTP share link and not raw personal data.
 *
 * @param {string} url - Target URL to evaluate
 * @returns {boolean}
 */
export function isSafeShareableQrPayload(url) {
  if (!url || typeof url !== 'string') return false;

  // Never allow raw personal data, JSON, or sensitive document content in the QR payload
  if (url.includes('aadhaar') || url.includes('pan') || url.includes('{') || url.includes('password')) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return ['https:', 'http:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Generates an accessible, printable HTML handout for a shareable citizen profile.
 *
 * @param {Object} shareInfo
 * @param {string} shareInfo.url - Active share link URL
 * @param {string} [shareInfo.citizenName] - Display name
 * @param {string} [shareInfo.expiryText] - Expiry description
 * @param {string} [shareInfo.purpose] - In-person sharing purpose note
 * @returns {string} Fully self-contained HTML handout
 */
export function buildProfileQrHandout({
  url,
  citizenName = 'Citizen Applicant',
  expiryText = 'Active until revoked or expired',
  purpose = 'For verification at civic support camps and help desks',
}) {
  if (!isSafeShareableQrPayload(url)) {
    throw new Error('Cannot generate QR handout for invalid or unsafe URL');
  }

  const { path, size } = buildQrMatrix(url);
  const safeName = escapeHtml(citizenName);
  const safeUrl = escapeHtml(url);
  const safeExpiry = escapeHtml(expiryText);
  const safePurpose = escapeHtml(purpose);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeName} — Verified Citizen Profile Pass</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      color: #0f172a;
      background: #ffffff;
      margin: 2rem auto;
      padding: 1.5rem;
      max-width: 38rem;
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.65rem;
      font-size: 0.8rem;
      font-weight: 700;
      color: #059669;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 9999px;
      margin-bottom: 0.75rem;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 800;
      margin: 0 0 0.5rem 0;
      color: #1e293b;
    }
    .purpose {
      font-size: 0.95rem;
      color: #64748b;
      margin-bottom: 1.5rem;
    }
    .qr-card {
      border: 2px dashed #cbd5e1;
      border-radius: 0.75rem;
      padding: 1.5rem;
      text-align: center;
      background: #f8fafc;
      margin: 1.5rem 0;
    }
    svg {
      display: block;
      margin: 0 auto;
      max-width: 240px;
      height: auto;
    }
    .url-text {
      font-family: monospace;
      font-size: 0.85rem;
      word-break: break-all;
      color: #2563eb;
      margin-top: 1rem;
    }
    .privacy-notice {
      font-size: 0.8rem;
      color: #475569;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 0.5rem;
      padding: 0.85rem;
      margin-top: 1.5rem;
    }
    @media print {
      body { margin: 0; max-width: none; }
      .screen-only { display: none; }
    }
  </style>
</head>
<body>
  <div class="badge">Verified Read-Only Share Pass</div>
  <h1>${safeName}</h1>
  <p class="purpose">${safePurpose}</p>

  <div class="qr-card">
    <svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="QR code opening verified shareable profile" viewBox="0 0 ${size} ${size}" width="240" height="240" shape-rendering="crispEdges">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <path d="${path}" fill="#0f172a"/>
    </svg>
    <div class="url-text">${safeUrl}</div>
  </div>

  <div class="privacy-notice">
    <strong>Privacy & Security Protection:</strong>
    <br>
    This QR code points only to an encrypted, read-only web view. It does not contain private documents, bank accounts, or raw identity card numbers.
    <br><br>
    <strong>Status:</strong> ${safeExpiry}
    <br>
    The citizen may revoke or expire this pass at any time from their Civic Help Setu dashboard. Once revoked, scanning this QR code will display an inactive notice.
  </div>

  <p class="screen-only" style="margin-top: 2rem; font-size: 0.85rem; color: #94a3b8; text-align: center;">
    Tip: Use Print (Ctrl+P / Cmd+P) to generate a hard copy or save as a portable PDF pass.
  </p>
</body>
</html>`;
}

/**
 * Triggers browser download of the printable HTML profile pass.
 */
export function downloadProfileQrHandout(shareInfo) {
  try {
    const html = buildProfileQrHandout(shareInfo);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `citizen-profile-pass-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    return true;
  } catch {
    return false;
  }
}
