import { useState, useEffect, useCallback, useRef } from 'react';
import { scanAccessibility, summarizeScan, RULE_IDS, SEVERITY, SEVERITY_COLORS, EVIDENCE_TYPE, SCAN_STATUS } from '../../services/accessibilityInspector/accessibilityInspectorService';
import { createScanRun, getCurrentScan, getAllScanRuns, updateScanRun, addRemediationNote, getRemediationNote, SCAN_STORAGE } from '../../services/accessibilityInspector/accessibilityInspectorStorage';
import { useNavigate } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Provider: manages scan state globally for the inspector
// ---------------------------------------------------------------------------

const AccessibilityInspectorProvider = ({ children }) => {
  const [currentScan, setCurrentScan] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const navigate = useNavigate();
  const scanRef = useRef(null);

  // Load current scan from storage on mount
  useEffect(() => {
    const loadCurrent = () => {
      const scan = getCurrentScan();
      if (scan) {
        setCurrentScan(scan);
      }
    };
    loadCurrent();

    // Load history
    const history = getAllScanRuns().slice(0, 20);
    setScanHistory(history);
  }, []);

  // Whenever current scan changes, persist to storage
  useEffect(() => {
    if (currentScan) {
      // Update current scan in storage
      if (currentScan.id) {
        updateScanRun(currentScan.id, {
          findings: currentScan.findings,
          remediationNotes: currentScan.remediationNotes,
          isDraft: currentScan.isDraft,
        });
      }
    }
  }, [currentScan]);

  // Methods
  const startNewScan = useCallback((pageUrl, options = {}) => {
    setIsScanning(true);
    const newScan = createScanRun({
      pageUrl,
      pageVersion: options.pageVersion || `v${Date.now()}`,
      scannedBy: options.scannedBy || 'maintainer',
      includeAI: options.includeAI ?? false,
    });

    setCurrentScan(newScan);
    setIsScanning(false);
    navigate(`/inspector/${newScan.id}`);
    return newScan;
  }, [navigate]);

  const performClientSideScan = useCallback((document) => {
    if (!currentScan) return [];

    setIsScanning(true);

    // Run rule-based accessibility scan
    const findings = scanAccessibility(document, {
      includeAI: currentScan.includeAI ?? false,
    });

    // Summarize the findings
    const summary = summarizeScan(findings);

    // Update the scan with findings
    const updatedScan = updateScanRun(currentScan.id, {
      findings,
      status: SCAN_STATUS.COMPLETE,
      isDraft: false,
    });

    setCurrentScan(updatedScan);
    setIsScanning(false);

    return findings;
  }, [currentScan]);

  const addNote = useCallback((findingId, note) => {
    const result = addRemediationNote(findingId, note);
    if (result) {
      setCurrentScan(prev => ({
        ...prev,
        remediationNotes: prev.remediationNotes,
      }));
    }
    return result;
  }, []);

  const getNote = useCallback((findingId) => {
    return getRemediationNote(findingId, currentScan?.id);
  }, [currentScan]);

  const cancelScan = useCallback(() => {
    // When cancelling, preserve confirmed findings/notes, discard pending
    if (currentScan) {
      // Keep the scan run but mark it as cancelled/draft
      updateScanRun(currentScan.id, {
        isDraft: true,
        status: SCAN_STATUS.STALE,
      });
    }
    setCurrentScan(null);
    setIsScanning(false);
    navigate('/');
  }, [navigate, currentScan]);

  const resumeScan = useCallback((scanId) => {
    const scan = getAllScanRuns().find((s) => s.id === scanId);
    if (scan) {
      setCurrentScan(scan);
      navigate(`/inspector/${scanId}`);
      return scan;
    }
    return null;
  }, [navigate]);

  return children;
};

export default AccessibilityInspectorProvider;