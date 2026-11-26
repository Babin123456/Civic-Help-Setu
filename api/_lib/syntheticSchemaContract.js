/**
 * api/_lib/syntheticSchemaContract.js
 *
 * Strict request/response validation contract for Synthetic Civic Dataset Generation (#778).
 */

export const ALLOWED_STATES = ['Maharashtra', 'Delhi', 'Karnataka'];

export function validateGenerationPayload(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a non-null JSON object'] };
  }

  // Seed validation
  if (body.seed !== undefined && body.seed !== null) {
    const seedNum = Number(body.seed);
    if (!Number.isInteger(seedNum) || seedNum < 0 || seedNum > 4294967295) {
      errors.push('seed must be an integer between 0 and 4294967295');
    }
  }

  // Scale config bounds
  if (body.scaleConfig) {
    if (typeof body.scaleConfig !== 'object') {
      errors.push('scaleConfig must be an object');
    } else {
      const { servicesCount, officesCount, applicationsCount, grievancesCount } = body.scaleConfig;
      if (servicesCount !== undefined && (!Number.isInteger(servicesCount) || servicesCount < 1 || servicesCount > 100)) {
        errors.push('scaleConfig.servicesCount must be an integer between 1 and 100');
      }
      if (officesCount !== undefined && (!Number.isInteger(officesCount) || officesCount < 1 || officesCount > 50)) {
        errors.push('scaleConfig.officesCount must be an integer between 1 and 50');
      }
      if (applicationsCount !== undefined && (!Number.isInteger(applicationsCount) || applicationsCount < 1 || applicationsCount > 500)) {
        errors.push('scaleConfig.applicationsCount must be an integer between 1 and 500');
      }
      if (grievancesCount !== undefined && (!Number.isInteger(grievancesCount) || grievancesCount < 1 || grievancesCount > 250)) {
        errors.push('scaleConfig.grievancesCount must be an integer between 1 and 250');
      }
    }
  }

  // Edge case rates (0.0 to 1.0)
  if (body.edgeCaseRates) {
    for (const [rateKey, rateVal] of Object.entries(body.edgeCaseRates)) {
      if (typeof rateVal !== 'number' || rateVal < 0 || rateVal > 1) {
        errors.push(`edgeCaseRates.${rateKey} must be a float between 0.0 and 1.0`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
