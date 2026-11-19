/**
 * Pure domain contract for the Local Government Greenhouse-Gas Inventory (#753).
 *
 * No storage, React or network access lives here. The functions are deterministic so a
 * calculation can be reproduced from the stored activity value, unit and immutable factor
 * version alone. The service layer records the returned formula, snapshot and digest.
 */

import {
  ACTIVITY_TRANSITIONS,
  ACTIVITY_UNITS,
  CALCULATION_TRANSITIONS,
  DATA_QUALITY,
  EMISSION_CATEGORY_LABELS,
  GHG_ERROR_CODES,
  GHG_METHODOLOGY_VERSION,
  GHG_ROUNDING_DECIMALS,
  INVENTORY_EXPORT_SCHEMA_VERSION,
  PERIOD_TRANSITIONS,
  QUALITY_FLAGS,
  RECOMMENDATION_TRANSITIONS,
  SUBMISSION_TRANSITIONS,
} from '../services/ghgInventoryConstants.js';
import { GhgInventoryError } from '../services/ghgInventoryValidation.js';

export const roundTo = (value, decimals = GHG_ROUNDING_DECIMALS) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export const canTransition = (transitions, from, to) => {
  if (!from || !to) return false;
  if (from === to) return true;
  return (transitions[from] || []).includes(to);
};

export const assertTransition = (transitions, from, to, entityLabel = 'record') => {
  if (!canTransition(transitions, from, to)) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.INVALID_STATE_TRANSITION,
      `${entityLabel} cannot move from "${from}" to "${to}". Allowed next states: ${
        (transitions[from] || []).join(', ') || 'none (terminal state)'
      }.`,
      { from, to, allowed: transitions[from] || [] }
    );
  }
};

export const canTransitionSubmission = (from, to) => canTransition(SUBMISSION_TRANSITIONS, from, to);
export const canTransitionPeriod = (from, to) => canTransition(PERIOD_TRANSITIONS, from, to);
export const canTransitionActivity = (from, to) => canTransition(ACTIVITY_TRANSITIONS, from, to);
export const canTransitionCalculation = (from, to) => canTransition(CALCULATION_TRANSITIONS, from, to);
export const canTransitionRecommendation = (from, to) =>
  canTransition(RECOMMENDATION_TRANSITIONS, from, to);

/**
 * Converts an activity value to the factor's activity unit.
 * A dimension mismatch (litres against a kWh factor) is refused instead of guessed.
 */
export const convertQuantity = (quantity, fromUnit, toUnit) => {
  const numeric = typeof quantity === 'string' ? Number(quantity) : quantity;
  if (typeof numeric !== 'number' || !Number.isFinite(numeric) || numeric < 0) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      `Activity quantity must be a non-negative finite number. Received ${JSON.stringify(quantity)}.`
    );
  }

  const source = ACTIVITY_UNITS[fromUnit];
  const target = ACTIVITY_UNITS[toUnit];
  if (!source) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      `Unsupported activity unit "${fromUnit}". Allowed units: ${Object.keys(ACTIVITY_UNITS).join(', ')}.`
    );
  }
  if (!target) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.FACTOR_UNAVAILABLE,
      `The factor uses an unsupported activity unit "${toUnit}".`
    );
  }
  if (source.dimension !== target.dimension) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.UNIT_MISMATCH,
      `Unit mismatch: "${fromUnit}" measures ${source.dimension}, but the emission factor expects ${target.dimension} (${toUnit}). Submit the original activity value in a compatible unit.`,
      { fromUnit, toUnit, sourceDimension: source.dimension, targetDimension: target.dimension }
    );
  }

  const factorQuantity = roundTo((numeric * source.toBase) / target.toBase, 6);
  return {
    factorQuantity,
    factorUnit: toUnit,
    baseQuantity: roundTo(numeric * source.toBase, 6),
    baseUnit: target.dimension === 'energy' ? 'kWh' : target.dimension === 'volume' ? 'L' : 'kg',
    converted: fromUnit !== toUnit,
  };
};

/**
 * Resolves the published factor version effective on a date. An explicit version may be
 * supplied, but it must belong to the factor and be published — draft values never calculate
 * official totals.
 */
