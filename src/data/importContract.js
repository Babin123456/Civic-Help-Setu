/** Generate a unique import ID using a deterministic fallback */
export const generateImportId = () => `imp_${Math.random().toString(36).substring(2, 20)}`;

/** State machine for an import batch */
export const IMPORT_BATCH_STATUS = {
  DRAFT: 'draft',
  UPLOADED: 'uploaded',
  PREVIEW_READY: 'preview_ready',
  VALIDATING: 'validating',
  VALIDATED: 'validated',
  APPROVED: 'approved',
  ROLLED_BACK: 'rolled_back',
  FAILED: 'failed',
  ARCHIVED: 'archived',
};

/** Allowed state transitions: draft -> uploaded -> preview_ready -> validating -> validated -> approved/failed -> archived */
export const IMPORT_BATCH_TRANSITIONS = {
  [IMPORT_BATCH_STATUS.DRAFT]: ['UPLOADED'],
  [IMPORT_BATCH_STATUS.UPLOADED]: ['PREVIEW_READY', 'FAILED'],
  [IMPORT_BATCH_STATUS.PREVIEW_READY]: ['VALIDATING', 'FAILED'],
  [IMPORT_BATCH_STATUS.VALIDATING]: ['VALIDATED', 'FAILED'],
  [IMPORT_BATCH_STATUS.VALIDATED]: ['APPROVED', 'FAILED', 'ROLLED_BACK'],
  [IMPORT_BATCH_STATUS.APPROVED]: ['ROLLED_BACK', 'ARCHIVED'],
  [IMPORT_BATCH_STATUS.ROLLED_BACK]: ['ARCHIVED'],
  [IMPORT_BATCH_STATUS.FAILED]: ['UPLOADED', 'ARCHIVED'],
  [IMPORT_BATCH_STATUS.ARCHIVED]: [],
};

/** Import row source format */
export const IMPORT_ROW_SOURCE = {
  CSV: 'csv',
  JSON: 'json',
};

/** Service categories for civic service catalog */
export const SERVICE_CATEGORIES = ['Certificates', 'Identity', 'Transport', 'Social Welfare', 'Employment', 'Complaints', 'Business', 'Agriculture', 'Health'];

/** Delivery types for civic services */
export const DELIVERY_TYPES = ['Online', 'Offline', 'Online / Offline'];

/** Difficulty levels for civic services */
export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

/** Fee types for civic services */
export const FEE_TYPES = ['free', 'paid'];

/** Field mapping definition */
export const FIELD_MAPPING_TYPE = {
  DIRECT: 'direct',
  COMPUTED: 'computed',
  MAPPED: 'mapped',
};

/** Validation error codes */
export const VALIDATION_ERROR_CODE = {
  REQUIRED_FIELD: 'required_field',
  INVALID_FORMAT: 'invalid_format',
  DUPLICATE_ID: 'duplicate_id',
  DUPLICATE_NAME: 'duplicate_name',
  INVALID_VALUE: 'invalid_value',
  UNKNOWN_COLUMN: 'unknown_column',
  MAX_ROWS_EXCEEDED: 'max_rows_exceeded',
  FILE_TOO_LARGE: 'file_too_large',
  EMPTY_FILE: 'empty_file',
  INVALID_FORMAT: 'invalid_format',
};

/** Rollback snapshot type */
export const ROLLBACK_SNAPSHOT_TYPE = {
  PRE_IMPORT: 'pre_import',
  POST_VALIDATION: 'post_validation',
  POST_APPROVAL: 'post_approval',
};

export const SCHEMA_FIELDS = {
  service: { label: 'Service', required: true },
  batchNumber: { label: 'Batch Number', required: false },
  quantity: { label: 'Quantity', required: false },
  unit: { label: 'Unit', required: false },
  amount: { label: 'Amount', required: false },
  date: { label: 'Date', required: false },
  location: { label: 'Location', required: false },
  contactName: { label: 'Contact Name', required: false },
  contactPhone: { label: 'Contact Phone', required: false },
  contactEmail: { label: 'Contact Email', required: false },
  description: { label: 'Description', required: false },
  notes: { label: 'Notes', required: false },
};

/** No-op: all constants are exported individually above */