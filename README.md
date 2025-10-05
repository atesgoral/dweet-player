# dweet player

Allows you to make multi-part demos out of [dweets](https://www.dwitter.net).

## Running locally

This project now runs as a [Cloudflare Worker](https://developers.cloudflare.com/workers/). To run a local preview:

1. Install dependencies (requires Node.js 18+):
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.dev.vars` (Cloudflare's local variable file) and set your [Free Music Archive API key](https://freemusicarchive.org/api).
3. Start the worker:
   ```bash
   npm run dev
   ```
   This command uses Cloudflare's remote preview service so you don't need to
   install or configure Miniflare separately.
4. Visit the printed preview URL.

If you specifically want to emulate the Worker locally, you can run

```bash
npm run preview
```

`wrangler dev --local` bundles Miniflare internally, so no additional
dependency is required.

## Deploying

Set the `FMA_API_KEY` variable on your Cloudflare Worker and run:

```bash
npm run deploy
```

## Usage

### Demo encoding

Demos are encoded in the URL with the following structure:

`/demo/v1/<loader dweet ID>/<timeline>/<audio track URL>`

Where:

- **loader dweet ID** is the dweet to use as a loader. If you don't want to specify one, use "*" to randomly pick one from a pool. Loader dweets should complete their progress animation when t reaches 1.
- **timeline** An array of scenes. Each scene is a dweet ID + some effects. More on this below.
- **audio track URL** - Full URL of an audio track. Tracks from [Free Music Archive](http://freemusicarchive.org/) and direct `.mp3` URLs are supported.

The timeline string is a comma-separated list of scenes: `<scene 1>,<scene 2>,...`.

Each scene starts with a dweet ID, followed by a combination of these optional components:
- A duration specifier
- A time warping specifier
- A trigonometric function (sine, cosine, tangent) morphing specifier
- A "blender" (bad name for what it actually does)
- A "=" at the very end to make the scene contiguous with a prior appearance of the same dweet i.e. dweet frame/t values continue increasing. By default, each dweet's runtime is reset every time they're shown.

Duration specifiers can be:
- Exact time: `@[<seconds>]` - Runs the dweet for exactly the specified amount of seconds. When omitted, 5 seconds is the default.
- Approximate time: `~[<seconds>]` - Runs the dweet around the specified amount of seconds, waiting for the next beat. 5 seconds is the default.
- Exact beats: `![<beats>]`- Runs the dweet for exactly the specified number of beats. 5 beats is the default.

Time warping specifiers can be:
- Beat rush: `t[<amount>]` - Rushes the time forward on beats. The amount determines how much to rush. 5 frames (5/60 seconds) is the default.
- Beat bounce: `T[<amount>]` - Bounces the time foward and then back (restores normal time) on beats. The amount determines how much to bounce. 5 frames is the default.

Trig morphing specifiers can be:
- Uniform: `u[<amount>]` - Morphs the trig functions by scaling their outputs on beats. The amount determines how much to scale. 5 is the default and it means by %50.
- Random: `r[<amount>]` - Morphs the trig functions by scaling their outputs on beats, by a random factor. The amount determines how much to scale. 5 is the default and it means by a maximum of %50 (when the random factor is 1).
- FFT: `f[<amount>]` - Morphs the trig functions by scaling their outputs by the values of the FFT bins as factors (0-1, spread over 2π). The amount determines how much to scale. 5 is the default and it means by %50.

Blenders can be:
- Zoom: `z[<amount>]` - Zooms in on beats. The amount determines how much to zoom. 5 (5%) is the default.
- Vertical mirror: `v[<position>]` - Makes a flipped copy of a part of the canvas as if there's a vertical mirror. The position determines where the mirror is. 5 (50% of the screen) is the default.
- Horizontal mirror: `h[<position>]` - Makes a flipped copy of a part of the canvas as if there's a horizontal mirror. The position determines where the mirror is. 5 (50% of the screen) is the default.
- White flash: `w` - Flashes to white (#ffffff) on beats.
- Black flash: `b` - Flashes to black (#000000) on beats.