export const resolveFactorVersion = (versions, factorId, asOfDate, explicitVersionId = null) => {
  const candidates = (versions || []).filter((version) => version.factorId === factorId);
  if (explicitVersionId) {
    const explicit = candidates.find((version) => version.id === explicitVersionId);
    if (!explicit) {
      throw new GhgInventoryError(
        GHG_ERROR_CODES.FACTOR_UNAVAILABLE,
        `Factor version "${explicitVersionId}" does not belong to factor "${factorId}".`
      );
    }
    if (explicit.status !== 'published' && explicit.status !== 'superseded') {
      throw new GhgInventoryError(
        GHG_ERROR_CODES.FACTOR_UNAVAILABLE,
        `Factor version "${explicitVersionId}" is ${explicit.status}; only published versions can be used.`
      );
    }
    // An explicitly selected version must still cover the activity date. This prevents a record
    // being calculated with a factor that was not in force when the activity happened.
    if (asOfDate) {
      const outOfWindow =
        explicit.effectiveFrom > asOfDate ||
        (explicit.effectiveTo && explicit.effectiveTo < asOfDate);
      if (outOfWindow) {
        throw new GhgInventoryError(
          GHG_ERROR_CODES.FACTOR_UNAVAILABLE,
          `Factor version "${explicitVersionId}" is not effective on ${asOfDate}. Choose the version that was in force when the activity occurred.`,
          { factorId, asOfDate, versionId: explicitVersionId }
        );
      }
    }
    return explicit;
  }

  const day = asOfDate || new Date().toISOString().slice(0, 10);
  const published = candidates.filter((version) => version.status === 'published');
  const effective = published
    .filter(
      (version) =>
        version.effectiveFrom <= day && (!version.effectiveTo || version.effectiveTo >= day)
    )
    .sort((a, b) => b.versionNumber - a.versionNumber);

  if (effective.length === 0) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.FACTOR_UNAVAILABLE,
      `No published factor version for "${factorId}" is effective on ${day}. A reviewer must publish a version before this activity can be calculated.`,
      { factorId, asOfDate: day }
    );
  }
  return effective[0];
};

const formatNumber = (value) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format(value);

/**
 * Deterministic single-line calculation. Excluded values return tCO2e 0 with `counted: false`;
 * the original value is never overwritten or discarded.
 */
export const calculateEmission = ({ quantity, unit, factorValue, factorUnit, dataQuality }) => {
  const conversion = convertQuantity(quantity, unit, factorUnit);
  const gross = conversion.factorQuantity * factorValue;
  const counted = dataQuality !== DATA_QUALITY.EXCLUDED;
  const tCO2e = counted ? roundTo(gross) : 0;
  const uncertainty = null;
  return {
    ...conversion,
    factorValue,
    factorUnit,
    grossTCO2e: roundTo(gross),
    tCO2e,
    counted,
    formula: `${formatNumber(conversion.factorQuantity)} ${factorUnit} × ${factorValue} tCO2e/${factorUnit} = ${formatNumber(
      roundTo(gross)
    )} tCO2e`,
    rounding: `Rounded to ${GHG_ROUNDING_DECIMALS} decimal places (tCO2e).`,
    uncertainty,
  };
};

export const severityForUncertainty = (uncertaintyPercent) => {
  if (typeof uncertaintyPercent !== 'number') return 'unknown';
  if (uncertaintyPercent >= 30) return 'high';
  if (uncertaintyPercent >= 10) return 'medium';
  return 'low';
};

/**
 * Calculates every line and the period totals. Measured, estimated and excluded values are
 * kept in separate buckets; only measured + estimated enter `tCO2e`.
 */
