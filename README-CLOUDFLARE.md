# Cloudflare Worker Port

This project runs as a Cloudflare Worker using Hono for HTTP routing.

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

### Static Files

Static files are served from `src/static/` directory as configured in `wrangler.toml`.

## API Endpoints

- `GET /api/dweets/:id` - Fetch dweet information from Dwitter
- `GET /api/tracks/:trackUrl` - Fetch track metadata (MP3 URLs only)
- `GET /api/proxy/:url` - Proxy requests to external URLs
- `GET /` - Serve the main application
- `GET /demo/:id` - SPA route for viewing specific dweets
