/* global Buffer */
/**
 * api/_lib/validation/requestValidator.js
 *
 * OpenAPI-based Request Validator.
 * Validates incoming requests against versioned OpenAPI 3.1 contracts.
 * Supports path parameters, query parameters, headers, and request bodies.
 * Uses compiled validators for performance with caching.
 */

import { getDefaultRegistry } from '../versioning/contractRegistry.js';

const MAX_BODY_SIZE = 1024 * 1024; // 1MB
const VALIDATION_CACHE_SIZE = 100;

// Simple in-memory validator cache
const validatorCache = new Map();

/**
 * Generate cache key for a validator
 */
function getValidatorCacheKey(version, method, path) {
  return `${version}:${method.toUpperCase()}:${path}`;
}

/**
 * Normalize OpenAPI path to match incoming request paths
 * Converts /users/{id} to regex pattern
 */
function openApiPathToRegex(openApiPath) {
  // Escape special regex chars except { } ( ) and forward slash
  // We need ( ) for capture groups, { } for parameter placeholders
  let pattern = openApiPath
    .replace(/[.+*?^$|[\]\\]/g, '\\$&')  // Don't escape ( ) { }
    .replace(/\//g, '\\/');

  const paramNames = [];
  // Replace {param} with capture group
  pattern = pattern.replace(/\{([^}]+)\}/g, (match, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });

  return { regex: new RegExp(`^${pattern}$`), paramNames };
}

/**
 * Match request path to OpenAPI path template and extract parameters
 */
function matchPath(requestPath, openApiPath) {
  const { regex, paramNames } = openApiPathToRegex(openApiPath);
  const match = requestPath.match(regex);
  if (!match) return null;

  const params = {};
  for (let i = 0; i < paramNames.length; i++) {
    params[paramNames[i]] = match[i + 1];
  }
  return params;
}

/**
 * Find matching operation in OpenAPI spec
 */
function findOperation(spec, method, path) {
  if (!spec.paths) return null;

  const upperMethod = method.toUpperCase();

  // First try exact match
  if (spec.paths[path] && spec.paths[path][upperMethod.toLowerCase()]) {
    return { operation: spec.paths[path][upperMethod.toLowerCase()], pathParams: {} };
  }

  // Try pattern matching for parameterized paths
  for (const [apiPath, pathItem] of Object.entries(spec.paths)) {
    if (pathItem[upperMethod.toLowerCase()]) {
      const params = matchPath(path, apiPath);
      if (params) {
        return { operation: pathItem[upperMethod.toLowerCase()], pathParams: params };
      }
    }
  }

  return null;
}

/**
 * Validate a value against a JSON Schema (subset supported)
 */
