// Exchanges a Google OAuth refresh token for a new access token.
// Client Secret never leaves this server — it's read from Vercel env vars.
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { refresh_token } = req.body || {};
  if (!refresh_token) return res.status(400).json({ error: 'Missing refresh_token' });

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return res.status(500).json({ error: 'Server misconfigured — env vars not set' });

  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({ refresh_token, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }),
    });
    const d = await r.json();
    if (!r.ok) return res.status(400).json({ error: d.error_description || d.error || 'Refresh failed' });
    return res.status(200).json({ access_token: d.access_token, expires_in: d.expires_in });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
};
