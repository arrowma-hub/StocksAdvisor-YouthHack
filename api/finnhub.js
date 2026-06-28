// Vercel serverless proxy for Finnhub — keeps API key server-side
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { endpoint, ...params } = req.query;
  if (!endpoint) return res.status(400).json({ error: "Missing endpoint" });

  const qs = new URLSearchParams({ ...params, token: process.env.FINNHUB_API_KEY }).toString();
  const url = `https://finnhub.io/api/v1/${endpoint}?${qs}`;

  try {
    const r = await fetch(url);
    const data = await r.json();
    // Cache for 60s on Vercel edge
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
    return res.status(r.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Finnhub proxy error", detail: err.message });
  }
}