function validateAgainstSchema(value, schema, path = 'root', errors = []) {
  if (!schema || typeof schema !== 'object') return true;

  const { type, format, enum: enumValues, minimum, maximum, minLength, maxLength, pattern, required, properties, items, additionalProperties } = schema;

  // Null handling
  if (value === null || value === undefined) {
    if (required) {
      errors.push({ path, message: 'Required field is missing', code: 'REQUIRED' });
      return false;
    }
    return true;
  }

  // Type validation
  if (type) {
    const expectedTypes = Array.isArray(type) ? type : [type];
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    
    // Handle OpenAPI integer type (subset of number)
    const isIntegerType = expectedTypes.includes('integer');
    const isNumberType = expectedTypes.includes('number');
    const isActualInteger = typeof value === 'number' && Number.isInteger(value);
    const isActualNumber = typeof value === 'number';
    
    if (actualType === 'object' && value === null) {
      // null is object in JS, treat as null type
    } else if (isIntegerType && isActualInteger) {
      // Valid integer
    } else if (isNumberType && isActualNumber) {
      // Valid number
    } else if (!expectedTypes.includes(actualType)) {
      errors.push({
        path,
        message: `Expected type ${expectedTypes.join(' or ')}, got ${actualType}`,
        code: 'TYPE_MISMATCH',
        expected: expectedTypes,
        actual: actualType,
      });
      return false;
    }
  }

  // Format validation (basic)
  if (format && typeof value === 'string') {
    const formatValidators = {
      'uuid': /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i,
      'date-time': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
      'date': /^\d{4}-\d{2}-\d{2}$/,
      'email': /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'uri': /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
    };
    const validator = formatValidators[format];
    if (validator && !validator.test(value)) {
      errors.push({ path, message: `Invalid ${format} format`, code: 'FORMAT_MISMATCH', format });
      return false;
    }
  }

  // Enum validation
  if (enumValues && Array.isArray(enumValues)) {
    if (!enumValues.includes(value)) {
      errors.push({ path, message: `Value must be one of: ${enumValues.join(', ')}`, code: 'ENUM_MISMATCH', allowed: enumValues });
      return false;
    }
  }

  // Number constraints
  if (typeof value === 'number') {
    if (minimum !== undefined && value < minimum) {
      errors.push({ path, message: `Must be >= ${minimum}`, code: 'MINIMUM', minimum });
      return false;
    }
    if (maximum !== undefined && value > maximum) {
      errors.push({ path, message: `Must be <= ${maximum}`, code: 'MAXIMUM', maximum });
      return false;
    }
  }

  // String constraints
  if (typeof value === 'string') {
    if (minLength !== undefined && value.length < minLength) {
      errors.push({ path, message: `Must be at least ${minLength} characters`, code: 'MIN_LENGTH', minLength });
      return false;
    }
    if (maxLength !== undefined && value.length > maxLength) {
      errors.push({ path, message: `Must be at most ${maxLength} characters`, code: 'MAX_LENGTH', maxLength });
      return false;
    }
    if (pattern && !new RegExp(pattern).test(value)) {
      errors.push({ path, message: `Must match pattern: ${pattern}`, code: 'PATTERN_MISMATCH', pattern });
      return false;
    }
  }

  // Array validation
  if (Array.isArray(value) && items) {
    for (let i = 0; i < value.length; i++) {
      validateAgainstSchema(value[i], items, `${path}[${i}]`, errors);
    }
  }

  // Object validation
  if (value && typeof value === 'object' && !Array.isArray(value) && properties) {
    // Get required fields from parent schema (OpenAPI style)
    const requiredFields = schema.required || [];
    
    // Check required properties
    for (const [propName, propSchema] of Object.entries(properties)) {
      const isRequired = requiredFields.includes(propName);
      if (isRequired && !(propName in value)) {
        errors.push({ path: `${path}.${propName}`, message: 'Required property is missing', code: 'REQUIRED_PROPERTY' });
      } else if (propName in value) {
        validateAgainstSchema(value[propName], propSchema, `${path}.${propName}`, errors);
      }
    }

    // Check additional properties
    if (additionalProperties === false) {
      for (const propName of Object.keys(value)) {
        if (!properties[propName]) {
          errors.push({ path: `${path}.${propName}`, message: 'Additional properties not allowed', code: 'ADDITIONAL_PROPERTY' });
        }
      }
    }
  }

  return errors.length === 0;
}

/**
 * Compile a validator function for a specific endpoint
 */
function compileValidator(spec, method, path) {
  const { operation, pathParams } = findOperation(spec, method, path) || { operation: null, pathParams: {} };
  if (!operation) return null;

  const requestBody = operation.requestBody;
  const parameters = operation.parameters || [];

  // Categorize parameters
  const pathParamSchemas = {};
  const queryParamSchemas = {};
  const headerParamSchemas = {};
  const cookieParamSchemas = {};

  for (const param of parameters) {
    const schema = param.schema || param.content?.['application/json']?.schema;
    if (!schema) continue;

    const paramDef = { ...schema, required: param.required };
    switch (param.in) {
      case 'path': pathParamSchemas[param.name] = paramDef; break;
      case 'query': queryParamSchemas[param.name] = paramDef; break;
      case 'header': headerParamSchemas[param.name] = paramDef; break;
      case 'cookie': cookieParamSchemas[param.name] = paramDef; break;
    }
  }

  // Request body schema
  let bodySchema = null;
  let bodyRequired = false;
  if (requestBody) {
    bodyRequired = requestBody.required === true;
    const content = requestBody.content || {};
    const jsonContent = content['application/json'] || content['application/*+json'] || Object.values(content)[0];
    if (jsonContent) bodySchema = jsonContent.schema;
  }

  return {
    pathParams: { ...pathParams, ...pathParamSchemas },
    queryParams: queryParamSchemas,
    headerParams: headerParamSchemas,
    cookieParams: cookieParamSchemas,
    bodySchema,
    bodyRequired,
    operationId: operation.operationId,
    summary: operation.summary,
  };
}

/**
 * Get or create compiled validator
 */
function getValidator(registry, version, method, path) {
  const cacheKey = getValidatorCacheKey(version, method, path);
  if (validatorCache.has(cacheKey)) {
    return validatorCache.get(cacheKey);
  }

  const contractEntry = registry.store.get(version);
  if (!contractEntry || !contractEntry.spec) {
    return null;
  }

  const validator = compileValidator(contractEntry.spec, method, path);
  if (validator) {
    // LRU eviction
    if (validatorCache.size >= VALIDATION_CACHE_SIZE) {
      const firstKey = validatorCache.keys().next().value;
      validatorCache.delete(firstKey);
    }
    validatorCache.set(cacheKey, validator);
  }
  return validator;
}

/**
 * Parse query string into object with arrays for repeated keys
 */
