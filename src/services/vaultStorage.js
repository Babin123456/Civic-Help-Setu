import { isValidVaultRecord } from './vaultValidation';
import { logDiagnostic } from '../utils/diagnostics';
import { minimizeDocumentNumber, minimizeVaultDocuments } from './dataMinimization';

const STORAGE_KEY = 'civicbridge_vault_docs';

const persist = (docs) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  } catch (err) {
    const quota = err && (err.name === 'QuotaExceededError' || err.code === 22);
    throw new Error(
      quota
        ? 'Browser storage is full. Delete some documents and try again.'
        : 'Could not save to browser storage.',
      { cause: err }
    );
  }
};

const DEFAULT_DOCUMENTS = [
  {
    id: 'doc-1',
    type: 'Aadhaar Card',
    category: 'Identity',
    number: 'XXXX 1234',
    issuer: 'UIDAI',
    issueDate: '2018-04-12',
    expiryDate: null,
    verified: true,
    notes: 'Primary demographic proof with verified biometrics.',
    fileName: 'aadhaar_card_masked.pdf',
    fileSize: '420 KB',
    taggedServices: ['birth-certificate', 'pan-card', 'voter-id', 'passport'],
  },
  {
    id: 'doc-2',
    type: 'PAN Card',
    category: 'Finance',
    number: 'XXXX 234F',
    issuer: 'Income Tax Department',
    issueDate: '2019-11-20',
    expiryDate: null,
    verified: true,
    notes: 'Linked to bank account and tax filings.',
    fileName: 'pan_card_copy.pdf',
    fileSize: '280 KB',
    taggedServices: ['income-certificate', 'udyam-registration'],
  },
  {
    id: 'doc-3',
    type: 'Driving License',
    category: 'Transport',
    number: 'XXXX 2019',
    issuer: 'Ministry of Road Transport',
    issueDate: '2022-03-01',
    expiryDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // expiring in 45 days
    verified: false,
    notes: 'Valid for LMV and motorcycle with gear. Needs renewal soon.',
    fileName: 'driving_license.jpg',
    fileSize: '1.2 MB',
    taggedServices: ['driving-license'],
  },
];

export const getExpiryStatus = (expiryDate) => {
  if (!expiryDate) return 'none';
  const today = new Date();
  const exp = new Date(expiryDate);
  const diffTime = exp.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'expired';
  if (diffDays <= 60) return 'expiring-soon';
  if (diffDays <= 180) return 'expiring-6m';
  return 'active';
};

export const getDaysUntilExpiry = (expiryDate) => {
  if (!expiryDate) return null;
  const today = new Date();
  const exp = new Date(expiryDate);
  const diffTime = exp.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const getDocuments = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DOCUMENTS));
      } catch {
        // storage unavailable, still show the defaults
      }
      return DEFAULT_DOCUMENTS;
    }
    const stored = JSON.parse(raw);
    // Older entries kept the full document number, cut them down once (#212)
    const minimized = minimizeVaultDocuments(stored);
    if (minimized !== stored) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimized));
      } catch {
        // still return the minimized copy
      }
    }
    return minimized;
  } catch (err) {
    logDiagnostic('Failed to load documents from vault storage', err);
    return DEFAULT_DOCUMENTS;
  }
};

export const saveDocument = (doc) => {
  const current = getDocuments();
  let updated;
  if (doc.id && current.some((d) => d.id === doc.id)) {
    updated = current.map((d) => (d.id === doc.id ? { ...d, ...doc, number: minimizeDocumentNumber(doc.number ?? d.number) } : d));
  } else {
    const newDoc = {
      ...doc,
      number: minimizeDocumentNumber(doc.number),
      id: doc.id || `doc-${Date.now()}`,
      createdAt: new Date().toISOString(),
      verified: Boolean(doc.verified),
      taggedServices: doc.taggedServices || [],
    };
    updated = [newDoc, ...current];
  }
  persist(updated);
  return updated;
};

export const deleteDocument = (id) => {
  const current = getDocuments();
  const updated = current.filter((d) => d.id !== id);
  persist(updated);
  return updated;
};

export const tagDocumentToService = (docId, serviceId) => {
  const current = getDocuments();
  const target = current.find((d) => d.id === docId);
  if (!target) return current;

  const tags = new Set(target.taggedServices || []);
  tags.add(serviceId);
  target.taggedServices = Array.from(tags);

  persist(current);
  return current;
};

export const untagDocumentFromService = (docId, serviceId) => {
  const current = getDocuments();
  const target = current.find((d) => d.id === docId);
  if (!target) return current;

  target.taggedServices = (target.taggedServices || []).filter((s) => s !== serviceId);
  persist(current);
  return current;
};

export const getExpiringDocuments = () => {
  const all = getDocuments();
  return all
    .map((doc) => ({
      doc,
      daysLeft: getDaysUntilExpiry(doc.expiryDate),
      status: getExpiryStatus(doc.expiryDate),
    }))
    .filter((item) => item.status === 'expired' || item.status === 'expiring-soon' || item.status === 'expiring-6m')
    .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
};

export const exportVaultData = () => {
  const docs = getDocuments();
  const backup = {
    app: 'CivicBridge Vault',
    version: '2.0',
    exportDate: new Date().toISOString(),
    documentsCount: docs.length,
    checksum: btoa(unescape(encodeURIComponent(JSON.stringify(docs)))).slice(0, 32),
    documents: docs,
  };
  return JSON.stringify(backup, null, 2);
};

export const importVaultData = (jsonString) => {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || !Array.isArray(parsed.documents)) {
      throw new Error('Invalid vault backup format.');
    }
    const current = getDocuments();
    const existingIds = new Set(current.map((d) => d.id));

    const merged = [...current];
    let skipped = 0;
    for (const incoming of parsed.documents) {
      if (!isValidVaultRecord(incoming)) {
        skipped += 1;
        continue;
      }
      if (existingIds.has(incoming.id)) {
        const idx = merged.findIndex((d) => d.id === incoming.id);
        merged[idx] = { ...merged[idx], ...incoming, number: minimizeDocumentNumber(incoming.number) };
      } else {
        merged.push({ ...incoming, number: minimizeDocumentNumber(incoming.number) });
      }
    }

    persist(merged);
    return { success: true, count: parsed.documents.length - skipped, skipped };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const resetVaultToDefaults = () => {
  persist(DEFAULT_DOCUMENTS);
  return DEFAULT_DOCUMENTS;
};
