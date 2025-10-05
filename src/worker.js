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

function trimNullTerminator(text) {
  return text.replace(/[\u0000]+$/, '').trim();
}

function decodeWithEncoding(encodingByte, bytes) {
  const encodings = {
    0: 'iso-8859-1',
    1: 'utf-16',
    2: 'utf-16be',
    3: 'utf-8'
  };

  const encoding = encodings[encodingByte] || 'utf-8';
  const decoder = new TextDecoder(encoding, { fatal: false });
  return trimNullTerminator(decoder.decode(bytes));
}

function parseId3v2Frames(buffer) {
  const view = new DataView(buffer);

  if (view.byteLength < 10) {
    return {};
  }

  const header = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2));
  if (header !== 'ID3') {
    return {};
  }

  const version = view.getUint8(3);
  const flags = view.getUint8(5);
  const unsynchronisation = (flags & 0x80) !== 0;

  if (unsynchronisation) {
    return {};
  }

  const size =
    (view.getUint8(6) & 0x7f) << 21 |
    (view.getUint8(7) & 0x7f) << 14 |
    (view.getUint8(8) & 0x7f) << 7 |
    (view.getUint8(9) & 0x7f);

  const frames = {};
  let offset = 10;

  const limit = Math.min(buffer.byteLength, size + 10);

  while (offset < limit) {
    let frameId;
    let frameSize;
    let headerSize;

    if (version === 2) {
      if (offset + 6 > limit) {
        break;
      }

      frameId = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2)
      );
      frameSize =
        (view.getUint8(offset + 3) << 16) |
        (view.getUint8(offset + 4) << 8) |
        view.getUint8(offset + 5);
      headerSize = 6;
    } else {
      if (offset + 10 > limit) {
        break;
      }

      frameId = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
      );
      frameSize = version === 4
        ? ((view.getUint8(offset + 4) & 0x7f) << 21) |
          ((view.getUint8(offset + 5) & 0x7f) << 14) |
          ((view.getUint8(offset + 6) & 0x7f) << 7) |
          (view.getUint8(offset + 7) & 0x7f)
        : view.getUint32(offset + 4);

      const frameFlags = view.getUint16(offset + 8);
      const compression = (frameFlags & 0x0080) !== 0;

      if (compression) {
        offset += 10 + frameSize;
        continue;
      }

      headerSize = 10;
    }

    if (frameSize <= 0 || !/^[A-Z0-9]{3,4}$/.test(frameId)) {
      offset += headerSize + Math.max(frameSize, 0);
      continue;
    }

    const frameOffset = offset + headerSize;
    const nextOffset = frameOffset + frameSize;

    if (nextOffset > limit) {
      break;
    }

    const encodingByte = view.getUint8(frameOffset);
    const frameBytes = new Uint8Array(buffer, frameOffset + 1, Math.max(frameSize - 1, 0));
    const value = decodeWithEncoding(encodingByte, frameBytes);

    if (frameId === 'TIT2' || frameId === 'TT2') {
      frames.title = value;
    } else if (frameId === 'TPE1' || frameId === 'TP1') {
      frames.artist = value;
    }

    offset = nextOffset;

    if (frames.title && frames.artist) {
      break;
    }
  }

  return frames;
}

function parseId3v1(buffer) {
  if (buffer.byteLength < 128) {
    return {};
  }

  const bytes = new Uint8Array(buffer);
  const start = bytes.byteLength - 128;

  if (String.fromCharCode(bytes[start], bytes[start + 1], bytes[start + 2]) !== 'TAG') {
    return {};
  }

  const decoder = new TextDecoder('iso-8859-1');
  const titleBytes = bytes.subarray(start + 3, start + 33);
  const artistBytes = bytes.subarray(start + 33, start + 63);

  return {
    title: trimNullTerminator(decoder.decode(titleBytes)),
    artist: trimNullTerminator(decoder.decode(artistBytes))
  };
}

function extractId3Metadata(buffer) {
  const id3v2 = parseId3v2Frames(buffer);

  if (id3v2.title || id3v2.artist) {
    return id3v2;
  }

  return parseId3v1(buffer);
}

async function getMp3Track(trackUrl) {
  const response = await fetch(trackUrl);

  if (!response.ok) {
    throw new Response(JSON.stringify({ error: 'Unable to fetch MP3' }), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const arrayBuffer = await response.arrayBuffer();
  const metadata = extractId3Metadata(arrayBuffer);

  const filename = getFilenameFromUrl(trackUrl);
  const defaultTitle = filename.replace(/\.mp3$/i, '');

  return {
    audioUrl: trackUrl,
    trackTitle: metadata.title || defaultTitle,
    artistName: metadata.artist || 'Unknown Artist'
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
