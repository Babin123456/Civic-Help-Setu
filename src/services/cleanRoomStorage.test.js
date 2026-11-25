import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadStoredWorkspaces,
  saveStoredWorkspace,
  getStoredWorkspaceById,
  loadStoredAuditLogs,
  appendStoredAuditLog,
  loadStoredQueryHistory,
  appendStoredQueryHistory,
  resetCleanRoomStorage,
} from './cleanRoomStorage.js';

describe('cleanRoomStorage', () => {
  beforeEach(() => {
    resetCleanRoomStorage();
  });

  it('loads default seed workspaces when store is empty', () => {
    const workspaces = loadStoredWorkspaces();
    expect(workspaces.length).toBeGreaterThan(0);
    const ws1 = getStoredWorkspaceById('ws-urban-inst-01');
    expect(ws1).toBeDefined();
    expect(ws1.partnerName).toBe('Prof. Alok Verma');
  });

  it('saves and updates workspaces correctly', () => {
    const newWs = {
      workspaceId: 'ws-custom-test-99',
      partnerName: 'Test Partner',
      partnerOrg: 'Test Org',
      status: 'pending_approval',
    };
    saveStoredWorkspace(newWs);

    const retrieved = getStoredWorkspaceById('ws-custom-test-99');
    expect(retrieved).toBeDefined();
    expect(retrieved.partnerName).toBe('Test Partner');
  });

  it('appends and loads audit logs', () => {
    const initialLogs = loadStoredAuditLogs();
    const newLog = {
      auditId: 'AUD-TEST-999',
      timestamp: new Date().toISOString(),
      action: 'TEST_ACTION',
      workspaceId: 'ws-urban-inst-01',
    };
    appendStoredAuditLog(newLog);

    const logs = loadStoredAuditLogs();
    expect(logs.length).toBe(initialLogs.length + 1);
    expect(logs[0].auditId).toBe('AUD-TEST-999');
  });

  it('records and retrieves workspace query history for differencing', () => {
    appendStoredQueryHistory('ws-test-hist', {
      templateId: 'TPL_TEST',
      matchedIds: ['ID-1', 'ID-2'],
    });

    const hist = loadStoredQueryHistory('ws-test-hist');
    expect(hist.length).toBe(1);
    expect(hist[0].templateId).toBe('TPL_TEST');
  });
});