function parseQuery(queryString) {
  if (!queryString) return {};
  const params = {};
  for (const pair of queryString.split('&')) {
    const [key, value] = pair.split('=');
    const decodedKey = decodeURIComponent(key);
    const decodedValue = value !== undefined ? decodeURIComponent(value) : '';
    if (params[decodedKey] !== undefined) {
      if (!Array.isArray(params[decodedKey])) {
        params[decodedKey] = [params[decodedKey]];
      }
      params[decodedKey].push(decodedValue);
    } else {
      params[decodedKey] = decodedValue;
    }
  }
  return params;
}

/**
 * Validate request against OpenAPI contract
 */
export async function validateRequest(req, version, options = {}) {
  const { strict = true, skipBody = false, registry = getDefaultRegistry() } = options;

  // Get contract (ensures it's loaded)
  await registry.getContract(version);

  const validator = getValidator(registry, version, req.method, req.path || req.url);
  if (!validator) {
    // No validator available - either no spec or path not found
    if (strict) {
      return {
        valid: false,
        errors: [{ path: 'path', message: `No API definition found for ${req.method} ${req.path || req.url}`, code: 'PATH_NOT_FOUND' }],
      };
    }
    return { valid: true, errors: [] };
  }

  const errors = [];

  /**
   * Coerce value based on schema type (for query/path params from strings)
   */
  function coerceValue(value, schema) {
    if (value === undefined || value === null) return value;
    if (typeof value !== 'string') return value;
    
    const type = schema.type;
    if (!type) return value;
    
    const types = Array.isArray(type) ? type : [type];
    if (types.includes('integer') || types.includes('number')) {
      const num = Number(value);
      return Number.isNaN(num) ? value : num;
    }
    if (types.includes('boolean')) {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    }
    if (types.includes('array')) {
      // Handle comma-separated or repeated params
      try {
        return JSON.parse(value);
      } catch {
        return value.split(',').map(v => v.trim());
      }
    }
    return value;
  }

  // Validate path parameters
  const pathParams = req.pathParams || req.params || {};
  for (const [name, schema] of Object.entries(validator.pathParams)) {
    const value = coerceValue(pathParams[name], schema);
    validateAgainstSchema(value, schema, `path.${name}`, errors);
  }

  // Validate query parameters
  const queryParams = req.query || parseQuery(req.url?.split('?')[1] || '');
  for (const [name, schema] of Object.entries(validator.queryParams)) {
    const value = coerceValue(queryParams[name], schema);
    validateAgainstSchema(value, schema, `query.${name}`, errors);
  }

  // Validate headers
  const headers = req.headers || {};
  for (const [name, schema] of Object.entries(validator.headerParams)) {
    const value = headers[name.toLowerCase()];
    validateAgainstSchema(value, schema, `header.${name}`, errors);
  }

  // Validate request body
  if (!skipBody && validator.bodySchema) {
    const body = req.body;
    if (body === undefined || body === null) {
      if (validator.bodyRequired) {
        errors.push({ path: 'body', message: 'Request body is required', code: 'BODY_REQUIRED' });
      }
    } else {
      // Check body size
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      if (Buffer.byteLength(bodyStr, 'utf8') > MAX_BODY_SIZE) {
        errors.push({ path: 'body', message: `Request body exceeds maximum size of ${MAX_BODY_SIZE} bytes`, code: 'BODY_TOO_LARGE' });
      } else {
        validateAgainstSchema(body, validator.bodySchema, 'body', errors);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    operationId: validator.operationId,
    summary: validator.summary,
  };
}

/**
 * Validate response against OpenAPI contract (for testing/contract compliance)
 */
export function validateResponse(response, version, method, path, registry = getDefaultRegistry()) {
  const contractEntry = registry.store.get(version);
  if (!contractEntry || !contractEntry.spec) {
    return { valid: true, errors: [], skipped: true };
  }

  const { operation } = findOperation(contractEntry.spec, method, path) || { operation: null };
  if (!operation || !operation.responses) {
    return { valid: true, errors: [], skipped: true };
  }

  const statusCode = String(response.status);
  const responseDef = operation.responses[statusCode] || operation.responses.default;
  if (!responseDef || !responseDef.content) {
    return { valid: true, errors: [], skipped: true };
  }

  const jsonContent = responseDef.content['application/json'] || responseDef.content['application/*+json'];
  if (!jsonContent || !jsonContent.schema) {
    return { valid: true, errors: [], skipped: true };
  }

  const errors = [];
  validateAgainstSchema(response.body, jsonContent.schema, 'response', errors);

  return { valid: errors.length === 0, errors };
}

/**
 * Clear validator cache (for testing or spec updates)
 */
export function clearValidatorCache() {
  validatorCache.clear();
}

/**
 * Get validator cache stats
 */
export function getValidatorCacheStats() {
  return {
    size: validatorCache.size,
    maxSize: VALIDATION_CACHE_SIZE,
    keys: [...validatorCache.keys()],
  };
}