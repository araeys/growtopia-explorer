import https from 'https';

function fetchGTDetail(urlStr) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const req = https.request({
        hostname: url.hostname,
        port: 443,
        path: url.pathname + (url.search || ''),
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Referer': 'https://www.growtopiagame.com/',
          'Accept-Language': 'en-US,en;q=0.9',
          'Connection': 'close'
        },
        timeout: 8000
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } catch (e) {
              reject(new Error('Invalid JSON response'));
            }
          } else {
            reject(new Error('HTTP Status ' + res.statusCode));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

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

  const errors = [];
  for (const targetUrl of urls) {
    try {
      const data = await fetchGTDetail(targetUrl);
      if (data && data.online_user) {
        res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');
        return res.status(200).json(data);
      }
    } catch (err) {
      errors.push({ url: targetUrl, error: err.message });
    }
  }

  // If failed to reach Growtopia servers, return 503 error - NO FAKE NUMBERS
  return res.status(503).json({
    error: 'Failed to connect to official Growtopia servers',
    isLive: false,
    online_user: null,
    world_day_images: null,
    debug: errors
  });
}
