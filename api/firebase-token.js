export default async function route(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    handler ??= await build();
  } catch {
    handler = null;
  }
  if (!handler) {
    // Not configured (or misconfigured): say so without revealing which part.
    res.status(503).json({ error: 'not_configured' });
    return;
  }
  const result = await handler({ method: req.method, headers: req.headers });
  for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value);
  res.status(result.status).json(result.body);
}