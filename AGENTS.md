# Agent Instructions for dweet-player

## Project Overview

dweet-player is a Cloudflare Worker application that creates audiovisual demos from [dweets](https://www.dwitter.net) - JavaScript animations constrained to 140 characters. It synchronizes multiple dweets with music to create multi-part demos.

**Tech Stack:**
- **Runtime:** Cloudflare Workers
- **Framework:** Hono (lightweight web framework)
- **Frontend:** Vanilla JavaScript with jQuery, Handlebars templates
- **Audio:** Web Audio API with FFT analysis for beat detection
- **Deployment:** Wrangler CLI

**Live Site:** https://dweetplayer.net

## Architecture

### Backend (src/worker.js)

Cloudflare Worker handling:
- **API Routes:**
  - `/api/dweets/:id` - Proxies dweet data from dwitter.net API
  - `/api/tracks/:trackUrl` - Extracts ID3 metadata (artist, title) from MP3 files using Range requests (first 128KB)
  - `/api/proxy/:url` - CORS proxy for external MP3 files only (blocks self-hosted, private IPs, non-HTTP(S))
- **Static Assets:** Served via Wrangler's asset system from `src/static/`
- **SPA Routing:** `/demo/*` routes serve index.html for client-side routing

**Security Features:**
- Proxy endpoint restricted to `.mp3` files only
- Blocks private IP ranges (localhost, 192.168.*, 10.*, 172.16.*, etc.)
- Only allows HTTP(S) protocols
- Blocks self-hosted files from proxy (prevents circular fetch)

### Frontend (src/static/main.js)

Single-page application that:
- Fetches and executes dweet code in sandboxed canvas contexts
- Synchronizes dweet playback with audio beats using FFT analysis
- Implements various visual effects (zoom, mirrors, flashes, time warping)
- Handles demo URL encoding/decoding

**Key Components:**
- Beat detection via Web Audio API
- Frame advancers (monotonous, beat-conscious)
- Blenders (zoom, mirrors, flashes)
- Time warpers (beat rush, beat bounce)
- Trig morphers (uniform, random, FFT-based)

## Common Tasks

### Adding New API Endpoints

1. Add route in `src/worker.js` using Hono's routing
2. Use `async/await` with native `fetch()` API
3. Add proper error handling with try/catch
4. Set appropriate cache headers (`Cache-Control: public, max-age=86400`)
5. Consider security implications (CORS, SSRF, etc.)

### Modifying Static Assets

- Files in `src/static/` are auto-served by Wrangler
- No need to add explicit routes for static files
- Changes require redeployment (`npm run deploy`)

### Security Considerations

**IMPORTANT:** This app has security-sensitive endpoints:

1. **Proxy Endpoint** - Could be abused for SSRF or bandwidth theft
   - Always validate URLs before proxying
   - Block private IPs and localhost
   - Restrict to specific file types (.mp3)
   - Block self-hosted files

2. **Track Validation** - Could cause circular fetch issues
   - Skip validation for same-domain files
   - Use HEAD requests for external URLs

### Testing Locally

```bash
npm install
npm run dev  # Starts on http://localhost:8787
```

**Note:** Local development uses Miniflare (included in Wrangler) which simulates Cloudflare Workers environment.

### Deployment

```bash
npm run deploy
```

Deploys to Cloudflare Workers at dweetplayer.net (configured in `wrangler.toml`).

## Configuration Files

### wrangler.toml

```toml
name = "dweet-player"
main = "src/worker.js"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

routes = [
  { pattern = "dweetplayer.net", custom_domain = true }
]

[assets]
directory = "./src/static"

[observability.logs]
enabled = true
```

**Key Settings:**
- `nodejs_compat` - Required for Node.js built-ins compatibility
- `routes` - Custom domain configuration
- `assets` - Static file directory
- `observability.logs` - Enables logging in Cloudflare dashboard

## Code Style

- **Backend:** Modern async/await, ES6 modules
- **Frontend:** Mixed ES5/ES6 (supports older browsers)
- **Error Handling:** Always return JSON errors with appropriate status codes
- **Comments:** Use inline comments for security checks and complex logic

## Known Issues & Gotchas

1. **Circular Fetch:** Never make HTTP requests from the worker to its own domain - use the asset system or import assets at build time instead.

2. **CORS:** The proxy endpoint exists to bypass CORS for external MP3 files. All MP3 files are expected to be hosted externally (e.g., GitHub raw, CDNs, etc.).

## Dependencies

**Runtime:**
- `hono` - Web framework for Cloudflare Workers
- `id3-parser` - MP3 ID3 tag parsing for extracting artist/title metadata

**Dev:**
- `wrangler` - Cloudflare Workers CLI
- `miniflare` - Local Workers simulation (included in Wrangler)

**Previously Removed:**
- `cheerio` - Removed when FMA (Free Music Archive) support was dropped
- `express`, `request`, `dotenv` - Removed during Cloudflare Worker migration
- `jsmediatags` - Replaced with `id3-parser` (better Workers compatibility)

## Demo URL Format

Demos are encoded in the URL:

```
/demo/v1/<loader>/<timeline>/<audio-url>
```

**Example:**
```
/demo/v1/*/3097,631!10t5,915@3/https://dweetplayer.net/track.mp3
```

See README.md for full timeline encoding specification (duration specifiers, time warpers, blenders, etc.).

## Maintenance Notes

- Keep security restrictions in proxy endpoint - they prevent abuse
- Test with both self-hosted and external MP3 files when modifying audio endpoints
- Client and server must stay in sync regarding self-hosted file handling
- Always use PRs for changes (this project follows a PR-based workflow)
