# Blit Tech Website

A Vite-powered website with optimized assets and comprehensive build tooling.

## Development Features

### Build & Development

- **Hot Module Replacement (HMR)** with error overlay
- **TypeScript** support with strict type checking
- **Asset Optimization:**
    - Images (JPG, PNG, GIF, WEBP, AVIF)
    - SVGs (SVGO with viewBox preservation)
    - Fonts (WOFF2 with compression)
- **Compression:**
    - Brotli (level 11)
    - Gzip fallback (level 9)
    - Applied to: JS, CSS, HTML, SVG, WOFF2
    - Threshold: 10KB

### Analysis & Inspection

- Build inspection at `/__inspect/` in dev mode
- Bundle analysis at `.stats/stats.html` (analyze mode)
- Compressed size reporting

## Development Setup

After cloning the repository:

### Install dependencies

```bash
yarn install
```

### Set up VSCode SDK for Yarn PnP

```bash
yarn dlx @yarnpkg/sdks vscode
```

## Available Scripts

### Development

```bash
# Start development server (with HMR)
yarn dev

# or
yarn start

# Preview production build
yarn preview
```

### Building

```bash
# Production build (includes TypeScript check)
yarn build

# Analyze bundle (generates .stats/stats.html)
yarn analyze
```

### Code Quality

```bash
# Type checking
yarn typecheck

# Linting
yarn lint
yarn lint:fix

# Formatting
yarn format

# Full code check (lint + format + types)
yarn check
```

### Maintenance

```bash
# Clean build output and cache
yarn clean

# Clean build output and cache
yarn clean
```

## Asset Optimization

### Images

- Automatic optimization of JPG, PNG, GIF, WEBP, AVIF
- Quality settings: 85% (good balance)
- SVG optimization with SVGO
- Preserves important SVG attributes

### Fonts

- WOFF2 compression
- Font display optimization
- Preloading critical fonts
- Compressed with Brotli/Gzip

Example font usage:

```css
@font-face {
    font-family: 'YourFont';
    src: url('/fonts/your-font.woff2') format('woff2');
    font-display: swap;
    font-weight: 400;
}
```

#### Font preloading in HTML

```html
<link rel="preload" href="/fonts/your-font.woff2" as="font" type="font/woff2" crossorigin />
```

## Build Output

The production build creates:

```text
dist/
├── assets/
│ ├── index-[hash].js
│ ├── index-[hash].js.br
│ ├── index-[hash].js.gz
│ ├── vendor-[hash].js
│ ├── vendor-[hash].js.br
│ └── vendor-[hash].js.gz
├── images/
│ └── [optimized images]
├── fonts/
│ └── [compressed fonts]
├── index.html
├── index.html.br
├── index.html.gz
```

## Development Tools

### Bundle Analysis

- Run `yarn analyze`
- Open `.stats/stats.html`
- Shows:
    - Bundle composition
    - Module sizes
    - Gzip/Brotli sizes
    - Chunk relationships

### Build Inspection

- Run `yarn dev`
- Visit `/__inspect/`
- Analyze:
    - Module graph
    - Plugin transforms
    - Build performance

## Performance Features

### Code Splitting

- Automatic vendor chunking
- Dynamic imports support
- Optimal caching strategy

### Compression

- Brotli for modern browsers
- Gzip fallback
- Selective compression by file type
- Size threshold: 10KB

### Resource Loading

- Asset preloading
- Font display optimization
- Image lazy loading

## License

UNLICENSED - All rights reserved

## Author

[Vaclav Vancura](https://github.com/vancura)
