#!/usr/bin/env python3
"""Build the DigitalNgage static site.

Each file in src/pages/ starts with a front-matter comment:

    <!--
    title: Page title
    description: Meta description
    nav: home            (which menu item is active)
    preloader: yes       (optional, home page only)
    base: root           (optional, 404 page: resolve links from site root)
    -->

The page body is wrapped with src/partials/{head,header,footer}.html and
written to public_html/. Placeholders:

    {{icon:name}}   inline SVG icon from ICONS below
    {{active:nav}}  marks the current menu link
    {{social}}      footer social links from SOCIAL below

Run:  python3 build.py
Then upload the contents of public_html/ to the hosting public_html folder.
"""
import re
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
OUT = ROOT / "public_html"

# Fill in profile URLs to show them in the footer (empty = hidden).
SOCIAL = {
    "whatsapp": "https://wa.me/919353241391",
    "instagram": "",
    "facebook": "",
    "linkedin": "",
}

# Client brands: logo (images/clients/<slug>.jpg), name, industry, one-line description, website.
# A website is listed only where it has been confirmed; leave "" to show the card without a link.
CLIENTS = [
    ("makemytrip", "MakeMyTrip", "Travel", "India's leading online travel company for flights, hotels and holidays.", "https://www.makemytrip.com"),
    ("luminous", "Luminous", "Energy · Power backup", "Inverters, batteries and solar solutions for homes and businesses.", "https://www.luminousindia.com"),
    ("cuemath", "Cuemath", "EdTech", "Online maths and coding classes for kids.", "https://www.cuemath.com"),
    ("et-money", "ET Money", "Fintech", "Investing and money-management app.", "https://www.etmoney.com"),
    ("mindtickle", "Mindtickle", "SaaS", "Sales readiness and enablement platform.", "https://www.mindtickle.com"),
    ("amagi", "Amagi", "Media technology", "Cloud technology for broadcast and streaming TV.", "https://www.amagi.com"),
    ("loom-solar", "Loom Solar", "Solar energy", "Solar panels, inverters and batteries for Indian homes.", "https://www.loomsolar.com"),
    ("imarticus-learning", "Imarticus Learning", "Education", "Professional courses in finance, analytics and technology.", "https://imarticus.org"),
    ("unlu", "Unlu", "EdTech · Creators", "Online classes from celebrated creators and artists.", "https://unlu.io"),
    ("amber", "Amber", "Travel · Student housing", "Student accommodation booking platform.", "https://amberstudent.com"),
    ("travel-khana", "Travel Khana", "Food delivery", "Food delivery to train passengers across India.", "https://www.travelkhana.com"),
    ("medikoe", "Medikoe", "Healthtech", "Healthcare platform for doctors, hospitals and diagnostics.", "https://www.medikoe.com"),
    ("starquik", "StarQuik", "Grocery e-commerce", "Online grocery delivery.", "https://www.starquik.com"),
    ("hotpack", "Hotpack", "Food packaging", "Food packaging manufacturer and distributor.", "https://www.hotpackglobal.com"),
    ("dogspot", "DogSpot", "Pet care e-commerce", "Online pet supplies store and pet community.", "https://www.dogspot.in"),
    ("orion-sutures", "Orion Sutures", "Medical devices", "Surgical sutures manufacturer based in Bengaluru.", ""),
    ("khanna-gems", "Khanna Gems", "Jewellery", "Certified gemstones and jewellery.", "https://www.khannagems.com"),
    ("ojas-ayurveda", "Ojas Ayurveda", "Ayurveda · Wellness", "Ayurvedic wellness brand.", ""),
    ("greensole", "GreenSole", "Sustainability", "Upcycled footwear — a step towards sustainability.", "https://greensole.com"),
    ("powermaster", "Powermaster", "Industrial", "Brand partner.", ""),
    ("no-scars", "No Scars", "Skincare · Torque Pharma", "Skincare brand from Torque Pharmaceuticals.", "https://torquepharma.com"),
    ("ketomac", "Ketomac", "Haircare · Torque Pharma", "Anti-dandruff haircare from Torque Pharmaceuticals.", "https://torquepharma.com/ketomac-shampoo"),
    ("torque", "Torque", "Pharmaceuticals", "Pharmaceutical company behind No Scars and Ketomac.", "https://torquepharma.com"),
    ("hempstrol", "Hempstrol", "Hemp wellness", "India's premier hemp company.", "https://hempstrol.com"),
    ("mfix", "MFIX", "Mobility", "Keeping you on the move.", ""),
    ("medbilling-experts", "MedBilling Experts", "Healthcare services", "Medical billing services — a Flatworld Solutions company.", "https://www.medbillingexperts.com"),
    ("kiran-udyog", "Kiran Udyog", "Manufacturing", "Industrial manufacturer.", ""),
    ("solvabuild", "Solvabuild", "Construction · Prefab", "Innovate · Design · Prefab.", ""),
    ("unlimited-greens", "Unlimited Greens", "Plants · Greens", "Brand partner.", ""),
    ("letstacle", "Letstacle", "EdTech", "Helping students around the globe.", "https://letstacle.com"),
    ("centum", "Centum", "Brand partner", "Brand partner.", ""),
    ("qmaths", "Qmaths.in", "Exam preparation", "Coaching for SSC, IBPS, Railways, LIC and SIDBI exams.", "https://qmaths.in"),
    ("pixel-institute", "Pixel Institute of Photography", "Education", "Photography institute in Delhi.", ""),
    ("getsmartcoders", "getSmartcoders", "IT services", "Software development — a Flatworld Solutions company.", "https://www.getsmartcoders.com"),
    ("flatworld-edge", "Flatworld Edge", "Outsourcing", "Business outsourcing services.", "https://www.flatworldedge.com"),
    ("entermission", "EnterMission", "Brand partner", "Brand partner.", ""),
    ("events-high", "Events High", "Events & experiences", "Discover and book events and experiences.", "https://www.eventshigh.com"),
    ("iq4i", "IQ4I", "Research & consulting", "Innovation at work.", "https://www.iq4i.com"),
    ("shorewise", "ShoreWise Consulting", "IT staffing & consulting", "Talent, technology and relationships.", ""),
    ("medbill", "Medbill", "Healthcare", "Brand partner.", ""),
    ("nutrifit", "NutriFit", "Nutrition", "Brand partner.", ""),
    ("liftup-marketing", "LiftUp Marketing", "Marketing", "Brand partner.", ""),
    ("colonelz", "Colonelz", "Construction · Interiors", "Construction and interior design.", ""),
    ("nurturelabz", "NurtureLabz Consulting", "Consulting", "Brand partner.", ""),
    ("sachin-gujar", "Sachin Gujar & Associates", "Chartered accountants", "Chartered accountancy firm.", ""),
    ("express-gift-service", "Express Gift Service", "Gifting", "Online gift delivery.", ""),
    ("homz", "Klean Homz", "Home services", "See the difference.", ""),
    ("anthyesti", "Anthyesti", "Funeral services", "End-to-end funeral and last-rites services.", "https://anthyesti.com"),
    ("ovntech", "OVN Tech", "Digital transformation", "Digital transformation services.", ""),
]
CLIENT_LOGOS = [(c[0], c[1]) for c in CLIENTS]


