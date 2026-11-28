import crypto from 'node:crypto';

export class GovernmentFormSchemaRegistryService {
  constructor() {
    this.schemaRegistry = new Map();
  }

  registerSchema(schemaData = {}) {
    const {
      formId,
      version = 1,
      jurisdiction = 'NATIONAL',
      effectiveDate = new Date().toISOString(),
      officialSourceReference,
      fields = []
    } = schemaData;

    if (!formId || !officialSourceReference) {
      throw new Error('formId and officialSourceReference are mandatory.');
    }

    const key = `${formId}-v${version}`;
    const schemaChecksum = crypto.createHash('sha256').update(JSON.stringify(fields)).digest('hex');

    const schemaRecord = {
      formId,
      version,
      jurisdiction,
      effectiveDate,
      officialSourceReference,
      fields,
      schemaChecksum,
      isApproved: true,
      registeredAt: new Date().toISOString()
    };

    if (!this.schemaRegistry.has(formId)) {
      this.schemaRegistry.set(formId, new Map());
    }

    this.schemaRegistry.get(formId).set(version, schemaRecord);
    return schemaRecord;
  }

  getSchema(formId, version = null) {
    const versions = this.schemaRegistry.get(formId);
    if (!versions || versions.size === 0) return null;

    if (version !== null) {
      return versions.get(version) || null;
    }

    // Default to latest approved version
    const sortedVersions = Array.from(versions.keys()).sort((a, b) => b - a);
    return versions.get(sortedVersions[0]);
  }

  validateSubmission(formId, submissionData = {}, version = null) {
    const schema = this.getSchema(formId, version);
    if (!schema) {
      throw new Error(`Schema for form ${formId} not found.`);
    }

    const errors = [];
    for (const field of schema.fields) {
      const val = submissionData[field.name];

      // Privacy check: Aadhaar / raw sensitive biometrics rejection
      if (/aadhaar|biometric|otp|password/i.test(field.name)) {
        errors.push(`Field ${field.name} violates privacy-by-design policy: raw sensitive data prohibited.`);
      }

      if (field.required && (val === undefined || val === null || val === '')) {
        errors.push(`Field '${field.name}' (${field.label}) is mandatory.`);
      }

      if (val && field.type === 'number' && typeof val !== 'number') {
        errors.push(`Field '${field.name}' must be a valid number.`);
      }
    }

    return {
      isValid: errors.length === 0,
      schemaVersionUsed: schema.version,
      errors
    };
  }

  rollbackToVersion(formId, targetVersion) {
    const versions = this.schemaRegistry.get(formId);
    if (!versions || !versions.has(targetVersion)) {
      throw new Error(`Target rollback version ${targetVersion} does not exist for form ${formId}.`);
    }

    const targetSchema = versions.get(targetVersion);
    return {
      formId,
      activeVersion: targetSchema.version,
      effectiveDate: targetSchema.effectiveDate,
      rolledBackAt: new Date().toISOString()
    };
  }
}
