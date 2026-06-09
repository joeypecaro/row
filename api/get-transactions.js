// Fetches recent transactions for all Plaid items belonging to a device_id.
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

  const now   = new Date();
  const start = new Date(now); start.setDate(now.getDate() - 30);
  const fmt   = d => d.toISOString().slice(0, 10);

  try {
    const sr = await fetch(SUPABASE_URL + '/rest/v1/plaid_items?device_id=eq.' + encodeURIComponent(device_id) + '&select=item_id,access_token', {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
    });
    const storedItems = await sr.json();
    if (!sr.ok || !Array.isArray(storedItems) || !storedItems.length) {
      return res.status(200).json({ transactions: [] });
    }

    const allTxs = [];
    await Promise.all(storedItems.map(async item => {
      try {
        const r = await fetch(baseUrl + '/transactions/get', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId, secret, access_token: item.access_token,
            start_date: fmt(start), end_date: fmt(now),
            options: { count: 100, offset: 0 }
          }),
        });
        const data = await r.json();
        if (!r.ok) return;
        (data.transactions || []).forEach(tx => {
          allTxs.push({
            transaction_id: tx.transaction_id,
            account_id: tx.account_id,
            name: tx.name,
            merchant_name: tx.merchant_name,
            amount: tx.amount,
            date: tx.date,
            category: tx.category,
            pending: tx.pending
          });
        });
      } catch (_) {}
    }));

    allTxs.sort((a, b) => b.date.localeCompare(a.date));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ transactions: allTxs });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
};
