// Exchanges Plaid public_token for access_token. Stores access_token in Supabase — never returned to client.
const SUPABASE_URL = 'https://hvzjurhrnehjcuoyfgah.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dYWioety0D_9ifPk5dqg7Q_JqBsw7vL';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret   = process.env.PLAID_SECRET;
  const env      = process.env.PLAID_ENV || 'sandbox';
  if (!clientId || !secret) return res.status(500).json({ error: 'PLAID_CLIENT_ID / PLAID_SECRET not set' });

  const { public_token, device_id, institution } = req.body || {};
  if (!public_token) return res.status(400).json({ error: 'public_token required' });

  const baseUrl = env === 'production'
    ? 'https://production.plaid.com'
    : env === 'development'
    ? 'https://development.plaid.com'
    : 'https://sandbox.plaid.com';

  try {
    // Exchange public token
    const er = await fetch(baseUrl + '/item/public_token/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, secret, public_token }),
    });
    const exchangeData = await er.json();
    if (!er.ok) return res.status(400).json({ error: exchangeData.error_message || 'Exchange failed' });
    const { access_token, item_id } = exchangeData;

    // Fetch initial accounts
    const ar = await fetch(baseUrl + '/accounts/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, secret, access_token }),
    });
    const accountData = await ar.json();
    const accounts = ar.ok ? (accountData.accounts || []).map(a => ({
      account_id: a.account_id, name: a.name, official_name: a.official_name,
      type: a.type, subtype: a.subtype, item_id,
      balances: { current: a.balances.current, available: a.balances.available, limit: a.balances.limit }
    })) : [];

    // Store access_token in Supabase (server-side only)
    await fetch(SUPABASE_URL + '/rest/v1/plaid_items', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ item_id, device_id: device_id || 'default', access_token, institution: institution || '', accounts }),
    });

    // Return item metadata only — access_token never leaves the server
    return res.status(200).json({ item_id, institution: institution || '', accounts });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
};