def client_tile(slug, label, lazy=True):
    return (f'<span class="clogo"><img src="images/clients/{slug}.jpg" alt="{label}" width="480" height="240"'
            f'{" loading=\"lazy\"" if lazy else ""}></span>')


def client_marquee():
    half = (len(CLIENT_LOGOS) + 1) // 2
    rows = []
    for i, part in enumerate((CLIENT_LOGOS[:half], CLIENT_LOGOS[half:])):
        tiles = "".join(client_tile(s, l, lazy=False) for s, l in part)
        hidden = "".join(client_tile(s, "", lazy=False).replace('alt=""', 'alt="" aria-hidden="true"') for s, _ in part)
        rows.append(f'<div class="marquee{" marquee--rev" if i else ""} clogos-row"><div class="marquee__track">{tiles}</div>'
                    f'<div class="marquee__track" aria-hidden="true">{hidden}</div></div>')
    return "\n".join(rows)


def client_cards():
    out = []
    for slug, name, industry, desc, url in CLIENTS:
        link = ""
        if url:
            host = url.split("//", 1)[1].split("/", 1)[0].replace("www.", "")
            link = f'<a class="link-arrow ccard__link" href="{url}" target="_blank" rel="noopener">{host} ↗</a>'
        out.append(
            f'      <article class="ccard ccard--brand" data-cat="partners" data-reveal>'
            f'<div class="ccard__brand"><img src="images/clients/{slug}.jpg" alt="{name} logo" width="480" height="240" loading="lazy"></div>'
            f'<div><h3>{name}</h3><small>{industry}</small></div>'
            f'<p>{desc}</p>{link}</article>')
    return "\n".join(out)


