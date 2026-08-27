export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 's-maxage=10, stale-while-revalidate=20'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const uas = [
    'UbiServices_SDK_HTTP_Client_Growtopia',
    'Growtopia/4.50 (Windows NT 10.0; Win64; x64)',
    'Growtopia'
  ];

  const urls = [
    'https://www.growtopiagame.com/detail',
    'https://growtopiagame.com/detail'
  ];

  const errors = [];

  for (const url of urls) {
    for (const ua of uas) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': ua,
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'close'
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.online_user) {
            return new Response(JSON.stringify(data), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json; charset=utf-8'
              }
            });
          }
        } else {
          errors.push({ url, ua, status: res.status });
        }
      } catch (e) {
        errors.push({ url, ua, error: e.message });
      }
    }
  }

  return new Response(JSON.stringify({
    error: 'Failed to connect to official Growtopia servers',
    isLive: false,
    online_user: null,
    world_day_images: null,
    debug: errors
  }), {
    status: 503,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}
