/** Trusted scanner adapter: pipe a verdict after scanning exact immutable bytes.
 * Requires the worker's server-only Firebase credentials; there is no public verdict endpoint.
 * node scripts/feedback-scan-result.mjs < scanner-verdict.json
 */
import { readFileSync } from 'node:fs';
import { getProductionFeedbackPipeline } from '../api/_lib/feedbackPipeline.js';
const input = readFileSync(0, 'utf8');
if (input.length > 4096) throw new Error('verdict_too_large');
const { id, sha256, generation, verdict, scanner } = JSON.parse(input);
await (await getProductionFeedbackPipeline()).recordScan(id, { sha256, generation, verdict, scanner });
console.log(JSON.stringify({ id, verdict, recorded: true }));
