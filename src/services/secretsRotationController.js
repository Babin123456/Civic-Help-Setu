import crypto from 'node:crypto';

export const SECRET_STATE = Object.freeze({
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  DRAINING: 'DRAINING',
  RETIRED: 'RETIRED',
  REVOKED: 'REVOKED'
});

export class SecretsRotationController {
  constructor(config = {}) {
    this.overlapWindowSeconds = config.overlapWindowSeconds || 300; // 5 min overlap
    this.secretsStore = new Map();
  }

  registerSecret(secretName, initialValue) {
    const version = 1;
    const versionId = `${secretName}-v${version}`;
    const entry = {
      secretName,
      activeVersion: version,
      versions: new Map([
        [
          version,
          {
            versionId,
            valueHash: crypto.createHash('sha256').update(initialValue).digest('hex'),
            state: SECRET_STATE.ACTIVE,
            activatedAt: Date.now(),
            retireAt: null
          }
        ]
      ])
    };
    this.secretsStore.set(secretName, entry);
    return versionId;
  }

  initiateRotation(secretName, newSecretValue) {
    const secretEntry = this.secretsStore.get(secretName);
    if (!secretEntry) throw new Error(`Secret ${secretName} not found.`);

    const newVersion = secretEntry.activeVersion + 1;
    const versionId = `${secretName}-v${newVersion}`;

    // Mark current active as DRAINING
    const currentActive = secretEntry.versions.get(secretEntry.activeVersion);
    if (currentActive) {
      currentActive.state = SECRET_STATE.DRAINING;
      currentActive.retireAt = Date.now() + (this.overlapWindowSeconds * 1000);
    }

    // Add new version as ACTIVE
    secretEntry.versions.set(newVersion, {
      versionId,
      valueHash: crypto.createHash('sha256').update(newSecretValue).digest('hex'),
      state: SECRET_STATE.ACTIVE,
      activatedAt: Date.now(),
      retireAt: null
    });

    secretEntry.activeVersion = newVersion;
    return versionId;
  }

  isTokenValid(secretName, tokenHash) {
    const secretEntry = this.secretsStore.get(secretName);
    if (!secretEntry) return false;

    // Token is valid if it matches ANY version that is ACTIVE or DRAINING
    for (const v of secretEntry.versions.values()) {
      if ((v.state === SECRET_STATE.ACTIVE || v.state === SECRET_STATE.DRAINING) && v.valueHash === tokenHash) {
        return true;
      }
    }
    return false;
  }

  confirmRetirement(secretName, versionToRetire) {
    const secretEntry = this.secretsStore.get(secretName);
    if (!secretEntry) throw new Error(`Secret ${secretName} not found.`);

    const targetVersion = secretEntry.versions.get(versionToRetire);
    if (!targetVersion) throw new Error(`Version ${versionToRetire} not found.`);

    if (targetVersion.state === SECRET_STATE.ACTIVE) {
      throw new Error('Cannot retire active version without prior rotation.');
    }

    targetVersion.state = SECRET_STATE.RETIRED;
    return true;
  }

  emergencyRevocation(secretName, versionToRevoke) {
    const secretEntry = this.secretsStore.get(secretName);
    if (!secretEntry) throw new Error(`Secret ${secretName} not found.`);

    const targetVersion = secretEntry.versions.get(versionToRevoke);
    if (targetVersion) {
      targetVersion.state = SECRET_STATE.REVOKED;
    }
    return true;
  }
}
