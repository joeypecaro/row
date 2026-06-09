// Proxies Google Calendar API v3 requests from the browser.
// Browser calls same-origin /api/cal-proxy?path=... — no CORS preflight.
// This function calls googleapis.com server-side, forwarding the
// access token from the Authorization header.
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing Authorization header' });

  const calPath = req.query.path;
  if (!calPath || !calPath.startsWith('/')) {
    return res.status(400).json({ error: 'Missing or invalid path parameter' });
  }

  // Forward all query params except 'path' to Google
  const fwdParams = Object.assign({}, req.query);
  delete fwdParams.path;
  const qs = new URLSearchParams(fwdParams).toString();
  const url = 'https://www.googleapis.com/calendar/v3' + calPath + (qs ? '?' + qs : '');

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
