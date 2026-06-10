// Proxies Google Health API v4 requests from the browser.
// Browser calls same-origin /api/health-proxy?path=... — no CORS preflight.
// Full URL built: https://health.googleapis.com/v4/users/me + path
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing Authorization header' });

  const apiPath = req.query.path;
  if (!apiPath || !apiPath.startsWith('/')) {
    return res.status(400).json({ error: 'Missing or invalid path parameter' });
  }

  const fwdParams = Object.assign({}, req.query);
  delete fwdParams.path;
  const qs = new URLSearchParams(fwdParams).toString();
  // MUST include /users/me — Health API v4 scopes all resources under it
  const url = 'https://health.googleapis.com/v4/users/me' + apiPath + (qs ? '?' + qs : '');

  const fetchOpts = {
    method: req.method,
    headers: { Authorization: auth, Accept: 'application/json' },
  };
  if (req.body && Object.keys(req.body).length > 0) {
    fetchOpts.headers['Content-Type'] = 'application/json';
    fetchOpts.body = JSON.stringify(req.body);
  }

  console.log('[PROXY] Google URL:', url);
  console.log('[PROXY] Outbound Authorization header present:', !!auth);
  try {
    const r = await fetch(url, fetchOpts);
    const text = await r.text();
    console.log('[PROXY] Google status:', r.status);
    console.log('[PROXY] Google body:', text); // full body — never truncated
    const ct = r.headers.get('content-type') || 'application/json';
    res.status(r.status).setHeader('Content-Type', ct).end(text);
  } catch (e) {
    console.error('[PROXY] fetch error:', e.message, url);
    res.status(502).json({ error: 'Upstream error: ' + e.message });
  }
};
