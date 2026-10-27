/**
 * Build-time guard for the Vite environment.
 *
 * Every VITE_* variable is copied into the browser bundle, so it is public by
 * definition. This looks for variables that are named or valued like a server
 * secret and returns a description of each one (variable name and reason only,
 * never the value). vite.config.js turns a non-empty result into a failed build.
 */

const SECRET_NAME = /(SECRET|PRIVATE|PASSWORD|PASSWD|SERVICE_?ACCOUNT|CREDENTIAL|OPENAI|ANTHROPIC|GEMINI)/i;

const SECRET_VALUES = [
  [/^sk_(live|test)_/, 'looks like a Clerk/Stripe secret key (sk_...)'],
  [/^sk-[A-Za-z0-9_-]{16,}/, 'looks like an OpenAI style secret key (sk-...)'],
  [/^rk_(live|test)_/, 'looks like a restricted secret key (rk_...)'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'contains a PEM private key'],
  [/^AKIA[0-9A-Z]{12,}/, 'looks like an AWS access key id'],
  [/^gh[pousr]_[A-Za-z0-9]{20,}/, 'looks like a GitHub token'],
  [/^xox[abpr]-/, 'looks like a Slack token'],
];

// Names that are public by design even though they contain a scary word.
const ALLOWED_NAMES = new Set(['VITE_CLERK_PUBLISHABLE_KEY']);

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{name: string, reason: string}[]}
 */
export const findSecretLikeVars = (env = {}) => {
  const findings = [];
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith('VITE_')) continue;
    if (!ALLOWED_NAMES.has(name) && SECRET_NAME.test(name)) {
      findings.push({ name, reason: 'the name suggests a server secret' });
      continue;
    }
    const text = String(value ?? '');
    const hit = SECRET_VALUES.find(([re]) => re.test(text));
    if (hit) findings.push({ name, reason: `the value ${hit[1]}` });
  }
  return findings;
};

export const formatFindings = (findings) =>
  [
    'Refusing to build: these VITE_ variables look like server secrets, and everything prefixed VITE_ is bundled into the public JavaScript.',
    ...findings.map((f) => `  - ${f.name}: ${f.reason}`),
    'Keep real secrets on a server and rename or remove the variable. See docs/INTEGRATIONS.md.',
  ].join('\n');
