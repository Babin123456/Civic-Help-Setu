import React, { useEffect, useState } from 'react';
import { EMERGENCY_PACK_STORAGE_KEY, EMERGENCY_PACK_META } from '../../data/emergencyPacks.js';

const STALE_THRESHOLD_DAYS = 180;

export default function EmergencyPackDisplay({ packId }) {
  const [pack, setPack] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    if (!packId) {
      setIsLoading(false);
      return;
    }

    try {
      const stored = localStorage.getItem(packId);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPack(parsed);
        setFromCache(true);
      } else {
        const fromStorage = localStorage.getItem(EMERGENCY_PACK_STORAGE_KEY);
        if (fromStorage) {
          const storageData = JSON.parse(fromStorage);
          const cachedPack = storageData[packId];
          if (cachedPack) {
            setPack(cachedPack);
            setFromCache(false);
          }
        }
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load emergency pack:', error);
      setIsLoading(false);
    }
  }, [packId]);

  const isStale = pack
    ? new Date() > new Date(pack.expires)
    : false;

  const daysSinceLastReview = pack
    ? Math.floor(
        (new Date().getTime() - new Date(pack.lastReviewed).getTime()) / (1000 * 60 * 60 * 24)
      )
    : null;

  const daysUntilReview =
    pack && EMERGENCY_PACK_META.reviewCycleMonths
      ? Math.ceil(
          (new Date(pack.expires).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        )
      : null;

  if (isLoading || !pack) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Emergency pack not found. Please select a state/district first.</p>
      </div>
    );
  }

  const getPrintContent = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const staleWarning = isStale
      ? '<div style="color: #dc2626; font-size: 0.85rem; margin-top: 10px; padding: 8px; background: #fee2e2; border: 1px solid #fca5a5; border-radius: 4px;">⚠️ Warning: This cached information may be stale. Please reconnect to update.</div>'
      : '';

    printWindow.document.write(`
      <html>
        <head>
          <title>Emergency Preparedness Pack - ${pack.state}</title>
          <style>
            body { font-family: system-ui, sans-serif; margin: 20px; line-height: 1.6; color: #1e293b; }
            h1 { color: #dc2626; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
            .meta { color: #64748b; font-size: 0.85rem; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e2e8f0; }
            .section { margin-bottom: 20px; }
            .contact { margin: 10px 0; padding: 8px; background: #f8fafc; border-radius: 6px; border-left: 3px solid #3b82f6; }
            .contact strong { color: #1e293b; }
            .checklist { margin: 10px 0; }
            .checklist-item { margin: 6px 0; display: flex; align-items: center; gap: 8px; }
            .essential { color: #dc2626; font-weight: 600; }
            .stale-warning { color: #dc2626; font-size: 0.85rem; margin-top: 10px; padding: 8px; background: #fee2e2; border-radius: 4px; border: 1px solid #fca5a5; }
            a { color: #3b82f6; text-decoration: underline; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <h1>Emergency Preparedness Pack</h1>
          <h2>${pack.state}</h2>

          <div class="meta">
            <strong>Last Generated:</strong> ${new Date(pack.downloadedAt || pack.published).toLocaleDateString()}<br/>
            <strong>Review Date:</strong> ${new Date(pack.expires).toLocaleDateString()}<br/>
            <strong>Last Reviewed:</strong> ${new Date(pack.lastReviewed).toLocaleDateString()}
          </div>

          ${staleWarning}

          <div class="section">
            <h3>National Emergency Helplines</h3>
            ${pack.nationalHelplines.map(
              (h) => `
              <div class="contact">
                <strong>${h.name}:</strong> ${h.number}<br/>
                <small>${h.description}</small><br/>
                <small>${h.timing} | ${h.tollFree ? 'Toll-free' : ''}</small>
              </div>
            `).join('')}
          </div>

          <div class="section">
            <h3>Preparedness Checklist</h3>
            <div class="checklist">
              ${pack.preparednessChecklist.emergencyKitEssentials.map(
                (item) => `
                <div class="checklist-item">
                  <input type="checkbox" ${item.essential ? 'disabled' : ''} />
                  <span class="${item.essential ? 'essential' : ''}">
                    ${item.item}
                  </span>
                </div>
              `).join('')}
            </div>
            <div class="checklist">
              ${pack.preparednessChecklist.floodPreparation.map(
                (item) => `
                <div class="checklist-item">
                  <input type="checkbox" ${item.essential ? 'disabled' : ''} />
                  <span class="${item.essential ? 'essential' : ''}">
                    ${item.item}
                  </span>
                </div>
              `).join('')}
            </div>
            <div class="checklist">
              ${pack.preparednessChecklist.heatwavePreparation.map(
                (item) => `
                <div class="checklist-item">
                  <input type="checkbox" ${item.essential ? 'disabled' : ''} />
                  <span class="${item.essential ? 'essential' : ''}">
                    ${item.item}
                  </span>
                </div>
              `).join('')}
            </div>
            <div class="checklist">
              ${pack.preparednessChecklist.cyclonePreparation.map(
                (item) => `
                <div class="checklist-item">
                  <input type="checkbox" ${item.essential ? 'disabled' : ''} />
                  <span class="${item.essential ? 'essential' : ''}">
                    ${item.item}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="section">
            <h3>District-Specific Contacts</h3>
            ${Object.entries(pack.districtContacts || {}).map(
              ([district, contacts]) => `
              <div>
                <strong>${district}:</strong>
                ${Array.isArray(contacts)
                  ? contacts.map((c) => `<br/>• ${c}`).join('')
                  : contacts
              </div>
            `).join('')}
            </div>
          </div>

          <div class="section">
            <h3>Source Links</h3>
            <p>National Disaster Management Authority: ${pack.sourceUrl}</p>
            <p>For updated information, visit official disaster management guidelines.</p>
          </div>

          <div class="meta">
            <small>Pack version: ${EMERGENCY_PACK_META.version}</small><br/>
            <small>Information cached for offline use. Verify with official sources.${daysUntilReview ? ` • Next review due: ${daysUntilReview} days` : ''}</small>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const downloadJson = useCallback(() => {
    const jsonString = JSON.stringify(pack, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `emergency-pack-${pack.state.replace(/\s+/g, '-').toLowerCase()}-${timestamp}.json`;

    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = fileName;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);
  }, [pack]);

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      {isLoading ? (
        <p>Loading emergency pack...</p>
      ) : null}

      {!isLoading && pack && (
        <div>
          <h2>Emergency Preparedness Pack - {pack.state}</h2>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <strong>Last Generated:</strong> {new Date(pack.downloadedAt || pack.published).toLocaleDateString()}
                <br/>
                <strong>Review Date:</strong> {new Date(pack.expires).toLocaleDateString()}
              </div>
              <div>
                <strong>Last Reviewed:</strong> {new Date(pack.lastReviewed).toLocaleDateString()}
              </div>
            </div>

            <div style={{ margin: '16px 0', padding: '12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#dc2626' }}>
              ⚠️ <strong>Warning:</strong> This cached information may be stale (last reviewed {daysSinceLastReview > 0 ? `${daysSinceLastReview} days ago` : 'unknown'}). Please reconnect to update the pack.
            </div>

            {daysUntilReview && (
              <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                Next scheduled review: {daysUntilReview} days
              </div>
            )}
          </div>

          <div style={{ marginBottom: '24px' }}>
            <h3>National Emergency Helplines</h3>
            {pack.nationalHelplines.map((h) => (
              <div style={{ margin: '8px 0', padding: '6px 12px', background: '#f1f5f9', borderRadius: '4px' }}>
                <strong>{h.name}</strong>: {h.number}<br/>
                <small>{h.description}</small><br/>
                <small>{h.timing} | {h.tollFree ? 'Toll-free' : ''}</small>
              </div>
            ))}
          </div>

          <div>
            <h3>Preparedness Checklist</h3>
            {Object.entries(pack.preparednessChecklist).map(
              ([category, items]) => (
                <div key={category} style={{ marginTop: '16px' }}>
                  <strong>{category.replace(/([A-Z])/g, ' $1').trim()}</strong>
                  {items.map((item) => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                      <input type="checkbox" disabled={item.essential} />
                      <span style={{ flex: 1, color: item.essential ? '#0f172a' : '#475569', fontWeight: item.essential ? 600 : 400 }}>
                        {item.item}
                      </span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {Object.keys(pack.districtContacts || {}).length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <h3>District-Specific Contacts</h3>
              {Object.entries(pack.districtContacts || {}).map(
                ([district, contacts]) => (
                  <div key={district} style={{ margin: '12px 0', padding: '8px', background: '#f8fafc', borderRadius: '4px' }}>
                    <strong>{district}:</strong>
                    {Array.isArray(contacts)
                      ? contacts.map((c) => (
                          <div key={c} style={{ margin: '4px 0' }}>
                            • {c}
                          </div>
                        ))
                      : (
                        <div style={{ margin: '4px 0' }}>{contacts}
                        </div>
                      )}
                  </div>
                )
              )}
            </div>
          )}

          <div style={{ marginTop: '24px' }}>
            <h3>Source Links</h3>
            <p>National Disaster Management Authority: <a href={pack.sourceUrl} target="_blank" rel="noopener noreferrer">{pack.sourceUrl}</a></p>
            <p>For updated information, visit official disaster management guidance.</p>
          </div>

          <div style={{ marginTop: '32px', padding: '16px', background: '#f0f4ff', borderRadius: '6px' }}>
            <small>
              Pack version: ${EMERGENCY_PACK_META.version} | 
              Information cached for offline use. 
              Verify with official sources.{' '}
              {daysUntilReview && `Next review due in ${daysUntilReview} days.`}
            </small>
          </div>

          <div style={{ marginTop: '32px', display: 'flex', gap: '16px' }}>
            <button
              onClick={downloadJson}
              style={{
                flex: 1,
                padding: '10px 16px',
                fontSize: '1rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                background: '#3b82f6',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Download JSON Pack
            </button>
            <button
              onClick={getPrintContent}
              style={{
                flex: 1,
                padding: '10px 16px',
                fontSize: '1rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                background: '#10b981',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Print Friendly Format
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
