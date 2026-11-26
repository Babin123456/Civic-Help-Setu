import { describe, it, expect, beforeEach } from 'vitest';
import {
  EmergencyBroadcastFanoutService,
  BroadcastChannel,
  AlertSeverity,
  EmergencyBroadcastError
} from './emergencyBroadcastFanoutService.js';

describe('EmergencyBroadcastFanoutService', () => {
  let service;

  beforeEach(() => {
    service = new EmergencyBroadcastFanoutService();
  });

  it('fans out localized notifications to geofenced citizens across multiple channels', async () => {
    const recipients = [
      { id: 'usr_1', wardNumber: 143, preferredLanguage: 'kn', optedOutOfAdvisories: false },
      { id: 'usr_2', wardNumber: 143, preferredLanguage: 'en', optedOutOfAdvisories: false },
      { id: 'usr_3', wardNumber: 99, preferredLanguage: 'en', optedOutOfAdvisories: false } // Out of geofence
    ];

    const result = await service.dispatchBroadcast({
      alertId: 'alert_flood_warning_2026',
      authorityId: 'urn:civic:bbmp_disaster_cell',
      severity: AlertSeverity.WARNING,
      geofence: { districtCode: 'KA-BLR', wardNumber: 143 },
      channels: [BroadcastChannel.SMS, BroadcastChannel.WEB_PUSH],
      contentVariants: {
        en: 'Severe waterlogging alert near Silk Board junction. Exercise caution.',
        kn: 'ಸಿಲ್ಕ್ ಬೋರ್ಡ್ ಜಂಕ್ಷನ್ ಬಳಿ ನೀರು ನಿಲ್ಲುವ ಎಚ್ಚರಿಕೆ.'
      },
      recipients
    });

    expect(result.broadcastId).toMatch(/^bc_/);
    expect(result.status).toBe('DISPATCHED');
    expect(result.metrics.delivered).toBe(2); // Only usr_1 and usr_2 in ward 143
    expect(result.metrics.channelBreakdown[BroadcastChannel.SMS].success).toBe(2);
  });

  it('suppresses advisory messages for citizens with active opt-out preferences', async () => {
    const recipients = [
      { id: 'usr_1', wardNumber: 10, optedOutOfAdvisories: true }
    ];

    const result = await service.dispatchBroadcast({
      alertId: 'alert_tree_pruning',
      authorityId: 'bbmp_horticulture',
      severity: AlertSeverity.ADVISORY,
      geofence: { wardNumber: 10 },
      channels: [BroadcastChannel.SMS],
      contentVariants: { en: 'Tree pruning schedule in ward 10.' },
      recipients
    });

    expect(result.metrics.delivered).toBe(0);
    expect(result.metrics.suppressedOptOut).toBe(1);
  });

  it('prevents duplicate alert broadcasts within suppression window', async () => {
    const payload = {
      alertId: 'cyclone_alert_01',
      authorityId: 'ndma_india',
      severity: AlertSeverity.SEVERE_EMERGENCY,
      geofence: { districtCode: 'TN-CHN' },
      channels: [BroadcastChannel.SMS],
      contentVariants: { en: 'Cyclone alert issued.' },
      recipients: []
    };

    await service.dispatchBroadcast(payload);
    await expect(service.dispatchBroadcast(payload)).rejects.toThrow(EmergencyBroadcastError);
  });
});
