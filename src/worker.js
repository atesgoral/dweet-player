import { Hono } from 'hono';

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

    // Check if it's a self-hosted file (same domain)
    const requestHost = new URL(c.req.url).host;
    const trackUrlObj = new URL(trackUrl);
    const isSelfHosted = trackUrlObj.host === requestHost;

    // For self-hosted files, skip the HEAD check (they're served by assets)
    // For external files, verify they exist
    if (!isSelfHosted) {
      const response = await fetch(trackUrl, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error('Failed to fetch MP3');
      }
    }

    return c.json({
      audioUrl: trackUrl,
      trackTitle: 'Unknown',
      artistName: 'Unknown'
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

    // Security: Block self-hosted files (use direct URL instead)
    const requestHost = new URL(c.req.url).host;
    if (parsedUrl.host === requestHost) {
      return c.json({
        error: 'Cannot proxy self-hosted files. Access them directly instead.',
        directUrl: url
      }, 400);
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
app.get('/demo/*', async (c) => {
  // Fetch the index.html from the assets binding
  const assetResponse = await c.env.ASSETS.fetch(new URL('/index.html', c.req.url));
  return c.html(await assetResponse.text());
});

// Note: Other static files (HTML, CSS, JS) are automatically served by Wrangler's asset handling
// configured in wrangler.toml via [assets] directory setting

export default app;
