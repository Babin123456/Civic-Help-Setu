/**
 * src/services/differentialPrivacyEngine.js
 * Mathematical implementation of pure epsilon-Differential Privacy
 * with Laplace mechanism, discrete post-processing, and sparse cell suppression (#1163).
 */

import { PRIVACY_LIMITS } from '../data/wardAnalyticsContract';

/**
 * Samples noise from a zero-mean Laplace distribution Lap(0, scale)
 * using the inverse cumulative distribution function (CDF).
 *
 * CDF: F(x) = 0.5 * (1 + sgn(x) * (1 - exp(-|x|/scale)))
 * Inverse: x = -scale * sgn(u) * ln(1 - 2|u|), where u ~ Uniform(-0.5, 0.5)
 *
 * @param {number} scale - Scale parameter b = sensitivity / epsilon
 * @param {Function} [prng] - Optional uniform (0, 1) random generator for reproducible testing
 * @returns {number} Sampled Laplace noise
 */
export const sampleLaplaceNoise = (scale, prng = Math.random) => {
  if (scale <= 0) return 0;

  // Draw uniform sample in (0, 1) excluding 0 and 1 to prevent log(0) or division issues
  let u = prng();
  while (u <= 0 || u >= 1) {
    u = prng();
  }

  // Shift to (-0.5, 0.5)
  const shifted = u - 0.5;
  const sgn = shifted < 0 ? -1 : 1;

  // Inverse CDF transformation
  return -scale * sgn * Math.log(1 - 2 * Math.abs(shifted));
};

/**
 * Applies Laplace mechanism to a true count with sensitivity clipping,
 * integer rounding, and non-negative clamping.
 *
 * @param {number} rawCount - Ground truth non-negative count
 * @param {number} [epsilon] - Privacy loss parameter (default 0.5)
 * @param {number} [sensitivity] - Global query sensitivity (default 1)
 * @param {Object} [options] - Optional custom PRNG or clamping rules
 * @returns {number} Non-negative integer noisy count
 */
export const applyLaplaceMechanism = (
  rawCount,
  epsilon = PRIVACY_LIMITS.DEFAULT_EPSILON,
  sensitivity = PRIVACY_LIMITS.GLOBAL_SENSITIVITY,
  options = {}
) => {
  const count = Math.max(0, Number(rawCount) || 0);
  const eps = Math.max(PRIVACY_LIMITS.MIN_EPSILON, Math.min(PRIVACY_LIMITS.MAX_EPSILON, Number(epsilon) || PRIVACY_LIMITS.DEFAULT_EPSILON));
  const scale = sensitivity / eps;

  const noise = sampleLaplaceNoise(scale, options.prng || Math.random);
  const continuousNoisyCount = count + noise;

  // Post-processing: round to nearest integer and clamp at 0
  return Math.max(0, Math.round(continuousNoisyCount));
};

/**
 * Applies sparse-cell suppression rule.
 * Suppresses if either raw count or noisy count falls below threshold tau.
 *
 * @param {number} rawCount - Ground truth count
 * @param {number} noisyCount - Count after noise injection
 * @param {number} [threshold] - Minimum reporting cohort size (default 5)
 * @returns {Object} Sanitized cell publication payload
 */
export const suppressSparseCell = (
  rawCount,
  noisyCount,
  threshold = PRIVACY_LIMITS.DEFAULT_SPARSE_THRESHOLD
) => {
  const tau = Math.max(PRIVACY_LIMITS.MIN_SPARSE_THRESHOLD, Number(threshold) || PRIVACY_LIMITS.DEFAULT_SPARSE_THRESHOLD);
  const isSuppressed = rawCount < tau || noisyCount < tau;

  return {
    isSuppressed,
    publishedCount: isSuppressed ? null : noisyCount,
    threshold: tau,
  };
};

/**
 * Computes theoretical 95% Laplace error margin:
 * P(|Lap(b)| <= b * ln(1 / 0.05)) = 0.95
 * Margin = (sensitivity / epsilon) * ln(20) ~ (sensitivity / epsilon) * 2.9957
 */
export const compute95ConfidenceInterval = (
  epsilon = PRIVACY_LIMITS.DEFAULT_EPSILON,
  sensitivity = PRIVACY_LIMITS.GLOBAL_SENSITIVITY
) => {
  const eps = Math.max(PRIVACY_LIMITS.MIN_EPSILON, Number(epsilon) || PRIVACY_LIMITS.DEFAULT_EPSILON);
  const scale = sensitivity / eps;
  const margin = scale * 2.99573;

  return {
    scale: Number(scale.toFixed(4)),
    margin: Number(margin.toFixed(2)),
  };
};

/**
 * Evaluates an entire matrix/list of counts, applying DP and suppression.
 *
 * @param {Array<{ key: string, count: number, [extra]: any }>} cells
 * @param {Object} [config]
 * @returns {Array<{ key: string, publishedCount: number|null, isSuppressed: boolean, [extra]: any }>}
 */
export const sanitizeCellMatrix = (cells = [], config = {}) => {
  const epsilon = config.epsilon || PRIVACY_LIMITS.DEFAULT_EPSILON;
  const threshold = config.sparseThreshold || PRIVACY_LIMITS.DEFAULT_SPARSE_THRESHOLD;
  const prng = config.prng || Math.random;

  return cells.map((cell) => {
    const rawCount = Math.max(0, Number(cell.count) || 0);
    const noisyCount = applyLaplaceMechanism(rawCount, epsilon, PRIVACY_LIMITS.GLOBAL_SENSITIVITY, { prng });
    const { isSuppressed, publishedCount } = suppressSparseCell(rawCount, noisyCount, threshold);

    return {
      ...cell,
      rawCount,
      noisyCount,
      publishedCount,
      isSuppressed,
      suppressionThreshold: threshold,
    };
  });
};