export const computePeriodTotals = ({
  period,
  records,
  sources,
  factors,
  versions,
  includeStatuses = null,
  computedAt = new Date().toISOString(),
}) => {
  if (!period) {
    throw new GhgInventoryError(GHG_ERROR_CODES.NOT_FOUND, 'Reporting period is required.');
  }

  const sourceById = new Map((sources || []).map((source) => [source.id, source]));
  const factorById = new Map((factors || []).map((factor) => [factor.id, factor]));
  const considered = (records || []).filter(
    (record) => !includeStatuses || includeStatuses.includes(record.status)
  );

  const lines = [];
  const warnings = [];
  const factorVersionIds = new Set();
  const categoryBuckets = new Map();

  for (const record of considered) {
    const source = sourceById.get(record.sourceId);
    if (!source) {
      throw new GhgInventoryError(
        GHG_ERROR_CODES.NOT_FOUND,
        `Activity record ${record.id} refers to a source that no longer exists.`
      );
    }
    const factorId = record.factorId || source.defaultFactorId;
    const factor = factorById.get(factorId);
    if (!factor) {
      throw new GhgInventoryError(
        GHG_ERROR_CODES.FACTOR_UNAVAILABLE,
        `No emission factor is configured for source "${source.name}".`
      );
    }
    const version = resolveFactorVersion(
      versions,
      factorId,
      record.factorAsOf || period.endDate,
      record.factorVersionId
    );
    factorVersionIds.add(version.id);

    const emission = calculateEmission({
      quantity: record.quantity,
      unit: record.unit,
      factorValue: version.factorValue,
      factorUnit: version.activityUnit || factor.activityUnit,
      dataQuality: record.dataQuality,
    });
    const lineWarnings = [];

    if (record.dataQuality === DATA_QUALITY.EXCLUDED) {
      lineWarnings.push({
        code: QUALITY_FLAGS.EXCLUDED_FROM_TOTAL,
        severity: 'info',
        message: `${source.name} value is excluded from the total by the submitting department.`,
      });
    }
    if (emission.converted) {
      lineWarnings.push({
        code: QUALITY_FLAGS.UNIT_CONVERTED,
        severity: 'info',
        message: `Converted ${record.quantity} ${record.unit} to ${emission.factorQuantity} ${emission.factorUnit} before applying the factor.`,
      });
    }
    if (Number(record.quantity) === 0) {
      lineWarnings.push({
        code: QUALITY_FLAGS.ZERO_QUANTITY,
        severity: 'warning',
        message: `${source.name} reports a zero activity value. Confirm this is a real zero and not a missing reading.`,
      });
    }
    if (record.dataQuality === DATA_QUALITY.ESTIMATED) {
      lineWarnings.push({
        code: QUALITY_FLAGS.ESTIMATED_TOTAL,
        severity: 'warning',
        message: `${source.name} is an estimate and is reported separately from measured data.`,
      });
    }
    if ((version.uncertaintyPercent || 0) >= 30) {
      lineWarnings.push({
        code: QUALITY_FLAGS.UNCERTAINTY_ABOVE_30_PERCENT,
        severity: 'warning',
        message: `${factor.name} version ${version.versionNumber} carries ${version.uncertaintyPercent}% uncertainty. Read this line as an order-of-magnitude estimate.`,
      });
    }

    const bucket = categoryBuckets.get(record.category) || {
      category: record.category,
      label: EMISSION_CATEGORY_LABELS[record.category] || record.category,
      tCO2e: 0,
      measuredTCO2e: 0,
      estimatedTCO2e: 0,
      excludedTCO2e: 0,
      recordCount: 0,
      measuredRecordCount: 0,
      estimatedRecordCount: 0,
      excludedRecordCount: 0,
    };
    bucket.recordCount += 1;
    if (record.dataQuality === DATA_QUALITY.EXCLUDED) {
      bucket.excludedTCO2e = roundTo(bucket.excludedTCO2e + (emission.grossTCO2e || 0));
      bucket.excludedRecordCount += 1;
    } else if (record.dataQuality === DATA_QUALITY.ESTIMATED) {
      bucket.estimatedTCO2e = roundTo(bucket.estimatedTCO2e + emission.tCO2e);
      bucket.estimatedRecordCount += 1;
    } else {
      bucket.measuredTCO2e = roundTo(bucket.measuredTCO2e + emission.tCO2e);
      bucket.measuredRecordCount += 1;
    }
    bucket.tCO2e = roundTo(bucket.measuredTCO2e + bucket.estimatedTCO2e);
    categoryBuckets.set(record.category, bucket);

    lines.push({
      recordId: record.id,
      submissionId: record.submissionId,
      sourceId: source.id,
      sourceName: source.name,
      department: source.department,
      category: record.category,
      categoryLabel: EMISSION_CATEGORY_LABELS[record.category] || record.category,
      dataQuality: record.dataQuality,
      originalQuantity: record.quantity,
      originalUnit: record.unit,
      normalizedQuantity: emission.factorQuantity,
      normalizedUnit: emission.factorUnit,
      factorId,
      factorName: factor.name,
      factorVersionId: version.id,
      factorVersionNumber: version.versionNumber,
      factorValue: version.factorValue,
      factorSource: factor.sourceName,
      uncertaintyPercent: version.uncertaintyPercent,
      uncertaintySeverity: severityForUncertainty(version.uncertaintyPercent),
      tCO2e: emission.tCO2e,
      grossTCO2e: emission.grossTCO2e,
      counted: emission.counted,
      formula: emission.formula,
      rounding: emission.rounding,
      warnings: lineWarnings,
    });
    warnings.push(...lineWarnings.map((warning) => ({ ...warning, sourceId: source.id })));
  }

  // Missing activity is a warning, never an implicit zero.
  const representedSources = new Set(considered.map((record) => record.sourceId));
  for (const source of sources || []) {
    if (!representedSources.has(source.id)) {
      warnings.push({
        code: QUALITY_FLAGS.MISSING_ACTIVITY,
        severity: 'warning',
        message: `No activity record was submitted for ${source.name} in ${period.label}. This source is missing, not zero.`,
        sourceId: source.id,
      });
    }
  }

  const byCategory = [...categoryBuckets.values()].sort((a, b) => b.tCO2e - a.tCO2e);
  const totalTCO2e = roundTo(byCategory.reduce((sum, bucket) => sum + bucket.tCO2e, 0));
  const measuredTCO2e = roundTo(
    byCategory.reduce((sum, bucket) => sum + bucket.measuredTCO2e, 0)
  );
  const estimatedTCO2e = roundTo(
    byCategory.reduce((sum, bucket) => sum + bucket.estimatedTCO2e, 0)
  );
  const excludedTCO2e = roundTo(
    byCategory.reduce((sum, bucket) => sum + bucket.excludedTCO2e, 0)
  );

  return {
    periodId: period.id,
    periodLabel: period.label,
    jurisdictionId: period.jurisdictionId,
    computedAt,
    methodologyVersion: GHG_METHODOLOGY_VERSION,
    totals: {
      tCO2e: totalTCO2e,
      measuredTCO2e,
      estimatedTCO2e,
      excludedTCO2e,
      measuredSharePercent:
        totalTCO2e > 0 ? roundTo((measuredTCO2e / totalTCO2e) * 100, 1) : 0,
      estimatedSharePercent:
        totalTCO2e > 0 ? roundTo((estimatedTCO2e / totalTCO2e) * 100, 1) : 0,
    },
    byCategory: byCategory.map((bucket) => ({
      ...bucket,
      sharePercent: totalTCO2e > 0 ? roundTo((bucket.tCO2e / totalTCO2e) * 100, 1) : 0,
    })),
    lines,
    warnings,
    factorVersionIds: [...factorVersionIds].sort(),
    activityRecordIds: considered.map((record) => record.id).sort(),
  };
};

