// Proxies Google Health API v4 requests from the browser.
// Browser calls same-origin /api/health-proxy?path=... — no CORS preflight.
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
  const url = 'https://health.googleapis.com/v4' + apiPath + (qs ? '?' + qs : '');

  const fetchOpts = {
    method: req.method,
    headers: { Authorization: auth, Accept: 'application/json' },
  };
  if (req.body && Object.keys(req.body).length > 0) {
    fetchOpts.headers['Content-Type'] = 'application/json';
    fetchOpts.body = JSON.stringify(req.body);
  }

  try {
    const r = await fetch(url, fetchOpts);
    const text = await r.text();
    const ct = r.headers.get('content-type') || 'application/json';
    res.status(r.status).setHeader('Content-Type', ct).end(text);
  } catch (e) {
    res.status(502).json({ error: 'Upstream error: ' + e.message });
  }
};
