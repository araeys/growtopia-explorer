export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const urls = [
    'https://www.growtopiagame.com/detail',
    'https://growtopiagame.com/detail'
  ];

  for (const targetUrl of urls) {
    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest'
        },
        signal: AbortSignal.timeout(6000)
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.online_user) {
          res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');
          return res.status(200).json(data);
        }
      }
    } catch (err) {
      // Try next url
    }
  }

  // If failed to reach Growtopia servers, return 503 error - NO FAKE NUMBERS
  return res.status(503).json({
    error: 'Failed to connect to official Growtopia servers',
    isLive: false,
    online_user: null,
    world_day_images: null
  });
}
