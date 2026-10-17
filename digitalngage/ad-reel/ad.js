/* DigitalNgage — vertical ad reel (1080x1920).
   Deterministic GSAP timeline: render.js calls REEL.seek(t) for every frame.
   Every cue below is taken from the pauses in the Monika Sogam voice-over
   (vo/monika-take4.mp3, placed at OFF seconds), so each element lands on the word
   that names it. Sound effects are registered in window.SFX for music_ad.py. */
(function () {
  "use strict";
  var OFF = 0.3, DUR = 33.6;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var SFX = [];
  function sfx(type, t, extra) { var o = { type: type, t: +t.toFixed(4) }; for (var k in extra) o[k] = extra[k]; SFX.push(o); }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var R = rng(20261017);

  // voice-over phrases: [start, end, text, highlighted words]  (seconds in the VO file)
  var VO = [
    [0.15, 1.42, "Is your business stuck online?", ["stuck"]],
    [1.98, 2.75, "Not anymore!", ["anymore!"]],
    [3.21, 4.27, "This is DigitalNgage", ["DigitalNgage"]],
    [4.71, 5.42, "Social Media,", []],
    [5.65, 6.57, "Meta and Google Ads,", []],
    [7.03, 7.52, "SEO,", []],
    [7.75, 8.23, "Websites,", []],
    [8.57, 9.09, "E-commerce,", []],
    [9.56, 10.55, "CRM Software,", []],
    [10.87, 12.22, "and Structural Engineering", []],
    [12.61, 13.79, "all under one roof.", ["one"]],
    [14.50, 17.06, "We built the KIO Organics online store.", ["KIO"]],
    [17.56, 18.76, "Over six thousand leads", ["thousand"]],
    [19.04, 20.03, "in Metro CRM.", ["CRM."]],
    [20.65, 21.43, "Twenty projects", ["Twenty"]],
    [21.75, 23.18, "for Delta Infrastructures.", ["Delta"]],
    [23.61, 25.47, "Trusted by fifty-plus brands.", ["fifty-plus"]],
    [26.10, 26.63, "Your brand...", []],
    [27.11, 27.81, "could be next.", ["next."]],
    [28.32, 29.56, "Book your free audit today", ["free", "audit"]],
    [30.01, 31.36, "digitalngage.com", ["digitalngage.com"]]
  ];
  var V = VO.map(function (p) { return p[0] + OFF; });   // cue start times on the video clock

  var ICON = {
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    megaphone: '<path d="M3 11v2a2 2 0 0 0 2 2h2l5 4V5L7 9H5a2 2 0 0 0-2 2Z"/><path d="M16 8a5 5 0 0 1 0 8"/><path d="M19 5a9 9 0 0 1 0 14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6M11 8v6"/>',
    code: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m9 10-2 2 2 2M15 10l2 2-2 2"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6"/>',
    crm: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    building: '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-5h6v5"/><path d="M9 9h1M14 9h1M9 13h1M14 13h1"/>'
  };
  function svg(name, color) { return '<svg viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICON[name] + '</svg>'; }

  var SERV = [
    ["Social Media", "Reels, content & community", "share", "#ff5a1f", "#fff", "#0a0a14", "#ff5a1f"],
    ["Meta & Google Ads", "ROI-first ad campaigns", "megaphone", "#ffb020", "#0a0a14", "#0a0a14", "#ffb020"],
    ["SEO", "Rank on page one", "search", "#7c4dff", "#fff", "#fff", "#7c4dff"],
    ["Websites", "Fast, animated, built to convert", "code", "#fff8f3", "#0a0a14", "#ff5a1f", "#fff"],
    ["E-commerce", "UPI, cards & COD checkout", "cart", "#16a34a", "#fff", "#fff", "#16a34a"],
    ["CRM Software", "Built around your sales team", "crm", "#0f1630", "#fff", "#2ed3ea", "#0f1630"],
    ["Structural Engineering", "Design, analysis & 2D/3D detailing", "building", "#ff5a1f", "#fff", "#0a0a14", "#ffb020"]
  ];
  // ── build DOM ────────────────────────────────────
  var svcs = $("#svcs");
  SERV.forEach(function (s, i) {
    var d = document.createElement("div");
    d.className = "svc"; d.id = "sv" + i; d.style.background = s[3]; d.style.color = s[4]; d.style.top = (430 + i * 122) + "px"; d.style.zIndex = i;
    d.innerHTML = '<span class="n">' + String(i + 1).padStart(2, "0") + '</span><div class="ic" style="background:' + s[5] + '">' + svg(s[2], s[6]) + '</div><div><b>' + s[0].replace("&", "&amp;") + '</b><small>' + s[1].replace("&", "&amp;") + '</small></div>';
    svcs.appendChild(d);
  });
  var tiles = $("#tiles"), TILE_POS = [[155, 720], [365, 720], [575, 720], [785, 720], [260, 900], [470, 900], [680, 900]];
  SERV.forEach(function (s, i) {
    var d = document.createElement("div");
    d.className = "tile"; d.id = "tl" + i; d.style.background = s[3]; d.style.left = (TILE_POS[i][0] - 75) + "px"; d.style.top = TILE_POS[i][1] + "px";
    d.innerHTML = svg(s[2], s[3] === "#fff8f3" ? "#ff5a1f" : (s[3] === "#ffb020" ? "#0a0a14" : "#fff"));
    tiles.appendChild(d);
  });
  var PROJ = [["indian-designs-export", "Indian Designs Export · 1,30,000 sq.ft"], ["karvy-stock-brokerage", "Karvy · G+4 steel frame"], ["molbio-diagnostics", "Molbio · mezzanine system"], ["sri-ram-cricket-academy", "Sri Ram Cricket Academy"], ["wings-arenas", "Wings Arenas · 28,000 sq.ft"]];
  var projs = $("#projs");
  PROJ.forEach(function (p, i) {
    var d = document.createElement("div");
    d.className = "proj"; d.id = "pj" + i; d.style.top = "560px"; d.style.zIndex = i;
    d.innerHTML = '<img src="../public_html/images/projects/' + p[0] + '.jpg" style="object-fit:contain;padding:8px"><span>' + p[1] + '</span>';
    projs.appendChild(d);
  });
  var LOGOS = ["makemytrip", "luminous", "cuemath", "et-money", "mindtickle", "amagi", "loom-solar", "imarticus-learning", "unlu", "amber", "travel-khana", "medikoe",
    "starquik", "hotpack", "dogspot", "orion-sutures", "khanna-gems", "ojas-ayurveda", "greensole", "powermaster", "no-scars", "ketomac", "hempstrol", "mfix",
    "kiran-udyog", "solvabuild", "letstacle", "centum", "qmaths", "pixel-institute", "getsmartcoders", "flatworld-edge"];
  var logos = $("#logos");
  LOGOS.forEach(function (l, i) {
    var col = i % 4, row = Math.floor(i / 4);
    var d = document.createElement("div");
    d.className = "logo"; d.id = "lg" + i; d.style.left = (40 + col * 254) + "px"; d.style.top = (210 + row * 200) + "px";
    d.innerHTML = '<img src="../public_html/images/clients/' + l + '.jpg">';
    logos.appendChild(d);
  });

  // ── helpers ──────────────────────────────────────
  var tl = gsap.timeline({ paused: true, defaults: { ease: "expo.out" } });
  gsap.set(".scene", { autoAlpha: 0 });
  function scene(id, t0, t1) { tl.set(id, { autoAlpha: 1 }, t0); if (t1 != null) tl.set(id, { autoAlpha: 0 }, t1); }
  function flash(t, color, o, d) { tl.set("#flash", { opacity: o == null ? 0.85 : o, backgroundColor: color || "#fff" }, t); tl.to("#flash", { opacity: 0, duration: d || 0.22, ease: "power2.out" }, t + 0.001); }
  function shake(t, amp, dur) {
    var n = Math.max(4, Math.round(dur / 0.035)), step = dur / n;
    for (var i = 0; i < n; i++) { var f = 1 - i / n; tl.to("#cam", { x: (R() * 2 - 1) * amp * f, y: (R() * 2 - 1) * amp * f, rotation: (R() * 2 - 1) * amp * 0.03 * f, duration: step, ease: "none" }, t + i * step); }
    tl.to("#cam", { x: 0, y: 0, rotation: 0, duration: step, ease: "none" }, t + dur);
  }
  function punch(t, s) { tl.to("#cam", { scale: s || 1.05, duration: 0.05, ease: "none" }, t); tl.to("#cam", { scale: 1, duration: 0.45, ease: "power3.out" }, t + 0.05); }
  function slam(el, t, from, d) { tl.fromTo(el, { scale: from || 2.2, opacity: 0, filter: "blur(16px)" }, { scale: 1, opacity: 1, filter: "blur(0px)", duration: d || 0.26, ease: "expo.out" }, t); }
  function glitch(el, t, d) {
    d = d || 0.16; var n = 5;
    for (var i = 0; i < n; i++) tl.set(el, { x: (R() * 2 - 1) * 34, skewX: (R() * 2 - 1) * 14, textShadow: "-10px 0 #ff5a1f, 10px 0 #7c4dff" }, t + i * d / n);
    tl.set(el, { x: 0, skewX: 0, textShadow: "0 0 0 rgba(0,0,0,0)" }, t + d);
    sfx("glitch", t);
  }
  function out(el, t, d) { tl.to(el, { scale: 1.6, opacity: 0, filter: "blur(18px)", duration: d || 0.28, ease: "power3.in" }, t - (d || 0.28)); }
  function counter(el, t, to, dur, fmt) {
    var o = { v: 0 };
    tl.fromTo(o, { v: 0 }, { v: to, duration: dur, ease: "power3.out", onUpdate: function () { el.textContent = fmt(o.v); } }, t);
    var ticks = Math.min(12, Math.round(dur / 0.06));
    for (var i = 0; i < ticks; i++) sfx("tick", t + i * dur * 0.7 / ticks, { gain: 0.55 });
  }
  var inr = function (v) { return Math.round(v).toLocaleString("en-IN"); };

  // ══ 1. HOOK ═════════════════════════════════════
  var T_BRAND = V[2] - 0.12, T_SVC = V[3] - 0.15, T_ROOF = V[10] - 0.12, T_KIO = V[11] - 0.12, T_CRM = V[12] - 0.14,
      T_DELTA = V[14] - 0.14, T_BRANDS = V[16] - 0.14, T_NEXT = V[17] - 0.14, T_CTA = V[19] - 0.16;
  scene("#s-hook", 0, T_BRAND);
  tl.fromTo("#h-label", { opacity: 0, letterSpacing: "1em" }, { opacity: 1, letterSpacing: "0.3em", duration: 0.5 }, 0.02);
  $$("#h-l1 .word").forEach(function (w, i) { tl.fromTo(w, { yPercent: 120, opacity: 0, rotate: 8 }, { yPercent: 0, opacity: 1, rotate: 0, duration: 0.34 }, V[0] + i * 0.16); });
  tl.fromTo("#h-notif", { y: -160, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.8)" }, 0.18);
  sfx("pop", 0.2, { pitch: 0.8 });
  tl.to("#h-notif", { x: 14, duration: 0.05, yoyo: true, repeat: 7, ease: "none" }, 0.75);
  tl.to("#h-down", { attr: { "stroke-dashoffset": 0 }, duration: 1.0, ease: "power2.in" }, 0.3);
  sfx("sweep", 0.3, { dur: 1.0, gain: 0.6 });
  slam("#h-stuck", V[0] + 0.62, 2.4, 0.24);
  sfx("hit", V[0] + 0.62);
  shake(V[0] + 0.64, 18, 0.35);
  glitch("#h-stuck", V[0] + 1.0, 0.18);
  tl.to(["#h-stuck", "#h-down"], { opacity: 0, duration: 0.12, ease: "none" }, V[1] - 0.06);
  // "Not anymore!" — the line flips up
  sfx("riser", V[0] + 0.2, { dur: V[1] - V[0] - 0.2 });
  tl.to("#h-chart", { y: -260, duration: 0.4, ease: "power3.out" }, V[1]);
  slam("#h-not", V[1], 3, 0.24);
  sfx("impact", V[1]);
  flash(V[1], "#ff5a1f", 0.7, 0.3);
  punch(V[1], 1.07);
  tl.to("#h-notif .ni", { backgroundColor: "#16a34a", duration: 0.01 }, V[1]);
  tl.call(function () {}, null, V[1]);
  var niTxt = { v: 0 };
  tl.fromTo(niTxt, { v: 0 }, { v: 48, duration: 0.8, ease: "power3.out", onUpdate: function () { $("#h-notif .ni").textContent = Math.round(niTxt.v); } }, V[1] + 0.05);
  tl.set("#h-notif .ni", { fontSize: "38px" }, V[1]);
  tl.to("#h-up", { attr: { "stroke-dashoffset": 0 }, duration: 0.6, ease: "power3.out" }, V[1] + 0.02);
  tl.to("#h-arrow", { opacity: 1, duration: 0.05 }, V[1] + 0.5);
  sfx("swish", V[1] + 0.5);
  out("#s-hook", T_BRAND, 0.25);

  // ══ 2. BRAND ════════════════════════════════════
  scene("#s-brand", T_BRAND, T_SVC);
  sfx("whoosh", T_BRAND, { dur: 0.45 });
  tl.fromTo("#b-mark", { scale: 0, rotate: -200 }, { scale: 1, rotate: 0, duration: 0.6, ease: "back.out(1.6)" }, T_BRAND);
  tl.fromTo(["#b-r1", "#b-r2"], { scale: 0.5, opacity: 1 }, { scale: 2.2, opacity: 0, duration: 0.9, ease: "power2.out", stagger: 0.12 }, T_BRAND + 0.15);
  tl.fromTo("#b-this", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.3 }, T_BRAND + 0.05);
  tl.fromTo("#b-logo", { clipPath: "inset(0 100% 0 0)", x: -40 }, { clipPath: "inset(0 0% 0 0)", x: 0, duration: 0.5 }, V[2] + 0.45);
  sfx("hit", V[2] + 0.45, { short: true });
  tl.fromTo("#b-tag", { opacity: 0, letterSpacing: "0.5em" }, { opacity: 0.8, letterSpacing: "0em", duration: 0.5, ease: "power3.out" }, V[2] + 0.7);
  out("#s-brand", T_SVC, 0.2);

  // ══ 3. SERVICES — one card per word ═════════════
  scene("#s-svc", T_SVC, T_ROOF);
  tl.fromTo(["#sv-label", "#sv-count"], { opacity: 0, y: -40 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.05 }, T_SVC);
  SERV.forEach(function (s, i) {
    var t = V[3 + i] - 0.04, dir = i % 2 ? 1 : -1;
    tl.fromTo("#sv" + i, { autoAlpha: 0, x: 900 * dir, rotate: 10 * dir, scale: 0.9 }, { autoAlpha: 1, x: 0, rotate: 0, scale: 1, duration: 0.32 }, t);
    tl.fromTo("#sv" + i + " .ic", { scale: 0.2, rotate: -90 * dir }, { scale: 1, rotate: 0, duration: 0.4, ease: "back.out(2.2)" }, t + 0.05);
    tl.fromTo("#sv" + i + " small", { opacity: 0, y: 20 }, { opacity: 0.85, y: 0, duration: 0.3 }, t + 0.12);
    tl.set("#sv-n", { textContent: String(i + 1).padStart(2, "0") }, t);
    tl.fromTo("#sv-n", { scale: 1.6, color: "#ff5a1f" }, { scale: 1, color: "#ffffff", duration: 0.3 }, t);
    for (var j = 0; j < i; j++) tl.to("#sv" + j, { scale: 1 - (i - j) * 0.02, filter: "brightness(" + (1 - (i - j) * 0.08) + ")", duration: 0.25, ease: "power2.out" }, t);
    sfx(i % 2 ? "swish" : "whoosh", t, { dur: 0.3, short: true });
    sfx("hit", t + 0.06, { short: true, gain: 0.7 });
  });
  shake(V[9] + 0.05, 10, 0.25);
  // collapse cards into tiles
  SERV.forEach(function (s, i) { tl.to("#sv" + i, { scale: 0.2, opacity: 0, y: -200, duration: 0.3, ease: "power3.in" }, T_ROOF - 0.32 + i * 0.012); });
  sfx("reverse", T_ROOF - 0.5, { dur: 0.5 });

  // ══ 4. ONE ROOF ══════════════════════════════════
  scene("#s-roof", T_ROOF, T_KIO);
  SERV.forEach(function (s, i) {
    tl.fromTo("#tl" + i, { x: (R() * 2 - 1) * 700, y: 700 + R() * 400, rotate: (R() * 2 - 1) * 180, scale: 0 }, { x: 0, y: 0, rotate: 0, scale: 1, duration: 0.5, ease: "back.out(1.4)" }, T_ROOF + i * 0.05);
    sfx("pop", T_ROOF + i * 0.05 + 0.2, { pitch: 1 + i * 0.12, gain: 0.7 });
  });
  tl.to("#r-line", { attr: { "stroke-dashoffset": 0 }, duration: 0.45, ease: "power3.out" }, V[10] + 0.35);
  sfx("swish", V[10] + 0.35);
  tl.fromTo("#r-t1", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.3 }, V[10]);
  slam("#r-t2", V[10] + 0.5, 1.8, 0.25);
  sfx("impact", V[10] + 0.5, { gain: 0.7 });
  punch(V[10] + 0.5, 1.05);
  tl.to("#tiles", { y: -20, duration: 1.2, ease: "none" }, T_ROOF + 0.4);
  out("#s-roof", T_KIO, 0.25);

  // ══ 5. KIO ═══════════════════════════════════════
  scene("#s-kio", T_KIO, T_CRM);
  tl.fromTo("#s-kio", { clipPath: "circle(0% at 50% 50%)" }, { clipPath: "circle(80% at 50% 50%)", duration: 0.5, ease: "power3.out" }, T_KIO);
  sfx("whoosh", T_KIO, { dur: 0.5 });
  tl.fromTo("#k-label", { opacity: 0, letterSpacing: "0.8em" }, { opacity: 1, letterSpacing: "0.3em", duration: 0.45 }, T_KIO + 0.1);
  slam("#k-title", V[11] + 0.55, 1.8, 0.26);
  sfx("hit", V[11] + 0.55, { short: true });
  tl.fromTo("#k-phone", { y: 1300, rotate: -12 }, { y: 0, rotate: -4, duration: 0.7 }, T_KIO + 0.12);
  tl.fromTo("#k-phone img", { y: 0 }, { y: -500, duration: 2.0, ease: "power1.inOut" }, T_KIO + 0.7);
  sfx("scroll", T_KIO + 0.7, { dur: 1.2 });
  tl.fromTo("#k-phone2", { y: 1300, x: 200, rotate: 14 }, { y: 80, x: 130, rotate: 6, duration: 0.6 }, V[11] + 1.6);
  sfx("swish", V[11] + 1.6);
  ["#k-c1", "#k-c2", "#k-c3", "#k-c4"].forEach(function (c, i) {
    tl.fromTo(c, { scale: 0, rotate: (i % 2 ? 20 : -20) }, { scale: 1, rotate: 0, duration: 0.4, ease: "back.out(2.4)" }, V[11] + 0.9 + i * 0.22);
    tl.to(c, { y: (i % 2 ? -18 : 18), duration: 1.2, ease: "sine.inOut", yoyo: true, repeat: 1 }, V[11] + 1.3 + i * 0.22);
    sfx("pop", V[11] + 0.9 + i * 0.22, { pitch: 1 + i * 0.15 });
  });
  out("#s-kio", T_CRM, 0.22);

  // ══ 6. METRO CRM ═════════════════════════════════
  scene("#s-crm", T_CRM, T_DELTA);
  tl.fromTo("#s-crm", { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.45, ease: "power3.out" }, T_CRM);
  sfx("whoosh", T_CRM, { dur: 0.45 });
  tl.fromTo("#c-browser", { rotateX: 50, y: 300, opacity: 0, scale: 0.8 }, { rotateX: 12, y: 0, opacity: 1, scale: 1, duration: 0.7 }, T_CRM + 0.1);
  tl.to("#c-browser", { rotateX: 0, rotateY: -6, duration: 2.6, ease: "none" }, T_CRM + 0.8);
  counter($("#c-num"), V[12] + 0.2, 6000, 1.1, function (v) { return inr(v) + "+"; });
  tl.fromTo("#c-num", { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3 }, V[12] + 0.15);
  tl.fromTo("#c-sub", { opacity: 0, y: 30 }, { opacity: 0.85, y: 0, duration: 0.3 }, V[12] + 0.5);
  sfx("impact", V[12] + 1.3, { gain: 0.55 });
  punch(V[12] + 1.3, 1.04);
  tl.fromTo("#c-label", { opacity: 0, letterSpacing: "0.8em" }, { opacity: 1, letterSpacing: "0.3em", duration: 0.45 }, T_CRM + 0.15);
  slam("#c-title", V[13], 1.8, 0.26);
  sfx("hit", V[13], { short: true });
  glitch("#c-title", V[13] + 0.5, 0.14);
  out("#s-crm", T_DELTA, 0.22);

  // ══ 7. DELTA ════════════════════════════════════
  scene("#s-delta", T_DELTA, T_BRANDS);
  sfx("whoosh", T_DELTA, { dur: 0.45 });
  tl.fromTo("#d-label", { opacity: 0, letterSpacing: "0.8em" }, { opacity: 1, letterSpacing: "0.3em", duration: 0.45 }, T_DELTA + 0.05);
  PROJ.forEach(function (p, i) {
    var t = T_DELTA + 0.1 + i * 0.5;
    tl.fromTo("#pj" + i, { y: 1200, rotate: (i % 2 ? 8 : -8), scale: 0.9 }, { y: i * 14, rotate: (i % 2 ? 2 : -2) * (i ? 1 : 0), scale: 1, duration: 0.45 }, t);
    sfx("shutter", t + 0.1);
  });
  counter($("#d-num"), V[14], 20, 0.8, function (v) { return String(Math.round(v)); });
  tl.fromTo("#d-num", { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3 }, V[14] - 0.05);
  tl.fromTo("#d-sub", { opacity: 0, y: 30 }, { opacity: 0.85, y: 0, duration: 0.3 }, V[14] + 0.4);
  slam("#d-title", V[15], 1.8, 0.26);
  sfx("hit", V[15], { short: true });
  punch(V[15], 1.04);
  out("#s-delta", T_BRANDS, 0.22);

  // ══ 8. BRANDS ═══════════════════════════════════
  scene("#s-brands", T_BRANDS, T_NEXT);
  flash(T_BRANDS, "#fff", 0.6, 0.25);
  LOGOS.forEach(function (l, i) {
    var t = T_BRANDS + 0.05 + (i % 4) * 0.04 + Math.floor(i / 4) * 0.07;
    tl.fromTo("#lg" + i, { scale: 0, rotate: (R() * 2 - 1) * 30, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: 0.4, ease: "back.out(2)" }, t);
    if (i % 3 === 0) sfx("blip", t + 0.1, { pitch: 0.8 + (i % 7) * 0.1, gain: 0.6 });
  });
  tl.to("#logos", { y: -120, duration: 2.6, ease: "none" }, T_BRANDS + 0.2);
  tl.fromTo("#br-card", { scale: 0.3, opacity: 0, rotate: -8 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.5, ease: "back.out(1.6)" }, V[16] + 0.45);
  counter($("#br-num"), V[16] + 0.5, 50, 0.9, function (v) { return String(Math.round(v)); });
  sfx("impact", V[16] + 1.35, { gain: 0.6 });
  punch(V[16] + 1.35, 1.05);
  out("#s-brands", T_NEXT, 0.22);

  // ══ 9. YOUR BRAND COULD BE NEXT ══════════════════
  scene("#s-next", T_NEXT, T_CTA);
  slam("#n-t1", V[17], 1.6, 0.28);
  tl.fromTo("#n-slot", { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.6)" }, V[17] + 0.15);
  var TYPE = "YOUR LOGO", tobj = { n: 0 };
  tl.fromTo(tobj, { n: 0 }, { n: TYPE.length, duration: 0.7, ease: "none", onUpdate: function () { $("#n-type").textContent = TYPE.slice(0, Math.round(tobj.n)); } }, V[17] + 0.5);
  sfx("type", V[17] + 0.5, { dur: 0.7 });
  for (var b = 0; b < 6; b++) tl.set("#n-cur", { opacity: b % 2 ? 1 : 0 }, V[17] + 0.2 + b * 0.32);
  tl.fromTo("#n-t2", { opacity: 0, y: 80 }, { opacity: 1, y: 0, duration: 0.35 }, V[18]);
  tl.to("#n-slot", { borderColor: "#ff5a1f", backgroundColor: "rgba(255,90,31,.12)", duration: 0.3, ease: "power2.out" }, V[18] + 0.35);
  sfx("riser", V[17], { dur: T_CTA - V[17] });
  out("#s-next", T_CTA, 0.2);

  // ══ 10. CTA ═════════════════════════════════════
  scene("#s-cta", T_CTA, null);
  flash(T_CTA, "#ff5a1f", 0.8, 0.3);
  sfx("impact", T_CTA + 0.02, { final: true });
  shake(T_CTA + 0.02, 16, 0.4);
  tl.fromTo("#e-mark", { scale: 0, rotate: 180 }, { scale: 1, rotate: 0, duration: 0.55, ease: "back.out(1.8)" }, T_CTA);
  tl.fromTo("#e-t1", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.35 }, T_CTA + 0.05);
  slam("#e-btnw", V[19] + 0.42, 2.2, 0.28);
  sfx("hit", V[19] + 0.42);
  for (var k = 0; k < 7; k++) tl.to("#e-btn", { scale: k % 2 ? 1 : 1.06, duration: 0.28, ease: "sine.inOut" }, V[19] + 0.8 + k * 0.28);
  tl.fromTo("#e-today", { opacity: 0, y: 30 }, { opacity: 0.85, y: 0, duration: 0.3 }, V[19] + 1.0);
  tl.fromTo("#e-url", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.6, ease: "power3.out" }, V[20]);
  sfx("swish", V[20]);
  tl.fromTo(["#e-ph", "#e-wa"], { opacity: 0, x: -60 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.15 }, V[20] + 0.5);
  sfx("pop", V[20] + 0.5); sfx("pop", V[20] + 0.65, { pitch: 1.2 });
  tl.to("#stage", { opacity: 0, duration: 0.6, ease: "power2.in" }, DUR - 0.6);

  // ── captions: phrase on screen, words light up as they are spoken ──
  var cap = $("#cap");
  var CAP = VO.map(function (p) {
    var words = p[2].split(" "), total = p[2].replace(/ /g, "").length, acc = 0;
    return { t0: p[0] + OFF, t1: p[1] + OFF, words: words.map(function (w) { var s = p[0] + OFF + (p[1] - p[0]) * acc / total; acc += w.length; return { w: w, t: s, hl: p[3].indexOf(w) > -1 }; }) };
  });
  var curCap = -1;
  function drawCap(t) {
    var idx = -1;
    for (var i = 0; i < CAP.length; i++) if (t >= CAP[i].t0 - 0.05 && t < (i + 1 < CAP.length ? Math.min(CAP[i + 1].t0 - 0.05, CAP[i].t1 + 0.45) : CAP[i].t1 + 0.6)) idx = i;
    if (idx !== curCap) {
      curCap = idx;
      cap.innerHTML = idx < 0 ? "" : CAP[idx].words.map(function (w) { return '<span class="w' + (w.hl ? " hl" : "") + '">' + w.w + "</span>"; }).join(" ");
    }
    if (idx < 0) return;
    var spans = cap.children, c = CAP[idx];
    for (var j = 0; j < spans.length; j++) {
      var dt = t - c.words[j].t, on = dt >= 0;
      spans[j].classList.toggle("on", on);
      var k = Math.max(0, Math.min(1, dt / 0.12));
      spans[j].style.transform = on ? "translateY(" + ((1 - k) * 24) + "px) scale(" + (1 + (1 - k) * 0.18) + ")" : "translateY(24px)";
    }
    var age = t - c.t0;
    cap.style.opacity = Math.min(1, Math.max(0, age / 0.08));
  }

  // ── background: drifting network + grain ──
  var net = $("#net").getContext("2d"), P = [], nr = rng(7);
  for (var p = 0; p < 46; p++) P.push({ x: nr() * 1080, y: nr() * 1920, ax: 40 + nr() * 120, ay: 30 + nr() * 90, fx: 0.08 + nr() * 0.25, fy: 0.06 + nr() * 0.2, ph: nr() * 6.28, c: ["255,90,31", "255,176,32", "124,77,255", "255,255,255"][p % 4] });
  function drawNet(t) {
    net.clearRect(0, 0, 1080, 1920);
    var pts = P.map(function (q) { return [q.x + Math.sin(t * q.fx * 6.28 + q.ph) * q.ax, q.y + Math.cos(t * q.fy * 6.28 + q.ph) * q.ay, q.c]; });
    for (var i = 0; i < pts.length; i++) {
      for (var j = i + 1; j < pts.length; j++) {
        var dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1], d = dx * dx + dy * dy;
        if (d < 60000) { net.strokeStyle = "rgba(" + pts[i][2] + "," + (0.25 * (1 - d / 60000)) + ")"; net.lineWidth = 1.5; net.beginPath(); net.moveTo(pts[i][0], pts[i][1]); net.lineTo(pts[j][0], pts[j][1]); net.stroke(); }
      }
      net.fillStyle = "rgba(" + pts[i][2] + ",.9)"; net.beginPath(); net.arc(pts[i][0], pts[i][1], 3.2, 0, 6.29); net.fill();
    }
  }
  var gctx = $("#grain").getContext("2d"), gimg = gctx.createImageData(270, 480);
  function drawGrain(frame) {
    var g = rng(frame * 977 + 13), d = gimg.data;
    for (var i = 0; i < d.length; i += 4) { var v = g() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    gctx.putImageData(gimg, 0, 0);
  }
  var gl = $("#gridl"), prog = $("#prog i"), bug = $("#bug");

  window.SFX = SFX;
  window.REEL = {
    duration: DUR, offset: OFF,
    seek: function (t, fps) {
      tl.seek(Math.min(t, DUR), false);
      var frame = Math.round(t * (fps || 60));
      drawNet(t); drawGrain(frame); drawCap(t);
      gl.style.transform = "translate(" + (-(t * 36) % 90) + "px," + (-(t * 60) % 90) + "px)";
      prog.style.transform = "scaleX(" + Math.min(1, t / DUR) + ")";
      var light = t >= T_BRANDS && t < T_NEXT;
      bug.style.opacity = t < T_BRAND + 0.6 || t > T_CTA || light ? 0 : 1;
      cap.classList.toggle("dark", light);
    }
  };
})();
