const cacheMaxAge = 60 * 60 * 24; // 1 day

const dwitterApiBase = 'https://www.dwitter.net/api';
const fmaApiBase = 'https://freemusicarchive.org/api/get';

async function fetchJson(url, init) {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Response(JSON.stringify({ error: `Request failed: ${response.status}` }), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return response.json();
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${cacheMaxAge}`
    }
  });
}

function getCcLicenseTitleFromUrl(url) {
  const tokens = /https?:\/\/creativecommons.org\/licenses\/([^/]+)\/([^/]+)/.exec(url);

  return tokens && `CC ${tokens[1].toUpperCase().replace(/-/g, ' ')} ${tokens[2]}`;
}

async function getDweetResponse(id) {
  const dweet = await fetchJson(`${dwitterApiBase}/dweets/${id}`);

  return {
    id,
    dweetUrl: dweet.link,
    author: dweet.author.username,
    authorUrl: dweet.author.link,
    src: dweet.code,
    length: dweet.code.length
  };
}

async function getFmaTrack(trackUrl, apiKey) {
  if (!apiKey) {
    throw new Response(JSON.stringify({ error: 'FMA API key is not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const pageResponse = await fetch(trackUrl);

  if (!pageResponse.ok) {
    throw new Response(JSON.stringify({ error: 'Unable to fetch FMA track page' }), {
      status: pageResponse.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const pageText = await pageResponse.text();
  const trackIdMatch = pageText.match(/\btid-(\d+)/);

  if (!trackIdMatch) {
    throw new Response(JSON.stringify({ error: 'Could not extract track ID' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const trackId = trackIdMatch[1];
  const params = new URLSearchParams({
    api_key: apiKey,
    track_id: trackId
  });
  const trackResponse = await fetchJson(`${fmaApiBase}/tracks.json?${params.toString()}`);

  if (!trackResponse.dataset || trackResponse.dataset.length === 0) {
    throw new Response(JSON.stringify({ error: 'FMA track metadata not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const track = trackResponse.dataset[0];

  return {
    audioUrl: `${trackUrl}/download`,
    trackTitle: track.track_title,
    trackUrl,
    artistName: track.artist_name,
    artistUrl: track.artist_url,
    licenseTitle: getCcLicenseTitleFromUrl(track.license_url) || track.license_title,
    licenseUrl: track.license_url
  };
}

function getFilenameFromUrl(url) {
  try {
    const filename = new URL(url).pathname.split('/').filter(Boolean).pop();
    return filename ? decodeURIComponent(filename) : url;
  } catch (error) {
    return url;
  }
}

async function getMp3Track(trackUrl) {
  const response = await fetch(trackUrl);

  if (!response.ok) {
    throw new Response(JSON.stringify({ error: 'Unable to fetch MP3' }), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const filename = getFilenameFromUrl(trackUrl);
  const defaultTitle = filename.replace(/\.mp3$/i, '');

  return {
    audioUrl: trackUrl,
    trackTitle: defaultTitle,
    artistName: 'Unknown Artist'
  };
}

const trackUrlHandlers = [
  {
    pattern: /^https?:\/\/freemusicarchive\.org/,
    get: (url, env) => getFmaTrack(url, env.FMA_API_KEY)
  },
  {
    pattern: /\.mp3$/,
    get: (url) => getMp3Track(url)
  }
];

async function handleTrackRequest(trackUrl, env) {
  const handler = trackUrlHandlers.find((candidate) => candidate.pattern.test(trackUrl));

  if (!handler) {
    return jsonResponse({ error: 'Unsupported track URL' }, 400);
  }

  const track = await handler.get(trackUrl, env);
  return jsonResponse(track);
}

async function proxyExternalAsset(url) {
  const response = await fetch(url);

  if (!response.ok) {
    return new Response('Upstream request failed', { status: response.status });
  }

  const headers = new Headers(response.headers);
  headers.set('Cache-Control', `public, max-age=${cacheMaxAge}`);

  return new Response(response.body, { status: response.status, headers });
}

async function handleApiRequest(url, env) {
  if (url.pathname.startsWith('/api/dweets/')) {
    const id = parseInt(url.pathname.replace('/api/dweets/', ''), 10);

    if (Number.isNaN(id)) {
      return jsonResponse({ error: 'Invalid dweet id' }, 400);
    }

    const dweet = await getDweetResponse(id);
    return jsonResponse(dweet);
  }

  if (url.pathname.startsWith('/api/tracks/')) {
    const trackUrl = decodeURIComponent(url.pathname.replace('/api/tracks/', ''));
    return handleTrackRequest(trackUrl, env);
  }

  if (url.pathname.startsWith('/api/proxy/')) {
    const proxyUrl = decodeURIComponent(url.pathname.replace('/api/proxy/', ''));
    return proxyExternalAsset(proxyUrl);
  }

  return null;
}

async function serveStaticAsset(request, env, url) {
  if (url.pathname.startsWith('/demo/')) {
    const assetRequest = new Request(`${url.origin}/index.html`, request);
    const assetResponse = await env.ASSETS.fetch(assetRequest);

    return new Response(assetResponse.body, {
      status: assetResponse.status,
      headers: {
        ...Object.fromEntries(assetResponse.headers),
        'Cache-Control': 'no-cache'
      }
    });
  }

  const assetResponse = await env.ASSETS.fetch(request);
  if (assetResponse.status !== 404) {
    return assetResponse;
  }

  return new Response('Not found', { status: 404 });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
      if (url.pathname.startsWith('/api/')) {
        const apiResponse = await handleApiRequest(url, env);
        if (apiResponse) {
          return apiResponse;
        }
      }

      return await serveStaticAsset(request, env, url);
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }

      return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  }
};
