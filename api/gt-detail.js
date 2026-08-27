import https from 'https';
import http from 'http';

function fetchGTDetail(urlStr, customUA) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;
      const port = url.port ? parseInt(url.port, 10) : (isHttps ? 443 : 80);

      const req = client.request({
        hostname: url.hostname,
        port: port,
        path: url.pathname + (url.search || ''),
        method: 'GET',
        headers: {
          'User-Agent': customUA || 'UbiServices_SDK_HTTP_Client_Growtopia',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Connection': 'close'
        },
        timeout: 6000
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

  const uas = [
    'UbiServices_SDK_HTTP_Client_Growtopia',
    'Growtopia/4.50 (Windows NT 10.0; Win64; x64)',
    'Growtopia'
  ];

  const urls = [
    'https://www.growtopiagame.com/detail',
    'https://growtopiagame.com/detail',
    'http://www.growtopiagame.com/detail'
  ];

  const errors = [];
  for (const targetUrl of urls) {
    for (const ua of uas) {
      try {
        const data = await fetchGTDetail(targetUrl, ua);
        if (data && data.online_user) {
          res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');
          return res.status(200).json(data);
        }
      } catch (err) {
        errors.push({ url: targetUrl, ua, error: err.message });
      }
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
