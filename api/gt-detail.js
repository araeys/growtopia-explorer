export const config = {
  runtime: 'edge',
};

async function fetchOfficialYouTubeVideos() {
  try {
    const res = await fetch('https://www.youtube.com/feeds/videos.xml?channel_id=UCNFTBaDHB4_Y8eFa8YssSMQ', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = [];
    const entryMatches = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    for (const entry of entryMatches.slice(0, 8)) {
      const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
      const vidMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      const pubMatch = entry.match(/<published>([^<]+)<\/published>/);
      if (titleMatch && vidMatch) {
        entries.push({
          title: titleMatch[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"'),
          id: vidMatch[1],
          published: pubMatch ? pubMatch[1] : null,
          url: `https://www.youtube.com/watch?v=${vidMatch[1]}`
        });
      }
    }
    return entries;
  } catch (e) {
    return [];
  }
}

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

  const headersList = [
    {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Referer': 'https://www.growtopiagame.com/',
      'X-Requested-With': 'XMLHttpRequest',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    {
      'User-Agent': 'UbiServices_SDK_HTTP_Client_Growtopia',
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://www.growtopiagame.com/',
      'X-Requested-With': 'XMLHttpRequest'
    }
  ];

  const urls = [
    'https://www.growtopiagame.com/detail',
    'https://growtopiagame.com/detail'
  ];

  const errors = [];

  for (const url of urls) {
    for (const h of headersList) {
      try {
        const [gtRes, ytVideos] = await Promise.all([
          fetch(url, { headers: h }),
          fetchOfficialYouTubeVideos()
        ]);

        if (gtRes.ok) {
          const data = await gtRes.json();
          if (data && data.online_user) {
            data.latest_videos = ytVideos;
            return new Response(JSON.stringify(data), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json; charset=utf-8'
              }
            });
          }
        } else {
          errors.push({ url, ua: h['User-Agent'], status: gtRes.status });
        }
      } catch (e) {
        errors.push({ url, ua: h['User-Agent'], error: e.message });
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
