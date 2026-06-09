// Proxies Finnhub stock quote (and optionally profile) requests.
// Keeps FINNHUB_API_KEY server-side only.
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbols, profile } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols required' });

  const key = process.env.FINNHUB_API_KEY;
  if (!key) return res.status(500).json({ error: 'FINNHUB_API_KEY not configured in Vercel env vars' });

  const tickers = String(symbols)
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(s => /^[A-Z0-9.\-^]{1,12}$/.test(s))
    .slice(0, 25);

  if (!tickers.length) return res.status(400).json({ error: 'No valid symbols' });

  const fetchProfile = profile === 'true';

  try {
    const quotes = {};
    await Promise.all(tickers.map(async (ticker) => {
      const base = `https://finnhub.io/api/v1`;
      const calls = [fetch(`${base}/quote?symbol=${encodeURIComponent(ticker)}&token=${key}`)];
      if (fetchProfile) {
        calls.push(fetch(`${base}/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${key}`));
      }
      const [quoteRes, profileRes] = await Promise.all(calls);
      if (!quoteRes.ok) { quotes[ticker] = { _err: 'HTTP ' + quoteRes.status }; return; }
      const q = await quoteRes.json();
      if (fetchProfile && profileRes && profileRes.ok) {
        const p = await profileRes.json();
        q.name = p.name || '';
      }
      quotes[ticker] = q;
    }));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    res.json({ quotes, ts: Date.now() });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
