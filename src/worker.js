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

    const response = await fetch(trackUrl, { method: 'HEAD' });

    if (!response.ok) {
      throw new Error('Failed to fetch MP3');
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
