/* DigitalNgage showreel — deterministic GSAP timeline.
   The page never plays in real time: render.js calls REEL.seek(t) for every frame.
   Every cut sits on the music grid (128 BPM) and every sound effect is registered
   in window.SFX so music.py can place it on the exact same frame. */
(function () {
  "use strict";
  var BPM = 128, B = 60 / BPM, BAR = 4 * B, DUR = 60;
  var at = function (bar, beat) { return bar * BAR + (beat || 0) * B; };
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var SFX = [];
  function sfx(type, t, extra) { var o = { type: type, t: +t.toFixed(4) }; for (var k in extra) o[k] = extra[k]; SFX.push(o); }

  // seeded random so every render is identical
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var R = rng(20261008);

  var ICON = {
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    megaphone: '<path d="M3 11v2a2 2 0 0 0 2 2h2l5 4V5L7 9H5a2 2 0 0 0-2 2Z"/><path d="M16 8a5 5 0 0 1 0 8"/><path d="M19 5a9 9 0 0 1 0 14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6M11 8v6"/>',
    code: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m9 10-2 2 2 2M15 10l2 2-2 2"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6"/>',
    crm: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
    pen: '<path d="M12 19 5 21l2-7L17.5 3.5a2.1 2.1 0 0 1 3 3Z"/><path d="m15 6 3 3"/>',
    video: '<rect x="2" y="5" width="14" height="14" rx="3"/><path d="m16 10 6-3v10l-6-3"/>',
    bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M8 4h8"/><circle cx="9" cy="14" r="1.2"/><circle cx="15" cy="14" r="1.2"/>',
    heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>'
  };
  function svg(name, color) { return '<svg viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICON[name] + '</svg>'; }

  var SERVICES = [
    ["SOCIAL MEDIA", "Social Media Marketing", "share", "Reels, content & community"],
    ["META & GOOGLE ADS", "Meta & Google Ads", "megaphone", "ROI-first performance campaigns"],
    ["SEO", "SEO & Local SEO", "search", "Win Page #1 on Google"],
    ["WEBSITES", "Website Development", "code", "Fast, animated, built to convert"],
    ["E-COMMERCE", "E-commerce Stores", "cart", "UPI, cards & COD checkout"],
    ["CRM SOFTWARE", "CRM & Custom Software", "crm", "Built around how your team sells"],
    ["LEAD GENERATION", "Lead Generation", "target", "Sales-ready leads, not junk"],
    ["MOBILE APPS", "App Development", "phone", "iOS & Android apps"],
    ["BRANDING", "Branding & Creative", "pen", "An identity people remember"],
    ["VIDEO & REELS", "Video & Reels", "video", "Content that stops the scroll"],
    ["AUTOMATION", "WhatsApp & Email Automation", "bot", "Follow-ups on autopilot"],
    ["REPUTATION", "Reputation Management", "heart", "Five-star trust"]
  ];
  var PALETTE = [
    { bg: "#ff5a1f", fg: "#fff", ib: "#0a0a14", ic: "#ff5a1f" },
    { bg: "#0a0a14", fg: "#fff", ib: "#ff5a1f", ic: "#fff" },
    { bg: "#ffb020", fg: "#0a0a14", ib: "#0a0a14", ic: "#ffb020" },
    { bg: "#7c4dff", fg: "#fff", ib: "#fff", ic: "#7c4dff" },
    { bg: "#fff8f3", fg: "#0a0a14", ib: "#ff5a1f", ic: "#fff" },
    { bg: "#0f1630", fg: "#fff", ib: "#ffb020", ic: "#0a0a14" }
  ];

  // ── build dynamic DOM ─────────────────────────────
  var sp = $("#spanels");
  SERVICES.forEach(function (s, i) {
    var p = PALETTE[i % PALETTE.length];
    var d = document.createElement("div");
    d.className = "spanel"; d.id = "sp" + i; d.style.background = p.bg; d.style.color = p.fg; d.style.visibility = "hidden";
    d.innerHTML = '<div class="num">' + String(i + 1).padStart(2, "0") + ' / 12</div><div class="ico" style="background:' + p.ib + '">' + svg(s[2], p.ic) + '</div><div><div class="sora big">' + s[0] + '</div><div class="desc">' + s[3] + '</div></div>';
    sp.appendChild(d);
  });
  var grid = $("#sgrid");
  SERVICES.forEach(function (s, i) {
    var c = document.createElement("div");
    c.className = "scard"; c.style.position = "relative";
    c.innerHTML = '<div class="hl"></div><div class="ic" style="position:relative">' + svg(s[2], "#fff") + '</div><b style="position:relative">' + s[1] + '</b>';
    grid.appendChild(c);
  });
  var ROT = ["GO VIRAL.", "SELL ONLINE.", "RANK #1.", "GET LEADS.", "SCALE FAST.", "CONVERT.", "STAND OUT.", "GROW."];
  var rot = $("#k-rot");
  ROT.forEach(function (w, i) {
    var d = document.createElement("div");
    d.className = "sora abs"; d.style.cssText = "left:0;right:0;top:0;text-align:center;font-size:210px;visibility:hidden;color:" + (i % 2 ? "#fff" : "#ff5a1f");
    d.textContent = w; d.id = "kr" + i; rot.appendChild(d);
  });
  var CUTS = [["services-sidebar", "SERVICES"], ["work", "WORK"], ["packages", "PACKAGES"], ["article", "INSIGHTS"], ["contact", "CONTACT"], ["cs-kio", "CASE STUDIES"]];
  var cuts = $("#s-cuts");
  CUTS.forEach(function (c, i) {
    var d = document.createElement("div");
    d.className = "cutcard"; d.id = "cut" + i; d.style.visibility = "hidden";
    d.innerHTML = '<div class="browser"><div class="bbar"><i></i><i></i><i></i><span>digitalngage.com/' + c[0].replace("cs-kio", "case-study-kio-organics") + '.html</span></div><img src="assets/' + c[0] + '.jpg"></div>';
    cuts.appendChild(d);
    var l = document.createElement("div");
    l.className = "pill cutlabel"; l.id = "cutl" + i; l.style.visibility = "hidden"; l.style.background = "#ff5a1f"; l.style.color = "#fff"; l.style.fontSize = "30px"; l.textContent = c[1];
    cuts.appendChild(l);
  });
  var PAY = [["phonepe", "PhonePe"], ["gpay", "Google Pay"], ["paytm", "Paytm"], ["whatsapp", "WhatsApp Pay"], ["card", "Cards"], ["netbanking", "Net Banking"], ["wallet", "Wallets"], ["cod", "Cash on Delivery"]];
  var chipPos = [[60, 230], [1590, 230], [60, 430], [1590, 430], [60, 630], [1590, 630], [60, 830], [1530, 830]];
  var kc = $("#kio-chips");
  PAY.forEach(function (p, i) {
    var d = document.createElement("div");
    d.className = "chip"; d.id = "chip" + i; d.style.left = chipPos[i][0] + "px"; d.style.top = chipPos[i][1] + "px"; d.style.visibility = "hidden";
    d.innerHTML = '<img src="assets/pay/' + p[0] + '.svg">' + p[1];
    kc.appendChild(d);
  });
  var FLOW = [["Enquiry", "Ads · IndiaMART · web"], ["Lead", "De-duplicated"], ["Follow-up", "Notes & reminders"], ["Quotation", "Auto-calculated"], ["Job card", "Production"], ["Payment", "Reconciled"]];
  var cf = $("#crm-flow");
  FLOW.forEach(function (f, i) {
    var d = document.createElement("div");
    d.className = "flowchip"; d.id = "fl" + i; d.style.left = (120 + i * 285) + "px"; d.style.visibility = "hidden";
    d.innerHTML = '<small>STEP ' + (i + 1) + '</small><b>' + f[0] + '</b>';
    cf.appendChild(d);
  });
  var DECK = [["leads", "Leads & Customers"], ["lead-view", "Lead view"], ["quotation", "Quotation builder"], ["reports", "Reports"]];
  var dk = $("#crm-deck");
  DECK.forEach(function (c, i) {
    var d = document.createElement("div");
    d.className = "deck"; d.id = "dk" + i; d.style.left = (240 + i * 110) + "px"; d.style.top = (150 + i * 40) + "px"; d.style.visibility = "hidden";
    d.innerHTML = '<div class="browser"><div class="bbar"><i></i><i></i><i></i><span>Metro CRM · ' + c[1] + '</span></div><img src="assets/crm-' + c[0] + '.jpg" style="width:1100px"></div>';
    dk.appendChild(d);
  });
  var CLIENTS = ["Metro Puf Industries", "KIO Organics", "Delta Infrastructures", "Fenatek", "Honoon Oil", "MIAS International", "Promag Engineering"];
  for (var r = 0; r < 4; r++) {
    var html = "";
    for (var k = 0; k < 4; k++) CLIENTS.forEach(function (c, j) { html += '<span class="' + ((j + r) % 3 === 0 ? "f" : "") + '">' + c + '</span>'; });
    $("#cr" + r).innerHTML = html;
  }

  // ── timeline helpers ──────────────────────────────
  var tl = gsap.timeline({ paused: true, defaults: { ease: "expo.out" } });
  gsap.set(".scene", { autoAlpha: 0 });
  function scene(id, t0, t1) { tl.set(id, { autoAlpha: 1 }, t0); if (t1 != null) tl.set(id, { autoAlpha: 0 }, t1); }
  // hidden from the start, visible only inside [t0, t1)
  function show(el, t0, t1) { gsap.set(el, { autoAlpha: 0 }); tl.set(el, { autoAlpha: 1 }, t0); if (t1 != null) tl.set(el, { autoAlpha: 0 }, t1); }
  function flash(t, color, o, d) { tl.set("#flash", { opacity: o == null ? 0.9 : o, backgroundColor: color || "#fff" }, t); tl.to("#flash", { opacity: 0, duration: d || 0.22, ease: "power2.out" }, t + 0.001); }
  function shake(t, amp, dur) {
    var n = Math.max(4, Math.round(dur / 0.035)), step = dur / n;
    for (var i = 0; i < n; i++) {
      var f = 1 - i / n;
      tl.to("#cam", { x: (R() * 2 - 1) * amp * f, y: (R() * 2 - 1) * amp * f, rotation: (R() * 2 - 1) * amp * 0.03 * f, duration: step, ease: "none" }, t + i * step);
    }
    tl.to("#cam", { x: 0, y: 0, rotation: 0, duration: step, ease: "none" }, t + dur);
  }
  function punch(t, s) { tl.to("#cam", { scale: s || 1.05, duration: 0.05, ease: "none" }, t); tl.to("#cam", { scale: 1, duration: 0.4, ease: "power3.out" }, t + 0.05); }
  function slam(el, t, from, d) { tl.fromTo(el, { scale: from || 2.2, opacity: 0, filter: "blur(16px)" }, { scale: 1, opacity: 1, filter: "blur(0px)", duration: d || 0.24, ease: "expo.out" }, t); }
  function glitch(el, t, d) {
    d = d || 0.16; var n = 5;
    for (var i = 0; i < n; i++) tl.set(el, { x: (R() * 2 - 1) * 40, skewX: (R() * 2 - 1) * 14, textShadow: "-12px 0 #ff5a1f, 12px 0 #7c4dff" }, t + i * d / n);
    tl.set(el, { x: 0, skewX: 0, textShadow: "0 0 0 rgba(0,0,0,0)" }, t + d);
  }
  function counter(el, t, from, to, dur, fmt) {
    var o = { v: from };
    tl.fromTo(o, { v: from }, { v: to, duration: dur, ease: "power3.out", onUpdate: function () { el.textContent = fmt(o.v); } }, t);
    var ticks = Math.min(10, Math.round(dur / 0.06));
    for (var i = 0; i < ticks; i++) sfx("tick", t + i * dur * 0.7 / ticks, { gain: 0.5 });
  }
  var inr = function (v) { return Math.round(v).toLocaleString("en-IN"); };

  // ══ 1. INTRO 0 – 3.75 ═════════════════════════════
  scene("#s-intro", 0, at(2));
  var iw = $$(".iw");
  iw.forEach(function (w, i) {
    var t = 0.12 + i * (B * 0.5);
    tl.fromTo(w, { yPercent: 120, opacity: 0, rotate: 6 }, { yPercent: 0, opacity: 1, rotate: 0, duration: 0.3 }, t);
    sfx("click", t, { gain: 0.8 });
  });
  tl.fromTo("#i-strike", { scaleX: 0 }, { scaleX: 1, duration: 0.18, ease: "power4.out" }, at(0, 3) + 0.05);
  sfx("swish", at(0, 3), { gain: 0.6 });
  tl.to("#i-lines", { y: -260, opacity: 0, filter: "blur(10px)", duration: 0.35, ease: "power3.in" }, at(1) - 0.12);
  tl.fromTo("#i-logo", { opacity: 0 }, { opacity: 1, duration: 0.01 }, at(1) - 0.05);
  tl.fromTo("#i-line", { attr: { "stroke-dashoffset": 120 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.8, ease: "power2.inOut" }, at(1));
  tl.fromTo("#i-arrow", { attr: { "stroke-dashoffset": 40 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.25, ease: "power2.out" }, at(1, 1.6));
  $$(".i-dot").forEach(function (d, i) {
    tl.fromTo(d, { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.35, ease: "back.out(3)" }, at(1, i * 0.5));
    sfx("pop", at(1, i * 0.5), { gain: 0.7, pitch: 1 + i * 0.25 });
  });
  tl.fromTo("#i-word", { clipPath: "inset(0 100% 0 0)", x: -40 }, { clipPath: "inset(0 0% 0 0)", x: 0, duration: 0.45, ease: "expo.out" }, at(1, 2));
  sfx("hit", at(1, 2), { gain: 0.8 });
  tl.fromTo("#i-tag", { opacity: 0, letterSpacing: "0.8em" }, { opacity: 0.85, letterSpacing: "0.32em", duration: 0.6, ease: "power3.out" }, at(1, 2.5));
  tl.to("#s-intro", { scale: 4, filter: "blur(20px)", opacity: 0, duration: 0.3, ease: "power3.in" }, at(2) - 0.3);
  sfx("riser", at(1), { dur: BAR, gain: 0.7 });
  sfx("reverse", at(2) - 0.9, { dur: 0.9, gain: 0.6 });

  // ══ 2. KINETIC 3.75 – 7.5 ═════════════════════════
  scene("#s-kin", at(2), at(4));
  var kb = ["#0a0a14", "#fff8f3", "#ff5a1f", "#ffb020"];
  for (var i = 0; i < 4; i++) {
    var t = at(2, i);
    tl.set("#kbg", { backgroundColor: kb[i] }, t);
    show("#k" + i, t, at(2, i + 1));
    slam("#k" + i, t, i === 3 ? 0.6 : 2.4, 0.22);
    flash(t, i === 1 ? "#0a0a14" : "#fff", 0.35, 0.12);
    punch(t, 1.04);
    sfx("hit", t, { gain: 1 });
  }
  tl.set("#kbg", { backgroundColor: "#0a0a14" }, at(3));
  show("#k-make", at(3));
  slam("#k-mk", at(3), 1.6, 0.25);
  ROT.forEach(function (w, j) {
    var t = at(3, j * 0.5), el = "#kr" + j;
    show(el, t, t + B * 0.5 + 0.12);
    tl.fromTo(el, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.14, ease: "expo.out" }, t);
    tl.to(el, { yPercent: -110, opacity: 0, duration: 0.12, ease: "power2.in" }, t + B * 0.5);
    sfx("swish", t, { gain: 0.45, short: true });
  });
  shake(at(3, 3.5), 10, 0.5);
  tl.to("#s-kin", { scale: 0.86, filter: "blur(8px)", duration: 0.25, ease: "power2.in" }, at(4) - 0.25);
  sfx("riser", at(3), { dur: BAR, gain: 0.9 });

  // ══ 3. SERVICES 7.5 – 15 ══════════════════════════
  var T_DROP = at(4);
  scene("#s-svc", T_DROP, T_DROP + 12 * B * 0.5);
  flash(T_DROP, "#fff", 1, 0.3); shake(T_DROP, 26, 0.45);
  sfx("impact", T_DROP, { gain: 1 });
  SERVICES.forEach(function (s, i) {
    var t = T_DROP + i * B * 0.5, el = "#sp" + i, dir = i % 2 ? -1 : 1;
    show(el, t, t + B * 0.5);
    tl.fromTo(el + " .big", { x: 380 * dir, opacity: 0, skewX: -14 * dir }, { x: 0, opacity: 1, skewX: 0, duration: 0.2 }, t);
    tl.fromTo(el + " .ico", { scale: 0.3, rotate: -40 * dir }, { scale: 1, rotate: 0, duration: 0.24, ease: "back.out(2)" }, t);
    tl.fromTo(el + " .desc", { y: 40, opacity: 0 }, { y: 0, opacity: 0.85, duration: 0.2 }, t + 0.04);
    sfx(i % 2 ? "swish" : "hit", t, { gain: i % 2 ? 0.6 : 0.55, short: true });
  });
  var T_GRID = T_DROP + 12 * B * 0.5;
  scene("#s-grid", T_GRID, at(8));
  var cards = $$("#sgrid .scard");
  cards.forEach(function (c, i) {
    tl.fromTo(c, { z: -900, rotateX: 60 * (R() - 0.5), rotateY: 80 * (R() - 0.5), y: 300 * (R() - 0.5), opacity: 0 }, { z: 0, rotateX: 0, rotateY: 0, y: 0, opacity: 1, duration: 0.55, ease: "expo.out" }, T_GRID + i * 0.045);
  });
  sfx("whoosh", T_GRID, { dur: 0.6, gain: 0.8 });
  slam("#g-head", at(5, 2), 1.8, 0.3);
  sfx("hit", at(5, 2), { gain: 0.9 });
  tl.fromTo("#sgrid", { scale: 1 }, { scale: 1.06, duration: at(8) - T_GRID - 0.5, ease: "none" }, T_GRID);
  cards.forEach(function (c, i) {
    var t = at(6) + i * B * 0.25;
    tl.fromTo(c.querySelector(".hl"), { opacity: 0 }, { opacity: 1, duration: 0.05, ease: "none" }, t);
    tl.to(c.querySelector(".hl"), { opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.1);
    sfx("blip", t, { gain: 0.35, pitch: 1 + (i % 4) * 0.12 });
  });
  cards.forEach(function (c, i) {
    var a = R() * Math.PI * 2;
    tl.to(c, { x: Math.cos(a) * 1600, y: Math.sin(a) * 1000, rotate: (R() - 0.5) * 120, opacity: 0, duration: 0.45, ease: "power3.in" }, at(7, 3) - 0.1);
  });
  tl.to("#g-head", { scale: 3, opacity: 0, filter: "blur(12px)", duration: 0.4, ease: "power3.in" }, at(7, 3) - 0.1);
  sfx("riser", at(6, 2), { dur: B * 6, gain: 0.8 });

  // ══ 4. WEBSITES 15 – 22.5 ═════════════════════════
  var T_WEB = at(8);
  scene("#s-web", T_WEB, at(10, 2));
  flash(T_WEB, "#ff5a1f", 0.9, 0.3); shake(T_WEB, 20, 0.4); sfx("impact", T_WEB, { gain: 0.95 });
  slam("#w-title", T_WEB, 1.8, 0.3);
  tl.to("#w-title", { scale: 0.7, y: -160, opacity: 0, filter: "blur(10px)", duration: 0.35, ease: "power3.in", transformOrigin: "0% 0%" }, at(8, 2) - 0.1);
  tl.fromTo("#webwrap", { y: 1200, rotateX: 50, opacity: 1 }, { y: 0, rotateX: 0, duration: 0.6, ease: "expo.out" }, at(8, 2));
  tl.fromTo("#webbrowser", { rotateY: -4 }, { rotateY: -16, duration: at(10, 2) - at(8, 2), ease: "none" }, at(8, 2));
  sfx("whoosh", at(8, 2), { dur: 0.5, gain: 0.8 });
  var scrollEnd = -(11153 * (1180 / 1440) - 700);
  tl.fromTo("#webimg", { y: 0 }, { y: scrollEnd, duration: at(10, 1.5) - at(8, 3), ease: "power2.inOut" }, at(8, 3));
  sfx("scroll", at(8, 3), { dur: at(10, 1.5) - at(8, 3), gain: 0.5 });
  ["#ph0", "#ph1", "#ph2"].forEach(function (p, i) {
    var t = at(9, i);
    tl.fromTo(p, { y: 900, rotate: 25 - i * 12, opacity: 0 }, { y: 0, rotate: [-8, 6, -3][i], opacity: 1, duration: 0.5, ease: "expo.out" }, t);
    tl.to(p, { y: -30 - i * 10, duration: at(10, 2) - t - 0.5, ease: "sine.inOut" }, t + 0.5);
    sfx("swish", t, { gain: 0.55 });
  });
  var T_CUT = at(10, 2);
  scene("#s-cuts", T_CUT, at(12));
  CUTS.forEach(function (c, i) {
    var t = T_CUT + i * B, el = "#cut" + i, dir = i % 2 ? -1 : 1;
    show(el, t, t + B + 0.2); show("#cutl" + i, t, t + B);
    tl.fromTo(el, { x: 2100 * dir, rotate: 6 * dir, skewX: -10 * dir, scale: 0.9 }, { x: 0, rotate: (R() - 0.5) * 3, skewX: 0, scale: 1, duration: 0.26, ease: "expo.out" }, t);
    tl.to(el, { scale: 0.86, x: -500 * dir, opacity: 0, filter: "blur(6px)", duration: 0.2, ease: "power2.in" }, t + B);
    slam("#cutl" + i, t + 0.05, 1.8, 0.2);
    sfx("shutter", t, { gain: 0.7 });
  });
  sfx("riser", at(11), { dur: BAR, gain: 0.7 });

  // ══ 5. KIO 22.5 – 31.875 ══════════════════════════
  var T_KIO = at(12);
  scene("#s-kio", T_KIO, at(17));
  tl.fromTo("#kio-bg", { clipPath: "circle(0% at 50% 50%)" }, { clipPath: "circle(80% at 50% 50%)", duration: 0.45, ease: "expo.out" }, T_KIO);
  sfx("impact", T_KIO, { gain: 1 }); shake(T_KIO, 18, 0.35);
  show("#kio-title", T_KIO, at(13));
  slam("#kio-title .cs-title", T_KIO + 0.08, 2.4, 0.3);
  tl.fromTo("#kio-title .label", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.3 }, T_KIO + 0.2);
  tl.fromTo("#kio-sub", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.6, ease: "power2.out" }, at(12, 2));
  sfx("type", at(12, 2), { dur: 0.6, gain: 0.5 });
  glitch("#kio-title .cs-title", at(12, 3.6), 0.15); sfx("glitch", at(12, 3.6), { gain: 0.6 });
  show("#kio-shot", at(13), at(14, 2.5));
  tl.fromTo("#kio-shot", { y: 900, scale: 0.8, rotateX: 30 }, { y: 0, scale: 1, rotateX: 0, duration: 0.5, ease: "expo.out" }, at(13));
  tl.fromTo("#kio-heroimg", { scale: 1.25 }, { scale: 1, duration: BAR * 1.6, ease: "power1.out" }, at(13));
  sfx("whoosh", at(13), { dur: 0.45, gain: 0.8 });
  PAY.forEach(function (p, i) {
    var t = at(13, 2) + i * B * 0.5;
    show("#chip" + i, t, at(14, 2.5));
    tl.fromTo("#chip" + i, { scale: 0, rotate: (i % 2 ? 1 : -1) * 20 }, { scale: 1, rotate: 0, duration: 0.3, ease: "back.out(2.5)" }, t);
    sfx("pop", t, { gain: 0.6, pitch: 1 + i * 0.07 });
  });
  tl.to("#kio-shot, #kio-chips .chip", { scale: 0.6, opacity: 0, filter: "blur(10px)", duration: 0.3, ease: "power3.in", stagger: 0.01 }, at(14, 2.5) - 0.3);
  show("#kio-statsbg", at(14, 2.5), at(15, 2.5)); show("#kio-stats", at(14, 2.5), at(15, 2.5));
  flash(at(14, 2.5), "#ffb020", 0.6, 0.2); sfx("hit", at(14, 2.5), { gain: 0.9 });
  $$("#kio-stats .statbox").forEach(function (b, i) {
    var t = at(14, 2.5) + i * B;
    tl.fromTo(b, { y: 160, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35 }, t);
    sfx("hit", t, { gain: 0.6, short: true });
  });
  counter($("#kc0"), at(14, 2.5), 0, 8, 0.7, function (v) { return Math.round(v); });
  counter($("#kc1"), at(14, 3.5), 0, 100, 0.8, function (v) { return Math.round(v) + "%"; });
  counter($("#kc2"), at(15, 0.5), 0, 2, 0.5, function (v) { return Math.round(v); });
  show("#kio-phones", at(15, 2.5), at(17));
  flash(at(15, 2.5), "#fff", 0.6, 0.2); sfx("impact", at(15, 2.5), { gain: 0.7 });
  tl.fromTo("#kio-mlabel", { opacity: 0, x: -60 }, { opacity: 1, x: 0, duration: 0.35 }, at(15, 2.5));
  tl.fromTo("#kio-prod", { scale: 1.2 }, { scale: 1, duration: BAR * 1.5, ease: "none" }, at(15, 2.5));
  $$(".kph").forEach(function (p, i) {
    var t = at(15, 3) + i * B * 0.5;
    tl.fromTo(p, { y: 1000, rotate: (i % 2 ? 1 : -1) * 14 }, { y: 0, rotate: (i % 2 ? 1 : -1) * 2, duration: 0.55, ease: "expo.out" }, t);
    tl.to(p, { y: (i % 2 ? -40 : 30), duration: at(17) - t - 0.55, ease: "sine.inOut" }, t + 0.55);
    sfx("swish", t, { gain: 0.5, short: true });
  });
  tl.to("#s-kio", { scale: 1.6, opacity: 0, filter: "blur(14px)", duration: 0.3, ease: "power3.in" }, at(17) - 0.3);
  sfx("riser", at(16), { dur: BAR, gain: 0.8 });

  // ══ 6. METRO CRM 31.875 – 41.25 ═══════════════════
  var T_CRM = at(17);
  scene("#s-crm", T_CRM, at(22));
  tl.fromTo("#crm-bg", { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.35, ease: "expo.out" }, T_CRM);
  sfx("impact", T_CRM, { gain: 1 }); shake(T_CRM, 18, 0.35); flash(T_CRM, "#7c4dff", 0.7, 0.25);
  show("#crm-title", T_CRM, at(18));
  slam("#crm-title .cs-title", T_CRM + 0.08, 2.4, 0.3);
  tl.fromTo("#crm-title .label", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.3 }, T_CRM + 0.2);
  glitch("#crm-title .cs-title", at(17, 3.5), 0.15); sfx("glitch", at(17, 3.5), { gain: 0.6 });
  show("#crm-shotwrap", at(18), at(20));
  tl.fromTo("#crm-shot", { x: 1500, rotateY: -40, scale: 0.8 }, { x: 0, rotateY: 12, scale: 1, duration: 0.6, ease: "expo.out" }, at(18));
  tl.to("#crm-shot", { rotateY: -6, duration: BAR - 0.6, ease: "none" }, at(18) + 0.6);
  sfx("whoosh", at(18), { dur: 0.5, gain: 0.85 });
  tl.to("#crm-shotwrap", { scale: 0.62, y: -150, duration: 0.5, ease: "expo.inOut" }, at(19) - 0.2);
  FLOW.forEach(function (f, i) {
    var t = at(19) + i * B * 0.6;
    show("#fl" + i, t, at(20));
    tl.fromTo("#fl" + i, { y: 200, opacity: 0, scale: 0.8 }, { y: 0, opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, t);
    tl.to("#fl" + i, { backgroundColor: "rgba(255,90,31,.9)", borderColor: "#ff5a1f", duration: 0.12, ease: "none" }, t + 0.08);
    tl.to("#fl" + i, { backgroundColor: "rgba(255,255,255,.08)", borderColor: "rgba(255,255,255,.18)", duration: 0.3 }, t + 0.25);
    sfx("blip", t, { gain: 0.5, pitch: 1 + i * 0.1 });
  });
  show("#crm-statsbg", at(20), at(21)); show("#crm-stats", at(20), at(21));
  flash(at(20), "#fff", 0.7, 0.2); sfx("hit", at(20), { gain: 0.95 }); shake(at(20), 12, 0.3);
  $$("#crm-stats .statbox").forEach(function (b, i) {
    var t = at(20, i);
    tl.fromTo(b, { y: 180, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35 }, t);
    if (i) sfx("hit", t, { gain: 0.55, short: true });
  });
  counter($("#cc0"), at(20, 0), 0, 6000, 0.8, function (v) { return inr(v) + "+"; });
  counter($("#cc1"), at(20, 1), 0, 27000, 0.8, function (v) { return inr(v) + "+"; });
  counter($("#cc2"), at(20, 2), 0, 20, 0.6, function (v) { return Math.round(v); });
  counter($("#cc3"), at(20, 3), 0, 83, 0.6, function (v) { return Math.round(v) + "%"; });
  DECK.forEach(function (c, i) {
    var t = at(21, i);
    show("#dk" + i, t, at(22));
    tl.fromTo("#dk" + i, { x: 1600, y: 500, rotate: 14, rotateY: -30 }, { x: 0, y: 0, rotate: (i - 1.5) * 2, rotateY: 0, duration: 0.4, ease: "expo.out" }, t);
    sfx("swish", t, { gain: 0.6 });
  });
  tl.to("#crm-deck .deck", { x: -2200, rotate: -20, duration: 0.3, ease: "power3.in", stagger: 0.03 }, at(22) - 0.35);
  sfx("whoosh", at(22) - 0.35, { dur: 0.4, gain: 0.8 });
  sfx("riser", at(21), { dur: BAR, gain: 0.8 });

  // ══ 7. DIGITALNGAGE.COM 41.25 – 46.875 ════════════
  var T_OWN = at(22);
  scene("#s-own", T_OWN, at(25));
  sfx("impact", T_OWN, { gain: 1 }); flash(T_OWN, "#ff5a1f", 0.85, 0.25); shake(T_OWN, 16, 0.3);
  show("#own-title", T_OWN, at(22, 2));
  slam("#own-title .sora", T_OWN + 0.06, 2.2, 0.28);
  tl.fromTo("#own-title .label", { opacity: 0 }, { opacity: 1, duration: 0.2 }, T_OWN + 0.15);
  show("#ba", at(22, 2), at(23, 2.5));
  tl.fromTo("#ba", { scale: 0.6, y: 700, rotateX: 40 }, { scale: 0.9, y: 0, rotateX: 0, duration: 0.5, ease: "expo.out" }, at(22, 2));
  sfx("whoosh", at(22, 2), { dur: 0.45, gain: 0.8 });
  tl.fromTo("#baafter", { clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0 0 0 0%)", duration: B * 3.2, ease: "power3.inOut" }, at(22, 3));
  tl.fromTo("#baline", { left: "100%" }, { left: "0%", duration: B * 3.2, ease: "power3.inOut" }, at(22, 3));
  tl.fromTo("#taga", { opacity: 0 }, { opacity: 1, duration: 0.2 }, at(23, 2));
  sfx("sweep", at(22, 3), { dur: B * 3.2, gain: 0.6 });
  ["#ob0", "#ob1", "#ob2", "#ob3", "#ob4"].forEach(function (el, i) {
    var t = at(23, 2.5) + i * B;
    show(el, t, i === 4 ? at(25) : t + B);
    slam(el, t, i === 4 ? 0.5 : 2.2, 0.22);
    punch(t, 1.03);
    sfx(i === 4 ? "impact" : "hit", t, { gain: i === 4 ? 0.6 : 0.85 });
  });
  tl.to("#ob4", { scale: 4, opacity: 0, filter: "blur(16px)", duration: 0.25, ease: "power3.in" }, at(25) - 0.25);

  // ══ 8. CLIENTS 46.875 – 52.5 ══════════════════════
  var T_CLI = at(25);
  scene("#s-cli", T_CLI, at(28));
  sfx("impact", T_CLI, { gain: 0.9 }); flash(T_CLI, "#fff", 0.7, 0.2);
  [0, 1, 2, 3].forEach(function (r) {
    tl.fromTo("#cr" + r, { x: r % 2 ? -2600 : 0 }, { x: r % 2 ? 0 : -2600, duration: at(28) - T_CLI, ease: "none" }, T_CLI);
  });
  [["#cs0", "#cn0", 0, 7, function (v) { return Math.round(v) + "+"; }], ["#cs1", "#cn1", 0, 100, function (v) { return Math.round(v) + "%"; }], ["#cs2", "#cn2", 3, 10, function (v) { return "3x–" + Math.round(v) + "x"; }]].forEach(function (c, i) {
    var t = at(25 + i); // one bar per stat
    show(c[0], t, at(26 + i));
    slam(c[0] + " b", t, 2.4, 0.3);
    tl.fromTo(c[0] + " span", { opacity: 0, letterSpacing: "0.8em" }, { opacity: 1, letterSpacing: "0.3em", duration: 0.5, ease: "power3.out" }, t + 0.1);
    counter($(c[1]), t, c[2], c[3], 0.7, c[4]);
    sfx("hit", t, { gain: 0.95 }); punch(t, 1.05);
    glitch(c[0] + " b", at(26 + i) - 0.12, 0.12); sfx("glitch", at(26 + i) - 0.12, { gain: 0.45 });
  });
  sfx("riser", at(27), { dur: BAR, gain: 0.9 });

  // ══ 9. OUTRO 52.5 – 60 ════════════════════════════
  var T_OUT = at(28);
  scene("#s-out", T_OUT);
  sfx("impact", T_OUT, { gain: 1 }); shake(T_OUT, 22, 0.4);
  tl.fromTo("#o-bg", { clipPath: "circle(0% at 50% 50%)" }, { clipPath: "circle(80% at 50% 50%)", duration: 0.4, ease: "expo.out" }, T_OUT);
  slam("#ow0", T_OUT + 0.05, 2.4, 0.26);
  slam("#ow1", at(28, 2), 2.4, 0.26); sfx("hit", at(28, 2), { gain: 0.95 }); punch(at(28, 2), 1.05);
  tl.fromTo("#o-ink", { yPercent: 100 }, { yPercent: 0, duration: 0.4, ease: "expo.inOut" }, at(29) - 0.2);
  sfx("whoosh", at(29) - 0.2, { dur: 0.45, gain: 0.8 });
  tl.set("#o-words", { autoAlpha: 0 }, at(29) + 0.2);
  tl.fromTo("#o-logo", { opacity: 0 }, { opacity: 1, duration: 0.01 }, at(29));
  tl.fromTo("#o-line", { attr: { "stroke-dashoffset": 120 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.5, ease: "power2.inOut" }, at(29));
  tl.fromTo("#o-arrow", { attr: { "stroke-dashoffset": 40 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.2 }, at(29) + 0.45);
  $$(".o-dot").forEach(function (d, i) {
    tl.fromTo(d, { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.3, ease: "back.out(3)" }, at(29, i * 0.5));
    sfx("pop", at(29, i * 0.5), { gain: 0.6, pitch: 1 + i * 0.25 });
  });
  slam("#ologo", at(29, 2), 1.6, 0.35); sfx("hit", at(29, 2), { gain: 1 }); flash(at(29, 2), "#ff5a1f", 0.5, 0.2);
  tl.fromTo("#o-tag", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 }, at(29, 3));
  tl.fromTo("#o-cta", { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2)" }, at(30));
  sfx("pop", at(30), { gain: 0.8, pitch: 0.8 });
  tl.fromTo("#o-contact", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.9, ease: "power2.out" }, at(30, 1));
  sfx("type", at(30, 1), { dur: 0.9, gain: 0.5 });
  tl.to("#o-cta", { scale: 1.08, duration: 0.12, ease: "power2.out" }, at(31));
  tl.to("#o-cta", { scale: 1, duration: 0.4, ease: "power2.out" }, at(31) + 0.12);
  sfx("impact", at(31), { gain: 0.9, final: true }); punch(at(31), 1.04); flash(at(31), "#fff", 0.35, 0.3);
  tl.fromTo("#cam", { opacity: 1 }, { opacity: 0, duration: 0.7, ease: "power1.in" }, DUR - 0.75);

  // letterbox breathes in during the case studies for a cinematic feel
  tl.fromTo("#lb0, #lb1", { height: 0 }, { height: 70, duration: 0.5, ease: "expo.out" }, at(12));
  tl.to("#lb0, #lb1", { height: 0, duration: 0.4, ease: "expo.inOut" }, at(25));

  // ── per-frame extras: particle network, grain, HUD ───────────────
  var net = $("#net").getContext("2d"), NP = 70, P = [];
  var nr = rng(7);
  for (var p = 0; p < NP; p++) P.push({ x: nr() * 1920, y: nr() * 1080, ax: 40 + nr() * 120, ay: 30 + nr() * 90, fx: 0.08 + nr() * 0.25, fy: 0.06 + nr() * 0.2, ph: nr() * 6.28, c: ["255,90,31", "255,176,32", "124,77,255", "255,255,255"][p % 4] });
  function drawNet(t) {
    net.clearRect(0, 0, 1920, 1080);
    var pts = P.map(function (q) { return [q.x + Math.sin(t * q.fx * 6.28 + q.ph) * q.ax, q.y + Math.cos(t * q.fy * 6.28 + q.ph) * q.ay, q.c]; });
    for (var i = 0; i < pts.length; i++) {
      for (var j = i + 1; j < pts.length; j++) {
        var dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1], d = dx * dx + dy * dy;
        if (d < 52000) { net.strokeStyle = "rgba(" + pts[i][2] + "," + (0.28 * (1 - d / 52000)) + ")"; net.lineWidth = 1.4; net.beginPath(); net.moveTo(pts[i][0], pts[i][1]); net.lineTo(pts[j][0], pts[j][1]); net.stroke(); }
      }
      net.fillStyle = "rgba(" + pts[i][2] + ",.9)"; net.beginPath(); net.arc(pts[i][0], pts[i][1], 3, 0, 6.29); net.fill();
    }
  }
  var gctx = $("#grain").getContext("2d"), gimg = gctx.createImageData(480, 270);
  function drawGrain(frame) {
    var g = rng(frame * 977 + 13), d = gimg.data;
    for (var i = 0; i < d.length; i += 4) { var v = g() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    gctx.putImageData(gimg, 0, 0);
  }
  var SECTIONS = [[at(2), "01 — WHO WE ARE"], [at(4), "02 — SERVICES"], [at(8), "03 — WEBSITES"], [at(12), "04 — CASE STUDY · KIO ORGANICS"], [at(17), "05 — CASE STUDY · METRO CRM"], [at(22), "06 — CASE STUDY · DIGITALNGAGE.COM"], [at(25), "07 — CLIENTS"], [at(28), "08 — LET'S TALK"]];
  var tc = $("#tc"), hs = $("#hudsec"), hud = $("#hud"), prog = $("#prog"), gl = $("#gridl");
  function pad(n) { return String(n).padStart(2, "0"); }

  window.SFX = SFX;
  window.REEL = {
    duration: DUR, bpm: BPM,
    seek: function (t, fps) {
      tl.seek(Math.min(t, DUR), false);
      var frame = Math.round(t * (fps || 60));
      drawNet(t); drawGrain(frame);
      gl.style.transform = "translate(" + (-(t * 40) % 96) + "px," + (-(t * 24) % 96) + "px)";
      var sec = "SHOWREEL 2026";
      SECTIONS.forEach(function (s) { if (t >= s[0]) sec = s[1]; });
      hs.textContent = sec;
      tc.textContent = pad(Math.floor(t / 60)) + ":" + pad(Math.floor(t % 60)) + ":" + pad(frame % (fps || 60));
      hud.style.opacity = t < at(2) || t > DUR - 1.6 ? 0 : 1;
      prog.style.transform = "scaleX(" + Math.min(1, t / DUR) + ")";
    }
  };
})();
