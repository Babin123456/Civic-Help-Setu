/**
 * api/_lib/versioning/specs/index.js
 *
 * OpenAPI Specifications Catalog.
 */

import { v1Spec } from './v1Spec.js';
import { v2Spec } from './v2Spec.js';

export const OPENAPI_SPECS = Object.freeze({
  v1: v1Spec,
  v2: v2Spec,
});

export { v1Spec, v2Spec };
