// Proxies Google Fitness API v1 requests from the browser.
// Browser calls same-origin /api/fit-proxy?path=... — no CORS preflight.
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing Authorization header' });

  const fitPath = req.query.path;
  if (!fitPath || !fitPath.startsWith('/')) {
    return res.status(400).json({ error: 'Missing or invalid path parameter' });
  }

  const fwdParams = Object.assign({}, req.query);
  delete fwdParams.path;
  const qs = new URLSearchParams(fwdParams).toString();
  const url = 'https://www.googleapis.com/fitness/v1' + fitPath + (qs ? '?' + qs : '');

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
