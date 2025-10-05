import { Hono } from 'hono';
import * as cheerio from 'cheerio';

const app = new Hono();

const cacheMaxAge = 60 * 60 * 24; // 1 day

function getCcLicenseTitleFromUrl(url) {
  const tokens = /https?:\/\/creativecommons.org\/licenses\/([^/]+)\/([^/]+)/.exec(url);
  return tokens && `CC ${tokens[1].toUpperCase().replace(/-/g, ' ')} ${tokens[2]}`;
}

// API route: Get dweet by ID
app.get('/api/dweets/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const response = await fetch(`https://www.dwitter.net/api/dweets/${id}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch dweet: ${response.status}`);
    }

    const data = await response.json();

    const dweet = {
      id,
      dweetUrl: data.link,
      author: data.author.username,
      authorUrl: data.author.link,
      src: data.code,
      length: data.code.length
    };

    return c.json(dweet, 200, {
      'Cache-Control': `public, max-age=${cacheMaxAge}`
    });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

async function getFmaTrack(trackUrl, fmaApiKey) {
  // Fetch the page to extract track ID
  const pageResponse = await fetch(trackUrl);
  const html = await pageResponse.text();
  const $ = cheerio.load(html);
  const className = $('.play-item').attr('class');
  const tokens = /\btid-(\d+)/.exec(className);

  if (!tokens) {
    throw new Error('Could not extract track ID');
  }

  const trackId = tokens[1];

  // Fetch track data from API
  const apiUrl = `https://freemusicarchive.org/api/get/tracks.json?api_key=${fmaApiKey}&track_id=${trackId}`;
  const apiResponse = await fetch(apiUrl);
  const data = await apiResponse.json();
  const track = data.dataset[0];

  return {
    audioUrl: trackUrl + '/download',
    trackTitle: track.track_title,
    trackUrl,
    artistName: track.artist_name,
    artistUrl: track.artist_url,
    licenseTitle: getCcLicenseTitleFromUrl(track.license_url) || track.license_title,
    licenseUrl: track.license_url
  };
}

async function getMp3Track(trackUrl) {
  // Note: ID3 tag reading (jsmediatags) won't work in Cloudflare Workers
  // as it requires Node.js buffers. For now, return minimal info.
  // You may want to implement this differently or remove this functionality.
  const response = await fetch(trackUrl, { method: 'HEAD' });

  if (!response.ok) {
    throw new Error('Failed to fetch MP3');
  }

  return {
    audioUrl: trackUrl,
    trackTitle: 'Unknown',
    artistName: 'Unknown'
  };
}

const trackUrlHandlers = [{
  pattern: /^https?:\/\/freemusicarchive\.org/,
  get: getFmaTrack
}, {
  pattern: /\.mp3$/,
  get: getMp3Track
}];

// API route: Get track info
app.get('/api/tracks/:trackUrl{.+}', async (c) => {
  try {
    const trackUrl = decodeURIComponent(c.req.param('trackUrl'));
    const handler = trackUrlHandlers.find((handler) => handler.pattern.test(trackUrl));

    if (!handler) {
      return c.json({ error: 'Unsupported track URL' }, 400);
    }

    const fmaApiKey = c.env?.FMA_API_KEY;
    const track = await handler.get(trackUrl, fmaApiKey);

    return c.json(track, 200, {
      'Cache-Control': `public, max-age=${cacheMaxAge}`
    });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// API route: Proxy requests
app.get('/api/proxy/:url{.+}', async (c) => {
  try {
    const url = decodeURIComponent(c.req.param('url'));
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to proxy request: ${response.status}`);
    }

    const data = await response.arrayBuffer();

    return c.body(data, 200, {
      'Cache-Control': `public, max-age=${cacheMaxAge}`,
      'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream'
    });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// SPA route - serve index.html for /demo/* paths (for client-side routing)
app.get('/demo/*', async (c) => {
  // Fetch the index.html from assets
  return c.html(await (await fetch(new URL('/index.html', c.req.url))).text());
});

// Note: Other static files (HTML, CSS, JS) are automatically served by Wrangler's asset handling
// configured in wrangler.toml via [assets] directory setting

export default app;
