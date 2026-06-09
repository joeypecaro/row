// Fetches live account balances for all Plaid items belonging to a device_id.
// Reads access_tokens from Supabase — they never touch the client.
const SUPABASE_URL = 'https://hvzjurhrnehjcuoyfgah.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dYWioety0D_9ifPk5dqg7Q_JqBsw7vL';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret   = process.env.PLAID_SECRET;
  const env      = process.env.PLAID_ENV || 'sandbox';
  if (!clientId || !secret) return res.status(500).json({ error: 'PLAID_CLIENT_ID / PLAID_SECRET not set' });

  const device_id = req.query.device_id;
  if (!device_id) return res.status(400).json({ error: 'device_id required' });

  const baseUrl = env === 'production'
    ? 'https://production.plaid.com'
    : env === 'development'
    ? 'https://development.plaid.com'
    : 'https://sandbox.plaid.com';

  try {
    // Fetch stored items from Supabase
    const sr = await fetch(SUPABASE_URL + '/rest/v1/plaid_items?device_id=eq.' + encodeURIComponent(device_id) + '&select=item_id,access_token,institution', {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
    });
    const storedItems = await sr.json();
    if (!sr.ok || !Array.isArray(storedItems) || !storedItems.length) {
      return res.status(200).json({ accounts: [] });
    }

    const allAccounts = [];
    await Promise.all(storedItems.map(async item => {
      try {
        const r = await fetch(baseUrl + '/accounts/balance/get', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: clientId, secret, access_token: item.access_token }),
        });
        const data = await r.json();
        if (!r.ok) return;
        (data.accounts || []).forEach(a => {
          allAccounts.push({
            account_id: a.account_id, name: a.name, official_name: a.official_name,
            type: a.type, subtype: a.subtype,
            institution: item.institution, item_id: item.item_id,
            balances: { current: a.balances.current, available: a.balances.available, limit: a.balances.limit }
          });
        });
      } catch (_) {}
    }));

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ accounts: allAccounts });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
};
