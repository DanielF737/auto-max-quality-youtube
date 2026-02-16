# auto-max-quality-youtube

A Chrome extension that automatically sets YouTube video quality.

## Prerequisites

1. Node.js `20.x` (matches CI in `.github/workflows/deploy.yml`)
2. npm
3. Google Chrome

## Install dependencies

Run from the project root:

```bash
npm install
```

## Build and package locally

1. Build extension scripts into `dist/`:

```bash
npm run build
```

2. Package release zip:

```bash
npm run package
```

This creates `extension.zip` at the project root.

## Local testing (Chrome)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Create a local unpacked folder from the generated zip:

```bash
mkdir -p build/unpacked
unzip -o extension.zip -d build/unpacked
```

4. Click **Load unpacked** and select `build/unpacked`.
5. Open a YouTube video and test extension behavior.

### Manual checks

1. Popup displays both modes: `Max quality` and `Quality priority`.
2. Priority list supports add/remove/reorder and save.
3. Priority mode falls back to max quality when no preferred quality exists.
4. High-bitrate variants (for example `1080p (High bitrate)`) are selectable when available.

## Deployment (GitHub Actions + Chrome Web Store)

Deployment is handled by `.github/workflows/deploy.yml` and runs when a GitHub release is published.

### Release process

1. Update extension version in `src/manifest.json`.
2. Commit and push changes.
3. Create and publish a GitHub Release.

### What CI does

1. Installs dependencies.
2. Runs `npm run build`.
3. Runs `npm run package`.
4. Renames artifact to `chrome-extension-<sha>.zip`.
5. Uploads artifact.
6. Uploads extension zip to Chrome Web Store using `chrome-webstore-upload-cli`.

### Required GitHub secrets

1. `EXTENSION_ID`
2. `CLIENT_ID`
3. `CLIENT_SECRET`
4. `REFRESH_TOKEN`