/** Compares two calculated runs/categories without percentages when the baseline is zero. */
export const compareCategoryTotals = (current, previous) => {
  const categories = new Set([
    ...(current?.byCategory || []).map((item) => item.category),
    ...(previous?.byCategory || []).map((item) => item.category),
  ]);
  return [...categories]
    .map((category) => {
      const now = (current?.byCategory || []).find((item) => item.category === category);
      const before = (previous?.byCategory || []).find((item) => item.category === category);
      const currentValue = now?.tCO2e || 0;
      const previousValue = before?.tCO2e || 0;
      const delta = roundTo(currentValue - previousValue);
      return {
        category,
        label: EMISSION_CATEGORY_LABELS[category] || category,
        currentTCO2e: currentValue,
        previousTCO2e: previousValue,
        deltaTCO2e: delta,
        percentChange:
          previousValue > 0 ? roundTo((delta / previousValue) * 100, 1) : null,
      };
    })
    .sort((a, b) => Math.abs(b.deltaTCO2e) - Math.abs(a.deltaTCO2e));
};

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Stable serialisation, so the same inventory always produces the same digest. */
export const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

/** FNV-1a 64-bit content digest used for reproducible export identity. */
export const contentDigest = (value) => {
  const text = typeof value === 'string' ? value : stableStringify(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = (hash * prime) & mask;
  }
  return `ghg-fnv1a64:${hash.toString(16).padStart(16, '0')}`;
};

