# Deployment Guide

This guide explains how to deploy the Blit-Tech examples to various hosting platforms.

## Table of Contents

- [Overview](#overview)
- [Building for Deployment](#building-for-deployment)
- [Deployment Platforms](#deployment-platforms)
  - [GitHub Pages](#github-pages)
  - [FastFront.io](#fastfrontio)
  - [StaticHost.eu](#statichosteu)
  - [Coolify](#coolify)
  - [Hetzner](#hetzner)
  - [Uberspace](#uberspace)
  - [Ploi.cloud](#ploicloud)
- [Automated Deployment](#automated-deployment)
- [Custom Domain](#custom-domain)

## Overview

Blit-Tech examples are built as a static multi-page application using Vite. The build output (`dist/`) contains all
HTML, JavaScript, CSS, and assets needed to deploy anywhere.

**Key Features:**

- ✓ Static HTML/JS/CSS only (no server required)
- ✓ WebGPU support required in browser
- ✓ All examples accessible from `examples/examples-index.html`
- ✓ Platform-agnostic (works with any static host)

## Building for Deployment

### Local Build

```bash
pnpm build:deploy
```

This command:

1. Type-checks TypeScript
2. Builds all examples to `dist/`
3. Bundles assets and optimizes for production

**Output Structure:**

```
dist/
├── examples/
│   ├── examples-index.html    # Gallery landing page
│   ├── index.html             # Basic example
│   ├── primitives.html
│   ├── camera.html
│   ├── patterns.html
│   ├── sprite.html
│   └── font.html
├── assets/
│   └── [hashed-files].js
└── [other build artifacts]
```

### GitHub Actions Build

Every push to `main` triggers the deploy workflow:

```bash
# Manually trigger deployment build
gh workflow run deploy.yml
```

Download the artifact from GitHub Actions:

1. Go to Actions tab
2. Find latest "Deploy" workflow run
3. Download `blit-tech-deployment-[sha]` artifact
4. Extract and upload to your platform

## Deployment Platforms

### GitHub Pages

**Setup:**

1. Create `.github/workflows/pages.yml`:

```yaml
name: GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.24.0
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build:deploy
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - uses: actions/deploy-pages@v4
```

2. Enable GitHub Pages in repository settings
3. Select "GitHub Actions" as source
4. Push to main branch

**URL:** `https://[username].github.io/blit-tech/`

**Root Redirect:** Add `dist/index.html` that redirects to `examples/examples-index.html`

---

### FastFront.io

**Setup:**

1. Sign up at https://www.fastfront.io
2. Connect your GitHub repository
3. Configure build:
   - **Build Command:** `pnpm build:deploy`
   - **Output Directory:** `dist`
   - **Install Command:** `pnpm install`
4. Deploy automatically on push

**Custom Domain:** Configure in FastFront dashboard

---

### StaticHost.eu

**Setup:**

1. Sign up at https://www.statichost.eu
2. Create new project
3. Upload deployment build:

```bash
pnpm build:deploy
cd dist
zip -r deployment.zip .
# Upload deployment.zip via dashboard
```

**Custom Domain:** Configure DNS in StaticHost dashboard

---

### Coolify

**Setup (Self-hosted or Cloud):**

1. Install Coolify: https://coolify.io/docs/installation
2. Create new Static Site resource
3. Configure:
   - **Repository:** `https://github.com/ambilab/blit-tech.git`
   - **Build Pack:** Node.js
   - **Build Command:** `pnpm install && pnpm build:deploy`
   - **Publish Directory:** `dist`
4. Deploy

**Custom Domain:** Configure in Coolify resource settings

---

### Hetzner

**Option 1: Hetzner Storage Box + Static Site**

1. Create Storage Box
2. Build locally and upload via SFTP:

```bash
pnpm build:deploy
sftp uXXXXXX@uXXXXXX.your-storagebox.de
put -r dist/*
```

**Option 2: Hetzner Cloud + Nginx**

1. Create Cloud Server
2. Install nginx
3. Upload build and configure:

```bash
pnpm build:deploy
scp -r dist/* root@your-server:/var/www/html/
```

**Nginx config:**

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/html;
    index examples/examples-index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

---

### Uberspace

**Setup:**

1. Sign up at https://uberspace.de/en/
2. SSH into your Uberspace
3. Clone and build:

```bash
cd ~/html
git clone https://github.com/ambilab/blit-tech.git
cd blit-tech
pnpm install
pnpm build:deploy
mv dist/* ../
cd ..
rm -rf blit-tech
```

4. Configure web backend (automatic)

**Custom Domain:** Use `uberspace web domain add your-domain.com`

---

### Ploi.cloud

**Setup:**

1. Sign up at https://ploi.cloud
2. Create new Static Site
3. Configure deployment:
   - **Repository:** GitHub connection
   - **Build Command:** `pnpm install && pnpm build:deploy`
   - **Public Directory:** `dist`
4. Deploy on push

**Custom Domain:** Configure in site settings

---

## Automated Deployment

### Continuous Deployment

All platforms support automated deployment from GitHub:

1. **Push to main** → Triggers build
2. **Platform detects change** → Builds and deploys
3. **Live update** → New version available

### Deployment Preview

Some platforms (FastFront, Vercel, Netlify) support preview deployments:

- **Pull Requests** → Automatic preview URL
- **Test before merge** → Safe deployment workflow

---

## Custom Domain

### DNS Configuration

For any platform, configure DNS:

```
Type: A or CNAME
Name: @ (or subdomain)
Value: [platform IP or hostname]
```

### HTTPS/SSL

Most platforms provide automatic SSL via Let's Encrypt:

- GitHub Pages: Automatic
- FastFront: Automatic
- StaticHost.eu: Automatic
- Coolify: Configure in settings
- Others: Depends on setup

---

## Troubleshooting

### WebGPU Not Working

**Symptoms:** Examples don't render, blank canvas

**Solutions:**

- Ensure HTTPS (WebGPU requires secure context)
- Use modern browser (Chrome 113+, Edge 113+)
- Check browser WebGPU support: https://caniuse.com/webgpu

### 404 Errors

**Symptoms:** Routes not found

**Solutions:**

- Ensure `dist/examples/examples-index.html` exists
- Configure root redirect to `/examples/examples-index.html`
- Check platform's public directory setting

### Build Failures

**Symptoms:** Deployment fails during build

**Solutions:**

- Check Node.js version (requires >=20.0.0)
- Ensure pnpm is available (most platforms support it)
- Review build logs for TypeScript errors
- Run `pnpm typecheck` locally first

---

## Best Practices

1. **Always test locally** before deploying:
   ```bash
   pnpm build:deploy
   pnpm preview
   ```
2. **Use preview deployments** for pull requests
3. **Monitor build times** (Vite is fast, should be <1 minute)
4. **Cache dependencies** (configure in platform settings)
5. **Use custom domains** with HTTPS for production

---

## Support

- **Issues:** https://github.com/ambilab/blit-tech/issues
- **Discussions:** https://github.com/ambilab/blit-tech/discussions
- **Blit-Tech Docs:** Coming soon with Astro Starlight

---

**Last Updated:** 2025-11-28
