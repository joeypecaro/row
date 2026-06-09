// Creates a Plaid Link token. PLAID_CLIENT_ID and PLAID_SECRET stay server-side.
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret   = process.env.PLAID_SECRET;
  const env      = process.env.PLAID_ENV || 'sandbox';
  if (!clientId || !secret) return res.status(500).json({ error: 'PLAID_CLIENT_ID / PLAID_SECRET not set in Vercel env vars' });

  const baseUrl = env === 'production'
    ? 'https://production.plaid.com'
    : env === 'development'
    ? 'https://development.plaid.com'
    : 'https://sandbox.plaid.com';

  const { device_id } = req.body || {};

  try {
    const r = await fetch(baseUrl + '/link/token/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        secret,
        client_name: 'Row Dashboard',
        user: { client_user_id: device_id || 'default-user' },
        products: ['transactions'],
        country_codes: ['US'],
        language: 'en',
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(400).json({ error: data.error_message || data.display_message || 'Plaid error' });
    return res.status(200).json({ link_token: data.link_token });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
};