/**
 * Source-linked export. Ordering is fixed by period then record id; the payload never includes
 * actor identifiers, private review notes or uploaded document contents.
 */
export const buildInventoryExport = ({
  period,
  jurisdiction,
  sources,
  records,
  factors,
  versions,
  submissionById,
  calculationRun,
  generatedAt = new Date().toISOString(),
  generatedByRole = 'operator',
}) => {
  const factorById = new Map((factors || []).map((factor) => [factor.id, factor]));
  const versionById = new Map((versions || []).map((version) => [version.id, version]));
  const sourceById = new Map((sources || []).map((source) => [source.id, source]));

  const lines = (records || [])
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((record) => {
      const source = sourceById.get(record.sourceId);
      const factor = factorById.get(record.factorId || source?.defaultFactorId);
      const version = versionById.get(record.factorVersionId);
      let emission = null;
      if (factor && version) {
        try {
          emission = calculateEmission({
            quantity: record.quantity,
            unit: record.unit,
            factorValue: version.factorValue,
            factorUnit: version.activityUnit || factor.activityUnit,
            dataQuality: record.dataQuality,
          });
        } catch {
          emission = null;
        }
      }
      return {
        recordId: record.id,
        source: source
          ? {
              name: source.name,
              department: source.department,
              category: source.category,
              location: source.location,
            }
          : null,
        submissionStatus: submissionById?.get(record.submissionId)?.status || null,
        activity: {
          quantity: record.quantity,
          unit: record.unit,
          dataQuality: record.dataQuality,
          correctionNote: record.correctionNotes || '',
          sourceDocument: record.sourceDocument
            ? {
                name: record.sourceDocument.name,
                mimeType: record.sourceDocument.mimeType,
                sizeBytes: record.sourceDocument.sizeBytes,
                sha256: record.sourceDocument.sha256,
                storage: record.sourceDocument.storage,
              }
            : null,
        },
        emission: emission
          ? {
              normalizedQuantity: emission.factorQuantity,
              normalizedUnit: emission.factorUnit,
              tCO2e: emission.tCO2e,
              counted: emission.counted,
              formula: emission.formula,
            }
          : null,
        factor: factor
          ? {
              name: factor.name,
              sourceName: factor.sourceName,
              sourceUrl: factor.sourceUrl,
              scope: factor.scope,
              versionNumber: version?.versionNumber ?? null,
              factorValue: version?.factorValue ?? null,
              activityUnit: version?.activityUnit || factor.activityUnit,
              effectiveFrom: version?.effectiveFrom ?? null,
              effectiveTo: version?.effectiveTo ?? null,
              uncertaintyPercent: version?.uncertaintyPercent ?? null,
            }
          : null,
      };
    });

  const payload = {
    schemaVersion: INVENTORY_EXPORT_SCHEMA_VERSION,
    methodologyVersion: calculationRun?.methodologyVersion || GHG_METHODOLOGY_VERSION,
    generatedAt,
    generatedByRole,
    jurisdiction: jurisdiction
      ? { name: jurisdiction.name, authority: jurisdiction.authority, state: jurisdiction.state }
      : { name: period?.jurisdictionId || 'Unknown' },
    period: period
      ? { label: period.label, startDate: period.startDate, endDate: period.endDate, status: period.status }
      : null,
    totals: calculationRun?.totals || null,
    byCategory: calculationRun?.byCategory || [],
    warnings: calculationRun?.warnings || [],
    calculation: {
      runId: calculationRun?.id || null,
      executedAt: calculationRun?.executedAt || null,
      factorVersionIds: calculationRun?.factorVersionIds || [],
      rulesetVersion: calculationRun?.rulesetVersion || null,
      outputHash: calculationRun?.outputHash || null,
    },
    lines,
    notes: {
      estimates: 'Estimated lines are labelled and are never presented as measured data.',
      exclusions: 'Excluded lines are retained with their original value but do not enter the total.',
      documents: 'Only document metadata is exported; the department retains the original file.',
    },
  };
  return { ...payload, contentDigest: contentDigest(payload) };
};

