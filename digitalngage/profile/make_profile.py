#!/usr/bin/env python3
"""Builds the DigitalNgage company profile (WhatsApp-friendly PDF).

    python3 profile/make_profile.py          # writes profile/profile.html
    node profile/print.js                    # writes profile/DigitalNgage-Company-Profile.pdf

Content comes from the website (build.py client list, case studies, packages),
so the profile and the site always say the same thing. Pages are 1080x1350
(4:5 portrait) so they read well on a phone.
"""
import csv
import importlib.util
import io
from html import escape as e
from pathlib import Path

import qrcode
import qrcode.image.svg

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("site_build", ROOT / "build.py")
B = importlib.util.module_from_spec(spec)
spec.loader.exec_module(B)
IMG = "../public_html/images"
ICON = B.ICONS

SITE = "https://digitalngage.com"
PHONE = "+91 93532 41391"
WA = "https://wa.me/919353241391?text=Hi%20DigitalNgage%2C%20I%27d%20like%20a%20free%20audit."
MAIL = "contact@digitalngage.com"


def ic(name, color="#fff", size=44):
    svg = ICON[name]
    return svg.replace("<svg ", f'<svg width="{size}" height="{size}" style="color:{color}" ', 1)


def qr(data):
    img = qrcode.make(data, image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=1)
    buf = io.BytesIO()
    img.save(buf)
    s = buf.getvalue().decode()
    return s[s.index("<svg"):]


def page(body, cls="", n=None):
    foot = "" if n is None else f'<div class="foot"><span>DigitalNgage · Company Profile</span><span>{SITE.replace("https://", "")}</span><span>{n:02d}</span></div>'
    return f'<section class="pg {cls}">{body}{foot}</section>'


SERVICES = [
    ("share", "Social Media Marketing", "Instagram, Facebook, LinkedIn & YouTube — content calendars, reels, carousels and community."),
    ("megaphone", "Meta & Google Ads", "ROI-first campaigns on Facebook, Instagram, Search, Shopping, Display & YouTube."),
    ("search", "SEO & Local SEO", "Technical, on-page and off-page SEO plus Google Business Profile to win page one."),
    ("code", "Website Development", "Fast, animated, mobile-first websites and landing pages built to convert."),
    ("cart", "E-commerce Stores", "Online stores with UPI, cards, COD and server-verified payments."),
    ("crm", "CRM & Custom Software", "Sales CRMs, quotation tools and dashboards built around your team."),
    ("target", "Lead Generation", "Funnels, landing pages and WhatsApp automation for sales-ready leads."),
    ("phone", "App Development", "iOS & Android apps with clean UI, solid backends and store launch."),
    ("pen", "Branding & Creative", "Logos, identity, posters, packaging and ad creatives that stop the scroll."),
    ("video", "Video & Reels", "Scripted reels, product shoots, explainers and motion graphics."),
    ("bot", "WhatsApp & Email Automation", "Auto-replies, broadcasts, cart nudges and lead nurturing on autopilot."),
    ("heart", "Reputation Management", "More five-star reviews and professional responses to every one."),
    ("building", "Structural Design & Engineering", "Design & analysis, 2D/3D detailing, industrial and commercial structures."),
]
COLORS = ["#ff5a1f", "#ffb020", "#7c4dff", "#0f1630", "#16a34a", "#2ed3ea", "#ff2e7e"]


def projects():
    with (ROOT / "src/data/delta-projects.csv").open(encoding="utf-8") as f:
        return [r for r in csv.DictReader(f) if r.get("name")]