def client_wall():
    """'Trusted by 50+ brands' logo wall section (Work and Contact pages)."""
    return ('<section class="section white" data-nav-light id="brands">\n  <div class="wrap">\n    <div class="sec-head">\n      <div>\n'
            '        <span class="eyebrow" data-reveal>Brands we\'ve worked with</span>\n'
            '        <h2 class="h2" data-split>Trusted by <span class="serif grad-text">50+ brands.</span></h2>\n      </div>\n'
            '      <p class="lead" data-reveal>From startups and D2C labels to listed companies — marketing, websites, design and technology '
            'for brands across travel, education, health, energy, finance and retail.</p>\n    </div>\n'
            '    <div class="clogo-grid">\n' + client_grid() + '\n    </div>\n  </div>\n</section>\n')


def client_grid():
    return "\n".join(f'      <div class="clogo-card" data-reveal>{client_tile(s, l)}</div>' for s, l in CLIENT_LOGOS)


_S = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'
ICONS = {
    "arrow": f'<svg class="arrow" {_S}><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    "up": f'<svg {_S}><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    "chart": f'<svg {_S}><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/><path d="M16 7h4v4"/></svg>',
    "megaphone": f'<svg {_S}><path d="M3 11v2a2 2 0 0 0 2 2h2l5 4V5L7 9H5a2 2 0 0 0-2 2Z"/><path d="M16 8a5 5 0 0 1 0 8"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>',
    "search": f'<svg {_S}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6M11 8v6"/></svg>',
    "code": f'<svg {_S}><rect x="2" y="4" width="20" height="16" rx="3"/><path d="m9 10-2 2 2 2M15 10l2 2-2 2"/></svg>',
    "phone": f'<svg {_S}><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/></svg>',
    "target": f'<svg {_S}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
    "cart": f'<svg {_S}><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6"/></svg>',
    "crm": f'<svg {_S}><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    "pen": f'<svg {_S}><path d="M12 19 5 21l2-7L17.5 3.5a2.1 2.1 0 0 1 3 3Z"/><path d="m15 6 3 3"/></svg>',
    "video": f'<svg {_S}><rect x="2" y="5" width="14" height="14" rx="3"/><path d="m16 10 6-3v10l-6-3"/></svg>',
    "share": f'<svg {_S}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
    "mail": f'<svg {_S}><rect x="2" y="4" width="20" height="16" rx="3"/><path d="m22 7-10 6L2 7"/></svg>',
    "call": f'<svg {_S}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/></svg>',
    "clock": f'<svg {_S}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    "globe": f'<svg {_S}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    "rocket": f'<svg {_S}><path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1Z"/><path d="m12 15-3-3a22 22 0 0 1 2-4A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2Z"/><path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5"/></svg>',
    "shield": f'<svg {_S}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>',
    "users": f'<svg {_S}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>',
    "bolt": f'<svg {_S}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/></svg>',
    "eye": f'<svg {_S}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
    "heart": f'<svg {_S}><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/></svg>',
    "flask": f'<svg {_S}><path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3"/><path d="M7 15h10"/></svg>',
    "gem": f'<svg {_S}><path d="M6 3h12l4 6-10 12L2 9Z"/><path d="M2 9h20M12 21 8 9l4-6 4 6-4 12"/></svg>',
    "bot": f'<svg {_S}><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M8 4h8"/><circle cx="9" cy="14" r="1.2"/><circle cx="15" cy="14" r="1.2"/></svg>',
    "pin": f'<svg {_S}><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    "whatsapp": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-1 1.2-.4.2-.7.1a8.2 8.2 0 0 1-2.4-1.5 9 9 0 0 1-1.7-2.1c-.2-.3 0-.5.1-.6l.5-.5.3-.5a.6.6 0 0 0 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.4 3.4 0 0 0-1 2.5 5.9 5.9 0 0 0 1.2 3.1 13.4 13.4 0 0 0 5.2 4.6c.7.3 1.3.5 1.7.6a4 4 0 0 0 1.9.1 3 3 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3ZM12 21.8a9.9 9.9 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8Zm8.4-18.2A11.8 11.8 0 0 0 1.8 17.9L.1 24l6.3-1.6a11.8 11.8 0 0 0 5.6 1.4A11.8 11.8 0 0 0 20.4 3.6Z"/></svg>',
    "instagram": f'<svg {_S}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/></svg>',
    "facebook": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8V6.2c0-.8.2-1.2 1.4-1.2H17V2h-2.6C11.3 2 10 3.6 10 6.3V8H8v3h2v11h4V11h2.7l.3-3Z"/></svg>',
    "linkedin": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4V21H3Zm7 0h3.8v1.6h.1a4.2 4.2 0 0 1 3.8-2c4 0 4.8 2.6 4.8 6V21h-4v-5.2c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V21h-4Z"/></svg>',
}