/** Public projection: aggregates only, no internal ids, notes, actors or document metadata. */
export const buildPublicSummary = ({ period, jurisdiction, calculationRun, generatedAt = new Date().toISOString() }) => {
  if (!period || !calculationRun) {
    return null;
  }
  return {
    jurisdictionName: jurisdiction?.name || 'Local authority',
    authorityName: jurisdiction?.authority || null,
    state: jurisdiction?.state || null,
    periodLabel: period.label,
    periodStart: period.startDate,
    periodEnd: period.endDate,
    publishedAt: period.publishedAt,
    status: period.status,
    generatedAt,
    methodologyVersion: calculationRun.methodologyVersion,
    totals: {
      tCO2e: calculationRun.totals?.tCO2e ?? 0,
      measuredTCO2e: calculationRun.totals?.measuredTCO2e ?? 0,
      estimatedTCO2e: calculationRun.totals?.estimatedTCO2e ?? 0,
      excludedTCO2e: calculationRun.totals?.excludedTCO2e ?? 0,
      estimatedSharePercent: calculationRun.totals?.estimatedSharePercent ?? 0,
    },
    byCategory: (calculationRun.byCategory || []).map((item) => ({
      categoryLabel: EMISSION_CATEGORY_LABELS[item.category] || item.category,
      tCO2e: item.tCO2e,
      measuredTCO2e: item.measuredTCO2e,
      estimatedTCO2e: item.estimatedTCO2e,
      sharePercent: item.sharePercent,
    })),
    warnings: (calculationRun.warnings || [])
      .filter((warning) => warning.severity !== 'info')
      .map((warning) => ({ code: warning.code, message: warning.message })),
    disclosure:
      'Public view shows approved aggregate data only. Department notes, internal identifiers and source documents are not published.',
  };
};

/**
 * Deterministic missing-data recommendation. It never runs when a measured record exists and
 * it always returns the rule version, feature window and source fields behind the estimate.
 */
export const buildMissingDataRecommendation = ({
  source,
  period,
  history,
  factorVersion,
  lookbackPeriods = 3,
  executionTimestamp = new Date().toISOString(),
  createdBy = 'inventory.rules',
}) => {
  const usable = (history || [])
    .filter((item) => item && Number.isFinite(item.quantity) && item.quantity >= 0)
    .slice(0, lookbackPeriods);

  if (!usable.length) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      `No historical activity data exists for ${source.name}; a defensible estimate cannot be produced.`,
      { sourceId: source.id }
    );
  }

  const averageQuantity = roundTo(
    usable.reduce((sum, item) => sum + item.quantity, 0) / usable.length,
    6
  );
  const estimateTCO2e = roundTo(averageQuantity * factorVersion.factorValue);
  const quantities = usable.map((item) => item.quantity);
  const spread =
    quantities.length > 1
      ? roundTo(((Math.max(...quantities) - Math.min(...quantities)) / (averageQuantity || 1)) * 100, 1)
      : 0;

  const historyText = usable
    .map((item) => `${item.periodLabel}: ${formatNumber(item.quantity)} ${factorVersion.activityUnit}`)
    .join('; ');

  return {
    id: null,
    periodId: period.id,
    jurisdictionId: period.jurisdictionId,
    sourceId: source.id,
    category: source.category,
    method: 'historical_average',
    rulesetVersion: 'ghg-forecast-rules-2026.1',
    featureWindow: {
      fromPeriodId: usable[usable.length - 1].periodId,
      toPeriodId: usable[0].periodId,
      periodCount: usable.length,
      lookbackPeriods,
    },
    executionTimestamp,
    estimatedQuantity: averageQuantity,
    activityUnit: factorVersion.activityUnit,
    factorVersionId: factorVersion.id,
    estimateTCO2e,
    explanation: `${source.name} has no measured activity record for ${period.label}. The deterministic ruleset averaged ${usable.length} prior period${
      usable.length === 1 ? '' : 's'
    } (${historyText}) and applied factor version ${factorVersion.id}. The result is labelled estimated and does not replace measured data.`,
    sourceFields: [
      'emission_sources.category',
      `activity_records.quantity (${usable.map((item) => item.periodLabel).join(', ')})`,
      'activity_records.unit',
      `factor_versions.factorValue (${factorVersion.id})`,
    ],
    uncertaintyPercent: Math.min(90, roundTo(12 + spread, 1)),
    status: 'pending',
    decision: null,
    createdAt: executionTimestamp,
    updatedAt: executionTimestamp,
    createdBy,
    schemaVersion: 1,
  };
};

export const getTransitionOptions = (transitions, from) => transitions[from] || [];
