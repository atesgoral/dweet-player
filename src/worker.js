import { Hono } from 'hono';
import indexHtml from './static/index.html';
import parseId3 from 'id3-parser';

const app = new Hono();

const cacheMaxAge = 60 * 60 * 24; // 1 day

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

// API route: Get track info (MP3 only)
app.get('/api/tracks/:trackUrl{.+}', async (c) => {
  try {
    const trackUrl = decodeURIComponent(c.req.param('trackUrl'));

    // Only support direct MP3 URLs
    if (!trackUrl.endsWith('.mp3')) {
      return c.json({ error: 'Only MP3 URLs are supported' }, 400);
    }

    // Parse ID3 tags from all MP3 URLs (no special handling for any origin)
    let trackTitle = 'Unknown';
    let artistName = 'Unknown';

    try {
      // Fetch first 128KB to parse ID3 tags (tags are usually at the beginning)
      const response = await fetch(trackUrl, {
        headers: { 'Range': 'bytes=0-131071' } // 128KB
      });

      if (!response.ok) {
        throw new Error('Failed to fetch MP3');
      }

      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const id3Tag = parseId3(uint8Array);

      if (id3Tag.title) trackTitle = id3Tag.title;
      if (id3Tag.artist) artistName = id3Tag.artist;
    } catch (id3Error) {
      // If ID3 parsing fails, continue with default values
      console.error('ID3 parsing error:', id3Error);
    }

    return c.json({
      audioUrl: trackUrl,
      trackTitle,
      artistName
    }, 200, {
      'Cache-Control': `public, max-age=${cacheMaxAge}`
    });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// API route: Proxy requests (MP3 files only for CORS bypass)
app.get('/api/proxy/:url{.+}', async (c) => {
  try {
    const url = decodeURIComponent(c.req.param('url'));

    // Security: Only allow MP3 files
    if (!url.endsWith('.mp3')) {
      return c.json({ error: 'Only MP3 files can be proxied' }, 400);
    }

    // Security: Only allow HTTP(S) protocols
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return c.json({ error: 'Only HTTP(S) URLs are allowed' }, 400);
    }

    // Security: Block private/local IP ranges
    const hostname = parsedUrl.hostname;
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname === '0.0.0.0' ||
      hostname === '::1'
    ) {
      return c.json({ error: 'Cannot proxy to private IP addresses' }, 400);
    }

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
app.get('/demo/*', (c) => {
  return c.html(indexHtml);
});

// Note: Other static files (CSS, JS, images) are automatically served by Wrangler's asset handling
// configured in wrangler.toml via [assets] directory setting

export default app;