def parse(path):
    text = path.read_text(encoding="utf-8")
    m = re.match(r"\s*<!--(.*?)-->\s*", text, re.S)
    meta = {}
    if m:
        for line in m.group(1).strip().splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        text = text[m.end():]
    return meta, text


def render(tpl, meta, name):
    nav = meta.get("nav", "")

    def icon(m):
        key = m.group(1)
        if key not in ICONS:
            raise SystemExit(f"{name}: unknown icon '{key}'")
        return ICONS[key]

    tpl = re.sub(r"\{\{icon:([a-z]+)\}\}", icon, tpl)
    tpl = re.sub(r"\{\{active:([a-z]+)\}\}",
                 lambda m: 'class="is-active" aria-current="page"' if m.group(1) == nav else "", tpl)
    social = "\n".join(
        f'          <a href="{url}" target="_blank" rel="noopener" aria-label="{k.title()}">{ICONS[k]}</a>'
        for k, url in SOCIAL.items() if url)
    canonical = "" if name == "index.html" else name
    values = {
        "title": meta.get("title", "DigitalNgage"),
        "description": meta.get("description", ""),
        "nav": nav or "page",
        "canonical": canonical,
        "og_image": meta.get("og_image", "images/og.jpg"),
        "version": VERSION,
        "social": social,
        "client_count": str(len(CLIENT_LOGOS)),
        "base": '<base href="/">\n' if meta.get("base") == "root" else "",
    }
    if "{{client_marquee}}" in tpl:
        tpl = tpl.replace("{{client_marquee}}", client_marquee())
    if "{{client_wall}}" in tpl:
        tpl = tpl.replace("{{client_wall}}", client_wall())
    if "{{client_cards}}" in tpl:
        tpl = tpl.replace("{{client_cards}}", client_cards())
    if "{{client_grid}}" in tpl:
        tpl = tpl.replace("{{client_grid}}", client_grid())
    for k, v in values.items():
        tpl = tpl.replace("{{" + k + "}}", v)
    left = re.findall(r"\{\{[^}]+\}\}", tpl)
    if left:
        raise SystemExit(f"{name}: unresolved placeholders {sorted(set(left))}")
    return tpl


VERSION = time.strftime("%Y%m%d%H%M")


def main():
    parts = {p.stem: p.read_text(encoding="utf-8") for p in (SRC / "partials").glob("*.html")}
    pages = sorted((SRC / "pages").glob("*.html"))
    for page in pages:
        meta, body = parse(page)
        pre = parts["preloader"] if meta.get("preloader") == "yes" else ""
        header = parts["header"].replace("{{preloader}}", pre)
        html = parts["head"] + header + body + parts["footer"]
        (OUT / page.name).write_text(render(html, meta, page.name), encoding="utf-8")
        print("built", page.name)

    urls = "\n".join(
        f"  <url><loc>https://digitalngage.com/{'' if p.name == 'index.html' else p.name}</loc></url>"
        for p in pages if p.name != "404.html")
    (OUT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + "\n</urlset>\n",
        encoding="utf-8")
    print("built sitemap.xml")


if __name__ == "__main__":
    main()
