import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import UpFloodResponseBoard from './UpFloodResponseBoard';
import FloodIncidentList from '../components/floodResponse/FloodIncidentList';
import FloodReportModal from '../components/floodResponse/FloodReportModal';
import WardDrainSummaryModal from '../components/floodResponse/WardDrainSummaryModal';
import RouteHazardCheckerModal from '../components/floodResponse/RouteHazardCheckerModal';
import OfflineDraftQueueModal from '../components/floodResponse/OfflineDraftQueueModal';
import {
  _resetStorageForTesting,
  listIncidents,
  enqueueOfflineDraft,
} from '../services/upFloodResponseService';
import { ToastProvider } from '../context/ToastContext';

describe('UpFloodResponseBoard Page & UI Integration (#985)', () => {
  beforeEach(() => {
    _resetStorageForTesting();
  });

  const renderBoard = () => {
    return renderToStaticMarkup(
      <ToastProvider>
        <UpFloodResponseBoard />
      </ToastProvider>
    );
  };

  it('renders prominent life-threatening emergency helplines banner and numbers', () => {
    const html = renderBoard();
    expect(html).toContain('NOT AN EMERGENCY DISPATCH SERVICE');
    expect(html).toContain('112 (Police / Emergency)');
    expect(html).toContain('1070 (UP State Disaster)');
    expect(html).toContain('1077 (District Control)');
    expect(html).toContain('tel:112');
    expect(html).toContain('tel:1070');
    expect(html).toContain('tel:1077');
  });

  it('renders title, metrics, filters, and seed incidents', () => {
    const html = renderBoard();
    expect(html).toContain('UP Flooded-Road &amp; Drain Blockage Response Board');
    expect(html).toContain('Active Severe Hazards');
    expect(html).toContain('Blocked Municipal Drains');
    expect(html).toContain('Official Authority Alerts');
    expect(html).toContain('Stale Observations (Excluded)');
    expect(html).toContain('Parivartan Chowk');
    expect(html).toContain('Singar Nagar Metro');
    expect(html).toContain('Ashok Marg');
  });

  it('maintains strict Map/List parity (same incident count across list and map)', () => {
    const { incidents } = listIncidents();
    const html = renderBoard();

    // Map grid header displays exact incident count
    expect(html).toContain(`Total Visible Map Pins: <strong>${incidents.length}</strong>`);

    // Verify key localities appear in the rendered document
    expect(html).toContain('Parivartan Chowk');
    expect(html).toContain('Singar Nagar Metro');
    expect(html).toContain('Ashok Marg');
    expect(html).toContain('Munshi Pulia');
  });

  it('renders Low-Bandwidth Mode as lightweight semantic table without map tiles', () => {
    const { incidents } = listIncidents();
    const html = renderToStaticMarkup(
      <FloodIncidentList
        incidents={incidents}
        lowBandwidthMode={true}
        onReconfirm={() => {}}
      />
    );

    expect(html).toContain('Low-Bandwidth Mode Active');
    expect(html).toContain('<table');
    expect(html).toContain('Locality / Ward');
    expect(html).toContain('Type &amp; Depth');
    expect(html).toContain('Freshness');
  });

  it('displays stale observation warning badge on old reports', () => {
    const html = renderBoard();
    expect(html).toContain('Munshi Pulia Intersection Service Lane');
    expect(html).toContain('Stale Observation:');
    expect(html).toContain('This report is older than the 2-hour observation window');
  });

  it('renders FloodReportModal with anonymous protection and PII redaction warning', () => {
    const html = renderToStaticMarkup(
      <FloodReportModal
        isOpen={true}
        onClose={() => {}}
        onSubmit={() => {}}
        isOnline={true}
      />
    );

    expect(html).toContain('Report Flooded Road or Drain Blockage');
    expect(html).toContain('Anonymous &amp; Redacted:');
    expect(html).toContain('Exact flat, door, or house numbers are automatically removed');
    expect(html).toContain('UP District *');
    expect(html).toContain('Lucknow');
    expect(html).toContain('Kanpur Nagar');
    expect(html).toContain('Varanasi');
  });

  it('renders WardDrainSummaryModal with desiltation statuses and statutory petition', () => {
    const html = renderToStaticMarkup(
      <WardDrainSummaryModal
        isOpen={true}
        onClose={() => {}}
        district="Lucknow"
      />
    );

    expect(html).toContain('Ward-Wise Drain Blockage Summaries &amp; Maintenance Petition');
    expect(html).toContain('Municipal Ward Desiltation Status');
    expect(html).toContain('STATUTORY CIVIC MAINTENANCE &amp; URGENT DRAIN DESILTATION PETITION');
    expect(html).toContain('Municipal Corporation / Nagar Nigam (Lucknow)');
  });

  it('renders RouteHazardCheckerModal with safety guarantee', () => {
    const html = renderToStaticMarkup(
      <RouteHazardCheckerModal
        isOpen={true}
        onClose={() => {}}
        district="Lucknow"
      />
    );

    expect(html).toContain('Route Hazard &amp; Passability Safety Checker');
    expect(html).toContain('Safety Invariant:');
    expect(html).toContain('Civic Help Setu will never route users through a reported waterlogging hazard');
  });

  it('renders OfflineDraftQueueModal with pending drafts when connectivity is down', () => {
    enqueueOfflineDraft({
      district: 'Lucknow',
      locality: 'Chowk Mandi Road',
      incidentType: 'flooded_road',
      depthCategory: 'knee_deep',
    });

    const html = renderToStaticMarkup(
      <OfflineDraftQueueModal
        isOpen={true}
        onClose={() => {}}
        isOnline={false}
      />
    );

    expect(html).toContain('Offline Incident Draft Queue');
    expect(html).toContain('Chowk Mandi Road');
    expect(html).toContain('<strong>1</strong> report(s) waiting to sync');
  });
});
