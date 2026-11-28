import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import {
  SecretsRotationController,
  SECRET_STATE
} from './secretsRotationController.js';

describe('SecretsRotationController (#1252)', () => {
  let controller;

  beforeEach(() => {
    controller = new SecretsRotationController({ overlapWindowSeconds: 60 });
  });

  it('supports zero-downtime dual-verification during rotation overlap window', () => {
    const v1Hash = crypto.createHash('sha256').update('old_db_password').digest('hex');
    const v2Hash = crypto.createHash('sha256').update('new_db_password').digest('hex');

    controller.registerSecret('db-credentials', 'old_db_password');
    controller.initiateRotation('db-credentials', 'new_db_password');

    // Both old draining credential and new active credential are valid
    expect(controller.isTokenValid('db-credentials', v1Hash)).toBe(true);
    expect(controller.isTokenValid('db-credentials', v2Hash)).toBe(true);
  });

  it('rejects retired or revoked credentials immediately', () => {
    const v1Hash = crypto.createHash('sha256').update('secret_key_1').digest('hex');
    controller.registerSecret('jwt-sign-key', 'secret_key_1');
    controller.initiateRotation('jwt-sign-key', 'secret_key_2');

    controller.confirmRetirement('jwt-sign-key', 1);
    expect(controller.isTokenValid('jwt-sign-key', v1Hash)).toBe(false);
  });
});
