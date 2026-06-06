// Exchanges a Google OAuth authorization code for access + refresh tokens.
// Client Secret never leaves this server — it's read from Vercel env vars.
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { code, redirect_uri } = req.body || {};
  if (!code || !redirect_uri)  return res.status(400).json({ error: 'Missing code or redirect_uri' });

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return res.status(500).json({ error: 'Server misconfigured — env vars not set' });

  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri, grant_type: 'authorization_code' }),
    });
    const d = await r.json();
    if (!r.ok) return res.status(400).json({ error: d.error_description || d.error || 'Token exchange failed' });
    return res.status(200).json({ access_token: d.access_token, refresh_token: d.refresh_token, expires_in: d.expires_in });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
};
