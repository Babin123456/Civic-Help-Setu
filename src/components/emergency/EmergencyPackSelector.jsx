import React, { useState, useCallback } from 'react';
import { INDIAN_STATES_AND_UTS } from '../../data/jurisdictions.js';
import { EMERGENCY_PACKS, EMERGENCY_PACK_VERSION } from '../../data/emergencyPacks.js';

export default function EmergencyPackSelector({ onSelect, onDownload }) {
  const [selectedState, setSelectedState] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [showDownload, setShowDownload] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleStateChange = useCallback((state) => {
    setSelectedState(state);
    setSelectedDistrict(null);
    setShowDownload(false);
    onSelect?.(state);
  }, [onSelect]);

  const handleDownload = useCallback(async () => {
    if (!selectedState) return;

    setIsDownloading(true);
    try {
      const pack = EMERGENCY_PACKS[selectedState];
      if (!pack) return;

      const packData = {
        ...pack,
        selectedDistrict: selectedDistrict || 'All Districts',
        downloadedAt: new Date().toISOString()
      };

      const jsonString = JSON.stringify(packData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });

      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `emergency-pack-${selectedState.replace(/\s+/g, '-').toLowerCase()}-${timestamp}.json`;

      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.download = fileName;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);

      URL.revokeObjectURL(url);

      setShowDownload(true);
      onDownload?.(selectedState);
    } catch (error) {
      console.error('Failed to download emergency pack:', error);
    } finally {
      setIsDownloading(false);
    }
  }, [selectedState, selectedDistrict, onDownload]);

  const handlePrint = useCallback(() => {
    const pack = EMERGENCY_PACKS[selectedState];
    if (!pack) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Emergency Preparedness Pack - ${selectedState}</title>
          <style>
            body { font-family: system-ui, sans-serif; margin: 20px; line-height: 1.6; color: #1e293b; }
            h1 { color: #dc2626; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
            h2 { color: #64748b; margin-top: 30px; }
            .meta { color: #64748b; font-size: 0.85rem; margin-bottom: 20px; }
            .section { margin-bottom: 20px; }
            .contact { margin: 10px 0; padding: 8px; background: #f8fafc; border-radius: 6px; }
            .checklist { margin: 10px 0; }
            .checklist-item { margin: 8px 0; }
            .essential { color: #dc2626; font-weight: 600; }
            .stale-warning { color: #dc2626; font-size: 0.8rem; margin-top: 10px; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <h1>Civic Emergency Preparedness Pack</h1>
          <h2>${selectedState}</h2>
          <div class="meta">
            <strong>Last Generated:</strong> ${new Date().toLocaleDateString()}<br/>
            <strong>Review Date:</strong> ${new Date(pack.expires).toLocaleDateString()}<br/>
            <strong>Last Reviewed:</strong> ${new Date(pack.lastReviewed).toLocaleDateString()}
          </div>
          <div class="stale-warning">
            ${new Date() > new Date(pack.expires) ? '⚠️ This information may be stale. Please reconnect to update.' : ''}
          </div>

          <div class="section">
            <h3>National Emergency Helplines</h3>
            ${pack.nationalHelplines.map((h) => `
              <div class="contact">
                <strong>${h.name}</strong>: ${h.number}<br/>
                <small>${h.description}</small><br/>
                <small>${h.timing} | ${h.tollFree ? 'Toll-free' : ''}</small>
              </div>
            `).join('')}
          </div>

          <div class="section">
            <h3>Preparedness Checklist</h3>
            <div class="checklist">
              ${pack.preparednessChecklist.emergencyKitEssentials.map((item) => `
                <div class="checklist-item">
                  <span class="${item.essential ? 'essential' : ''}</span>
                  ${item.item}
                </div>
              `).join('')}
            </div>
            <div class="checklist">
              ${pack.preparednessChecklist.floodPreparation.map((item) => `
                <div class="checklist-item">
                  <span class="${item.essential ? 'essential' : ''}</span>
                  ${item.item}
                </div>
              `).join('')}
            </div>
            <div class="checklist">
              ${pack.preparednessChecklist.heatwavePreparation.map((item) => `
                <div class="checklist-item">
                  <span class="${item.essential ? 'essential' : ''}</span>
                  ${item.item}
                </div>
              `).join('')}
            </div>
            <div class="checklist">
              ${pack.preparednessChecklist.cyclonePreparation.map((item) => `
                <div class="checklist-item">
                  <span class="${item.essential ? 'essential' : ''}</span>
                  ${item.item}
                </div>
              `).join('')}
            </div>
          </div>

          <div class="section">
            <h3>Source Links</h3>
            <p>National Disaster Management Authority: ${pack.sourceUrl}</p>
            <p>For district-specific contacts, please consult local government authorities.</p>
          </div>

          <div class="meta">
            <small>Pack version: ${EMERGENCY_PACK_VERSION}</small><br/>
            <small>Information cached for offline use. Verify with official sources.</small>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }, [selectedState]);

  return (
    <div style={{ padding: '24px' }}>
      <h2>Offline Emergency Preparedness Pack</h2>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
          Select State / UT:
        </label>
        <select
          value={selectedState}
          onChange={(e) => handleStateChange(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: '1rem',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            background: '#fff',
          }}
        >
          <option value="">-- Select a state or UT --</option>
          {INDIAN_STATES_AND_UTS.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </div>

      {selectedState && (
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
            District (if applicable):
          </label>
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '1rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              background: '#fff',
            }}
          >
            <option value="">All Districts</option>
            {EMERGENCY_PACKS[selectedState]?.districtContacts
              ? Object.keys(EMERGENCY_PACKS[selectedState].districtContacts).map(
                  (district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  )
                )
              : null}
          </select>
        </div>
      )}

      {selectedState && (
        <div style={{ marginTop: '20px' }}>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            style={{
              width: '100%',
              padding: '10px 16px',
              fontSize: '1rem',
              fontWeight: 600,
              border: 'none',
              borderRadius: '6px',
              background: '#3b82f6',
              color: '#fff',
              cursor: isDownloading ? 'wait' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {isDownloading ? 'Downloading...' : 'Download Offline Pack'}
          </button>
          <button
            onClick={handlePrint}
            style={{
              width: '100%',
              padding: '10px 16px',
              fontSize: '1rem',
              marginTop: '8px',
              fontWeight: 600,
              border: 'none',
              borderRadius: '6px',
              background: '#10b981',
              color: '#fff',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            Print Ready-to-Use Format
          </button>
        </div>
      )}

      {showDownload && (
        <div style={{ marginTop: '16px', padding: '12px', background: '#f0f4ff', borderRadius: '6px' }}>
          <p style={{ margin: 0, color: '#1e293b' }}>
            Emergency pack downloaded successfully for <strong>{selectedState}</strong>{selectedDistrict ? ` - ${selectedDistrict}` : ''}.
          </p>
          <button
            onClick={() => setShowDownload(false)}
            style={{
              marginTop: '8px',
              padding: '4px 12px',
              border: 'none',
              borderRadius: '4px',
              background: '#64748b',
              color: '#fff',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}