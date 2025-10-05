# Cloudflare Worker Port

This project has been ported to run as a Cloudflare Worker using Hono for HTTP routing.

## Local Development

To run the worker locally using Wrangler (which includes Miniflare):

```bash
npm run dev
```

The server will start at `http://localhost:8787`

## Deployment

To deploy to Cloudflare Workers:

```bash
npm run deploy
```

## Configuration

### API Keys

If you need to use the Free Music Archive API, set the `FMA_API_KEY` secret:

```bash
wrangler secret put FMA_API_KEY
```

### Static Files

Static files are served from `src/static/` directory as configured in `wrangler.toml`.

## API Endpoints

- `GET /api/dweets/:id` - Fetch dweet information from Dwitter
- `GET /api/tracks/:trackUrl` - Fetch track metadata (supports FMA and MP3)
- `GET /api/proxy/:url` - Proxy requests to external URLs
- `GET /` - Serve the main application
- `GET /demo/:id` - SPA route for viewing specific dweets

## Notes

- The original Express.js server code is preserved in `src/index.js`
- The new Cloudflare Worker code is in `src/worker.js`
- MP3 ID3 tag reading is currently simplified in the worker version as jsmediatags requires Node.js-specific APIs
- The worker uses `nodejs_compat` flag to support packages like cheerio that rely on Node.js built-ins
