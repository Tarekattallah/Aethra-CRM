# Aethra identity

**Aethra** is the display name; `aethra` is the technical slug and **AETHRA** is reserved for uppercase labels. The descriptor is **Customer Relationship Management**, shortened to CRM. Use “Every relationship, in orbit.” sparingly.

## Logo

The ring, satellite and three connected nodes represent relationships in orbit. The exact mark uses `viewBox="0 0 200 200"`, 5.6-unit rounded strokes and 7.65-unit node radii. Do not alter its geometry.

```tsx
import { Logo } from './components/Logo';

<Logo variant="full" size="md" className="text-aethra-cyan" />
<Logo variant="mark" size={32} className="text-aethra-ink" />
```

Both variants inherit `currentColor` and expose `role="img"` and `aria-label="Aethra"`. The wordmark is Outfit Regular 400, with 0.01em tracking, vertically centered and placed to the right of the mark. A `subtitle` is optional. Sizes are `sm` (32), `md` (40), `lg` (56), `xl` (80), or a pixel number. The SVG's painted ring is about 90% of its viewBox, so the component's 0.36-viewBox gap equals about 0.4 painted-ring diameters.

Clear space is three satellite diameters: 45.9 units on each side, or 22.95% of the 200-unit mark box. The component includes that padding; full static logos include it in their viewBox. Reserve the same space when using the standalone mark. `aethra-logo--responsive` hides the wordmark below 640px, as used in the header. The sidebar uses the mark when collapsed and the full logo inside its mobile drawer.

| Asset in `client/public/brand/` | Use |
| --- | --- |
| `aethra-mark.svg` | Exact reusable mark; cyan default, SVG paths use currentColor |
| `aethra-logo.svg` | Cyan full logo on night |
| `aethra-logo-light.svg` | White full logo on black/night |
| `aethra-logo-dark.svg` | Ink full logo on paper/white |
| `app-icon.svg`, `favicon.svg` | Night rounded square; cyan mark at 60% of square width |
| `favicon.ico` | 16, 32 and 48px browser fallback |
| `apple-touch-icon.png` | 180 × 180 |
| `icon-192.png`, `icon-512.png` | Manifest icons |
| `og-image.png`, `og-image.svg` | 1200 × 630 social preview, centered full logo on night |
| `site.webmanifest` | App name, theme/background colors and icons |

Static wordmarks are outlined from Outfit 400, so embedding them does not require loading a font. External `<img>` SVGs cannot inherit CSS color from the containing page: choose the appropriate static variant, or use the React component for inherited color.

Do use cyan on night, ink on paper, or white on black. Do preserve aspect ratio and clear space. Do not stretch, rotate, recolor outside the palette, add shadows/glow, or put cyan wordmark text on white. App icons deliberately use the compact mark; do not substitute them for the full logo.

## Color tokens

Tokens live in `client/src/brand-tokens.css` and are mapped in `client/tailwind.config.js`. Use `bg-aethra-night`, `text-aethra-ink`, `bg-aethra-cyan`, and the `surface-*` utilities instead of duplicating core hex values.

| CSS variable | Color | Purpose |
| --- | --- | --- |
| `--aethra-night` | `#07142B` | Header, sidebar, login |
| `--aethra-cyan` | `#1AD6F7` | Primary accent; ink text on cyan buttons |
| `--aethra-ink` | `#0B1426` | Text on light surfaces |
| `--aethra-black` | `#0A0D12` | Reverse surface |
| `--aethra-paper` | `#EEF2F8` | Default page surface |
| `--aethra-white` | `#FFFFFF` | Cards |

Small derived set: hover `#43DDF9`, pressed `#17C1DE`, cyan subtle at 12%, link `#006178`, muted `#52647C`, border `#D5DEEB`, control border `#7B8DA5`, raised night `#14243C`. Semantic success `#137A45`, warning `#92400E`, danger `#BE123C` retain their established meanings. Existing custom track colors are data and remain intact.

Contrast examples (WCAG relative luminance): ink/cyan 10.51:1, cyan/night 10.49:1, ink/paper 16.36:1, muted/white 6.05:1, link/white 7.04:1. Recalculate when changing a token. Cyan text on white fails AA; use the darker link token on light surfaces. Focus outlines use 2px cyan, a 2px offset and a night separator to stay visible on light backgrounds.

The application had no dark-mode switch. The default remains paper/ink, with a night header/sidebar and login. Do not introduce a separate theme toggle as part of branding.

## Type, spacing and controls

Public intake update: see [language and typography review](CLIENT_INTAKE_LANGUAGE_AND_TYPE_AR.md). Its Arabic 400/500/600 faces are now self-hosted in `client/public/brand/fonts/ibm-plex-arabic/` with their OFL license; English uses the existing local Outfit. Public body/control text is 16px and helper text 14px. The public UI no longer relies on Google Fonts. Monospace content uses the system monospace fallback.

- Outfit 400/500/600: headings, navigation, buttons; wordmark always 400. The variable TTF is self-hosted at `/brand/fonts/outfit.ttf`, with `font-display: swap` and its OFL license alongside it.
- IBM Plex Sans Arabic/Cairo: existing Arabic body text and the Arabic fallback for Outfit. Existing Google Fonts loading remains; DM Mono is added there with `display=swap`. Numbers/IDs use `font-mono`.
- Controls: 8px radius; cards: 12px; borders: 1px. Pills and circular status indicators retain their shapes. Prefer whitespace and borders over shadows.
- Lucide icons remain, with rounded lines and 1.75px strokes. `OrbitLoader` provides the ring/satellite loading indicator, a status label and reduced-motion support.

## Regenerating assets

Application builds need no extra asset tooling: generated assets and the licensed font are committed. For intentional artwork regeneration, install development-only tools in the ignored `.test-data` directory:

```powershell
npm install --prefix .test-data/brand-tools --no-save --no-package-lock @resvg/resvg-js
python -m pip install --target .test-data/brand-tools/python fonttools Pillow
$env:PYTHONPATH = (Resolve-Path .test-data/brand-tools/python).Path
python scripts/generate-brand-assets.py --font client/public/brand/fonts/outfit.ttf
node scripts/render-brand-assets.mjs
```

The Python generator accepts the official Outfit variable font. If using a different font path, put its unmodified `OFL.txt` beside it. Outfit comes from the Google Fonts `ofl/outfit` family. No runtime application dependencies were added.

The document head wires favicon, manifest, theme-color and OG/Twitter images. Social images currently use root-relative paths because the production origin was not provided. Before public launch, set absolute image URLs (and canonical/og:url) using the approved production origin; do not invent a domain or change deployed URLs during a rebrand.