def build():
    P = []
    # 1 — cover
    P.append(page(f'''
      <div class="cover-grid"></div>
      <div class="dot d1"></div><div class="dot d2"></div><div class="dot d3"></div>
      <img class="cover-logo" src="{IMG}/brand/logo-white.png" alt="DigitalNgage">
      <div class="kicker">Company Profile · 2026</div>
      <h1 class="cover-h">Marketing.<br>Technology.<br><span class="serif o">Engineering.</span></h1>
      <p class="cover-p">One growth team for social media, ads, SEO, websites, e-commerce, CRM software and structural engineering.</p>
      <div class="cover-stats">
        <div><b>50+</b><span>brands</span></div><div><b>13</b><span>services</span></div>
        <div><b>6,000+</b><span>leads in our CRM</span></div><div><b>100%</b><span>retention</span></div>
      </div>
      <div class="cover-contact"><span>{SITE.replace("https://", "")}</span><span>{PHONE}</span><span>{MAIL}</span></div>
    ''', "dark cover"))
    # 2 — about
    P.append(page(f'''
      <div class="kicker">Who we are</div>
      <h2>We treat your business <span class="serif o">like our own.</span></h2>
      <p class="lead">DigitalNgage is a results-first digital marketing &amp; technology agency. Creative strategy, data and engineering work together to move the numbers that matter — leads, sales and revenue.</p>
      <p class="body">We saw businesses juggling one agency for posts, another for ads, a freelancer for the website and spreadsheets for leads. Nothing talked to anything else, and leads slipped through the cracks. So we built DigitalNgage as one team that does it all: the reels and ads that create demand, the websites and stores that capture it, and the CRM software that turns every lead into a conversation.</p>
      <div class="stats4">
        <div><b class="o">50+</b><span>Brands we've worked with</span></div>
        <div><b>13</b><span>Services under one roof</span></div>
        <div><b>6,000+</b><span>Leads managed in a CRM we built</span></div>
        <div><b class="o">100%</b><span>Client retention</span></div>
      </div>
      <div class="mv">
        <div><small>Mission</small><p>Make world-class digital growth accessible to every Indian business — big-brand strategy, creative and technology at a scale and price that works for growing companies.</p></div>
        <div><small>Vision</small><p>Be the growth partner brands never want to leave, measured by the only metric that counts: our clients' results, month after month.</p></div>
      </div>
    ''', "", 2))
    # 3 — services
    cards = "".join(f'<div class="svc"><i style="background:{COLORS[k % len(COLORS)]}">{ic(s[0], "#fff", 40)}</i><div><b>{e(s[1])}</b><p>{e(s[2])}</p></div></div>' for k, s in enumerate(SERVICES))
    P.append(page(f'''
      <div class="kicker">What we do</div>
      <h2>13 services. <span class="serif o">One growth team.</span></h2>
      <div class="svcs">{cards}</div>
    ''', "svcs-page", 3))
    # 4 — structural engineering
    st = [("beam", "Structural Design & Analysis", ["Dead, live, wind & seismic load analysis", "Steel, RCC & composite member design", "Foundation & connection design", "Design calculation reports"]),
          ("layers", "Structural Detailing 2D / 3D", ["GA, fabrication & erection drawings", "RCC reinforcement detailing & BBS", "Bill of materials & tonnage", "3D models & clash checks"]),
          ("factory", "Industrial Structures", ["Pre-engineered buildings (PEB)", "Factory sheds & warehouses", "PUF panel & cold storage structures", "Mezzanines, crane gantries, pipe racks"]),
          ("building", "Residential & Commercial", ["Houses, villas & apartments", "Offices, showrooms & retail", "Schools, hospitals & hotels", "Earthquake-resistant design"])]
    blocks = "".join(f'<div class="st"><i>{ic(a, "#ff5a1f", 40)}</i><b>{e(b)}</b><ul>{"".join(f"<li>{e(x)}</li>" for x in c)}</ul></div>' for a, b, c in st)
    P.append(page(f'''
      <div class="kicker">Structural engineering</div>
      <h2>Structures that stand. <span class="serif o">Drawings that build.</span></h2>
      <p class="lead">The same team that runs your marketing can design the building behind it — engineered for safety, economy and fast execution on site.</p>
      <div class="sts">{blocks}</div>
      <div class="tools"><span>STAAD.Pro</span><span>ETABS</span><span>Tekla</span><span>AutoCAD</span><span>Revit</span><span>IS 456</span><span>IS 800</span><span>IS 875</span><span>IS 1893</span></div>
    ''', "dark", 4))
    # 5 — process
    steps = [("Discover & audit", "Your business, competitors and current digital presence."),
             ("Strategy", "A custom roadmap built around your goals, budget and industry."),
             ("Create & build", "Creatives, websites, stores and tools — designed and built in-house."),
             ("Launch", "Campaigns go live with precise targeting and A/B testing from day one."),
             ("Optimise & scale", "Daily monitoring, weekly tweaks, monthly reports. We scale what works.")]
    sh = "".join(f'<div class="step"><b>{i + 1:02d}</b><div><h3>{e(a)}</h3><p>{e(c)}</p></div></div>' for i, (a, c) in enumerate(steps))
    inc = ["Free audit & strategy", "Dedicated account manager", "WhatsApp support", "Monthly reports", "You own all accounts", "No lock-in contracts", "Transparent pricing"]
    P.append(page(f'''
      <div class="kicker">How we work</div>
      <h2>From audit to <span class="serif o">scale</span> in five moves.</h2>
      <div class="steps">{sh}</div>
      <div class="incl"><small>Every plan includes</small><div>{"".join(f"<span>✓ {e(x)}</span>" for x in inc)}</div></div>
    ''', "", 5))
    # 6 — KIO
    P.append(page(f'''
      <div class="kicker a">Case study · E-commerce</div>
      <h2>KIO <span class="serif a">Organics &amp; Foods.</span></h2>
      <p class="lead">A premium online store for raw honey, wood-pressed oils and desi ghee — 8 ways to pay, every payment verified on the server, plus the social media and ads that drive sales.</p>
      <div class="kio-media"><div class="frame"><img src="{IMG}/kio/hero-home.jpg"></div><div class="phone"><img src="{IMG}/kio/mobile-product.jpg"></div></div>
      <div class="kpis"><div><b>8</b><span>ways to pay incl. UPI &amp; COD</span></div><div><b>100%</b><span>online payments verified</span></div><div><b>2</b><span>auto emails per order</span></div></div>
      <div class="tags"><span>E-commerce</span><span>Razorpay</span><span>Social Media</span><span>Meta Ads</span></div>
      <a class="link" href="{SITE}/case-study-kio-organics.html">Read the case study → digitalngage.com/case-study-kio-organics.html</a>
    ''', "green", 6))
    # 7 — Metro CRM
    P.append(page(f'''
      <div class="kicker c">Case study · CRM software</div>
      <h2>Metro <span class="serif c">CRM.</span></h2>
      <p class="lead">A custom sales CRM for Metro Puf Industries &amp; Delta Infrastructures. Leads from Facebook, Google, IndiaMART and the website flow into one app — through follow-ups, quotations, job cards and payments, with an AI sales assistant built in.</p>
      <div class="crm-media"><div class="frame"><img src="{IMG}/crm/dashboard.jpg"></div><div class="frame f2"><img src="{IMG}/crm/quotation.jpg"></div></div>
      <div class="kpis k4"><div><b>6,000+</b><span>leads managed</span></div><div><b>27,000+</b><span>follow-up notes</span></div><div><b>20</b><span>modules</span></div><div><b>83%</b><span>smaller sync payload</span></div></div>
      <a class="link" href="{SITE}/case-study-metro-crm.html">Read the case study → digitalngage.com/case-study-metro-crm.html</a>
    ''', "navy", 7))
    # 8 — Delta
    P.append(page(f'''
      <div class="kicker">Case study · Structural engineering + growth</div>
      <h2>Delta <span class="serif o">Infrastructures.</span></h2>
      <p class="lead">A Bengaluru company that builds pre-engineered steel buildings, warehouses, mezzanines, schools and sports halls. DigitalNgage is their structural engineering and digital growth partner — website, Meta Ads, SEO, social media and the shared Metro CRM.</p>
      <div class="frame wide"><img src="{IMG}/delta/mosaic.jpg"></div>
      <div class="kpis"><div><b>20</b><span>completed projects</span></div><div><b>7.5L+</b><span>sq.ft built up</span></div><div><b>4</b><span>states — KA, AP, TS, Goa</span></div></div>
      <a class="link" href="{SITE}/case-study-delta-infrastructures.html">Read the case study → digitalngage.com/case-study-delta-infrastructures.html</a>
    ''', "", 8))
    # 9 — Delta projects
    rows = "".join(f'<tr><td><b>{e(r["name"])}</b></td><td>{e(r["structure_type"])}</td><td>{e(r["size"]) or "—"}</td><td>{e(r["location"])}</td></tr>' for r in projects())
    P.append(page(f'''
      <div class="kicker">Delta Infrastructures · Portfolio</div>
      <h2>20 completed <span class="serif o">steel buildings.</span></h2>
      <table class="ptable"><thead><tr><th>Project</th><th>Building type</th><th>Built-up area</th><th>Location</th></tr></thead><tbody>{rows}</tbody></table>
    ''', "proj-page", 9))
    # 10 — brands
    logos = "".join(f'<div class="lg"><img src="{IMG}/clients/{c[0]}.jpg" alt="{e(c[1])}"></div>' for c in B.CLIENTS)
    P.append(page(f'''
      <div class="kicker">Brands we've worked with</div>
      <h2>Trusted by <span class="serif o">50+ brands.</span></h2>
      <p class="lead">From startups and D2C labels to listed companies — marketing, websites, design and technology across travel, education, health, energy, finance and retail. Plus KIO Organics, Metro Puf Industries, Delta Infrastructures, Fenatek, Honoon Oil, MIAS International and Promag Engineering.</p>
      <div class="logos">{logos}</div>
    ''', "", 10))
    # 11 — packages
    pk = [("Starter", "For new & small businesses building their online presence.", ["2 social platforms managed", "12 posts + 4 reels per month", "Meta Ads setup & management", "Google Business Profile optimisation", "Basic SEO for your website", "Monthly performance report"], False),
          ("Growth", "For brands ready to scale leads & sales consistently.", ["3–4 social platforms managed", "20 posts + 8 reels per month", "Meta + Google Ads with A/B testing", "Full SEO — technical, on-page, links", "Landing page & lead funnel", "WhatsApp lead alerts & follow-up", "Dedicated account manager"], True),
          ("Enterprise", "For companies that want marketing + technology as one engine.", ["Everything in Growth", "Custom website or e-commerce store", "Custom CRM / sales software", "Video production & shoots", "Marketing automation", "AI assistants & integrations"], False)]
    ph = "".join(f'<div class="pk{" hot" if hot else ""}">{"<em>Most popular</em>" if hot else ""}<h3>{n}</h3><p>{d}</p><small>Custom quote after a free audit</small><ul>{"".join(f"<li>{e(x)}</li>" for x in items)}</ul></div>' for n, d, items, hot in pk)
    one = [("Business website", "2–4 weeks"), ("E-commerce store", "4–8 weeks"), ("CRM / custom software", "Scope based"), ("Brand identity", "1–3 weeks"), ("Mobile app", "Scope based"), ("Landing page + funnel", "1–2 weeks")]
    oh = "".join(f'<div><b>{e(a)}</b><span>{e(b)}</span></div>' for a, b in one)
    P.append(page(f'''
      <div class="kicker">Packages</div>
      <h2>Plans that <span class="serif o">grow with you.</span></h2>
      <p class="lead">Month-to-month, no lock-ins. Ad spend is paid directly to Meta / Google from your own account.</p>
      <div class="pks">{ph}</div>
      <div class="one"><small>One-time projects</small><div class="onegrid">{oh}</div></div>
    ''', "pk-page", 11))
    # 12 — why us + industries
    why = [("Multi-industry experience", "Manufacturing, organic foods, construction, engineering, oil & gas and tech."),
           ("Marketing + technology", "We build the stores, landing pages and CRMs that turn clicks into revenue."),
           ("ROI-focused strategy", "Every plan is engineered for maximum return on your investment."),
           ("Dedicated account team", "A manager who knows your brand and answers on WhatsApp."),
           ("Full transparency", "Clear monthly reports — what's done, why, and what it delivers."),
           ("No long-term lock-ins", "We earn your business every month through results, not contracts.")]
    wh = "".join(f'<div class="why"><b>{i + 1:02d}</b><div><h3>{e(a)}</h3><p>{e(c)}</p></div></div>' for i, (a, c) in enumerate(why))
    ind = ["Manufacturing", "Organic & FMCG", "D2C & E-commerce", "Construction & Infra", "Engineering", "Oil & Energy", "Technology", "Import / Export", "Healthcare", "Education", "Real Estate", "Restaurants & Retail"]
    P.append(page(f'''
      <div class="kicker">Why DigitalNgage</div>
      <h2>Built different. <span class="serif o">Measured daily.</span></h2>
      <div class="whys">{wh}</div>
      <div class="ind"><small>Industries we serve</small><div>{"".join(f"<span>{e(x)}</span>" for x in ind)}</div></div>
    ''', "dark", 12))
    # 13 — contact
    P.append(page(f'''
      <img class="end-logo" src="{IMG}/brand/logo-white.png" alt="DigitalNgage">
      <h2 class="end-h">Let's grow <span class="serif o">together.</span></h2>
      <p class="lead c">Get a free digital audit — website, SEO, social and ads — plus a custom strategy and a clear quote within 24 hours.</p>
      <div class="qrs">
        <a class="qr" href="{SITE}"><div class="qrbox">{qr(SITE)}</div><b>Visit our website</b><span>digitalngage.com</span></a>
        <a class="qr" href="{WA}"><div class="qrbox">{qr(WA)}</div><b>Chat on WhatsApp</b><span>{PHONE}</span></a>
      </div>
      <div class="contacts">
        <a href="tel:+919353241391">{ic("call", "#ff5a1f", 34)}<span>{PHONE}</span></a>
        <a href="{WA}">{ic("whatsapp", "#25d366", 34)}<span>WhatsApp us</span></a>
        <a href="mailto:{MAIL}">{ic("mail", "#ff5a1f", 34)}<span>{MAIL}</span></a>
        <a href="{SITE}">{ic("globe", "#ff5a1f", 34)}<span>digitalngage.com</span></a>
      </div>
      <div class="sitemap">
        <a href="{SITE}/services.html">Services</a><a href="{SITE}/work.html">Our Work</a><a href="{SITE}/structural-engineering.html">Structural Engineering</a>
        <a href="{SITE}/packages.html">Packages</a><a href="{SITE}/blog.html">Insights</a><a href="{SITE}/contact.html">Free Audit</a>
      </div>
    ''', "dark end"))
    css = (Path(__file__).parent / "profile.css").read_text(encoding="utf-8")
    html = ('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>DigitalNgage — Company Profile</title>'
            '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=Instrument+Serif:ital@0;1&family=Sora:wght@600;700;800&display=swap" rel="stylesheet">'
            f'<style>{css}</style></head><body>' + "".join(P) + "</body></html>")
    (Path(__file__).parent / "profile.html").write_text(html, encoding="utf-8")
    print("wrote profile.html with", len(P), "pages")


if __name__ == "__main__":
    build()
