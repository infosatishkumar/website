# DigitalNgage — agency website

Multi-page, fully animated static website for **DigitalNgage** (digitalngage.com).
It is separate from the Next.js portfolio in the repository root and runs on any
PHP shared hosting (Hostinger / cPanel).

## Pages

| Page | File |
| --- | --- |
| Home | `index.html` |
| Services (12 services) | `services.html` |
| Work / portfolio | `work.html` |
| KIO Organics case study | `case-study-kio-organics.html` |
| Metro CRM case study | `case-study-metro-crm.html` |
| About | `about.html` |
| Packages | `packages.html` |
| Insights (blog + 3 articles) | `blog.html`, `blog-*.html` |
| Contact (form → `contact.php`) | `contact.html` |
| 404 | `404.html` |

## Deploy

Upload **everything inside `public_html/`** to the hosting `public_html` folder.
The contact form emails leads to `contact@digitalngage.com` via `contact.php`.

## Edit

Pages are generated from `src/` so the header and footer stay identical everywhere:

- `src/pages/*.html` — page content (front-matter comment sets title, description, active menu)
- `src/partials/*.html` — shared head, header, footer, preloader
- `public_html/assets/css/main.css` — design system
- `public_html/assets/js/main.js` — animations (GSAP + ScrollTrigger + Lenis, bundled in `assets/vendor/`)

After editing anything in `src/`, rebuild:

```bash
python3 build.py
```

Social profile links in the footer are set in the `SOCIAL` dict at the top of `build.py`
(empty values are hidden).

## Animation notes

First-visit preloader, custom cursor, magnetic buttons, split-text
headline reveals, rotating hero word, interactive particle network, floating
glass cards, marquees, counters, stacking case-study cards, pinned horizontal
process section, parallax, spotlight/tilt cards and testimonial slider.
Everything falls back to a static layout when JavaScript is off or the visitor
has "reduce motion" enabled.
