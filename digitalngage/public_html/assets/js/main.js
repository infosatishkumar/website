/* ══════════════════════════════════════════════════════════════
   DigitalNgage — main.js
   Smooth scroll (Lenis) + GSAP ScrollTrigger animations.
   Every effect degrades gracefully: without GSAP, or with
   prefers-reduced-motion, all content is shown statically.
   ══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  var animate = hasGsap && !reduce;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  if (animate) {
    root.classList.add("js-anim");
    gsap.registerPlugin(ScrollTrigger);
  }

  /* ── Smooth scroll ─────────────────────────────── */
  var lenis = null;
  if (animate && typeof window.Lenis !== "undefined") {
    lenis = new Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); } });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  function scrollToTarget(target) {
    if (lenis) lenis.scrollTo(target, { offset: -90 });
    else if (typeof target === "number") window.scrollTo({ top: target, behavior: reduce ? "auto" : "smooth" });
    else {
      var el = typeof target === "string" ? $(target) : target;
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 90, behavior: reduce ? "auto" : "smooth" });
    }
  }

  /* ── Split text helper ─────────────────────────── */
  function splitWords(el) {
    if (el.classList.contains("is-split")) return $$(".split-word", el);
    var words = [];
    function walk(node, parent) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var parts = child.textContent.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(" ")); return; }
            var line = document.createElement("span"); line.className = "split-line";
            line.style.display = "inline-block";
            var w = document.createElement("span"); w.className = "split-word"; w.textContent = p;
            line.appendChild(w); frag.appendChild(line); words.push(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && !child.classList.contains("rotator") && child.tagName !== "BR") {
          walk(child, parent);
        } else if (child.nodeType === 1 && child.classList.contains("rotator")) {
          var wrap = document.createElement("span"); wrap.className = "split-line"; wrap.style.display = "inline-block";
          var w2 = document.createElement("span"); w2.className = "split-word";
          node.replaceChild(wrap, child); w2.appendChild(child); wrap.appendChild(w2); words.push(w2);
        }
      });
    }
    walk(el, el);
    el.classList.add("is-split");
    return words;
  }

  /* ── Preloader + intro ─────────────────────────── */
  var preloader = $(".preloader");
  function seenIntro() { try { return sessionStorage.getItem("dn-intro") === "1"; } catch (e) { return false; } }
  function markIntro() { try { sessionStorage.setItem("dn-intro", "1"); } catch (e) {} }

  var heroTl = null;
  function buildHeroIntro() {
    if (!animate) return;
    heroTl = gsap.timeline({ paused: true, defaults: { ease: "expo.out" } });
    var title = $("[data-hero-title]");
    if (title) {
      var words = splitWords(title);
      heroTl.fromTo(words, { yPercent: 115, rotate: 4 }, { yPercent: 0, rotate: 0, duration: 1.3, stagger: 0.06 }, 0.05);
    }
    if ($("[data-hero-fade]")) heroTl.fromTo("[data-hero-fade]", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, stagger: 0.1 }, 0.45);
    if ($(".fcard")) heroTl.fromTo(".fcard", { y: 60, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 1.3, stagger: 0.12 }, 0.6);
    if ($(".ticker")) heroTl.fromTo(".ticker", { yPercent: 120 }, { yPercent: 0, duration: 1.2 }, 0.7);
  }
  function heroIntro() { if (heroTl) heroTl.play(); }

  function runIntro() {
    buildHeroIntro();
    if (!preloader) { heroIntro(); return; }
    if (!animate || seenIntro()) {
      preloader.remove();
      heroIntro();
      return;
    }
    markIntro();
    var count = $(".preloader__count", preloader);
    var bar = $(".preloader__bar span", preloader);
    var o = { v: 0 };
    var tl = gsap.timeline();
    tl.to(o, { v: 100, duration: 1.6, ease: "power2.inOut", onUpdate: function () {
      if (count) count.textContent = Math.round(o.v);
      if (bar) bar.style.width = o.v + "%";
    } });
    tl.to(".preloader__inner", { y: -40, opacity: 0, duration: 0.5, ease: "power3.in" });
    tl.to(preloader, { clipPath: "inset(0 0 100% 0)", duration: 0.9, ease: "expo.inOut", onStart: function () { preloader.classList.add("is-done"); } });
    tl.add(heroIntro, "-=0.6");
    tl.add(function () { preloader.remove(); });
  }

  /* ── Page transitions ──────────────────────────── */
  var curtain = $(".curtain");
  function curtainOut() {
    if (!animate || !curtain) return;
    var fromNav = false;
    try { fromNav = sessionStorage.getItem("dn-nav") === "1"; sessionStorage.removeItem("dn-nav"); } catch (e) {}
    if (!fromNav) return;
    var bars = $$("span", curtain);
    gsap.set(bars, { scaleY: 1, transformOrigin: "top" });
    gsap.to(bars, { scaleY: 0, duration: 0.8, ease: "expo.inOut", stagger: 0.06, delay: 0.05 });
  }
  function bindTransitions() {
    if (!animate || !curtain) return;
    document.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      var href = a.getAttribute("href");
      if (!href || a.target === "_blank" || a.hasAttribute("download") || href.indexOf("#") === 0 || /^(mailto|tel|https?|wa|javascript):/i.test(href)) return;
      if (href.split("#")[0] === location.pathname.split("/").pop()) return;
      e.preventDefault();
      try { sessionStorage.setItem("dn-nav", "1"); } catch (err) {}
      var bars = $$("span", curtain);
      gsap.set(bars, { scaleY: 0, transformOrigin: "bottom" });
      gsap.to(bars, { scaleY: 1, duration: 0.6, ease: "expo.inOut", stagger: 0.05, onComplete: function () { location.href = href; } });
    });
    window.addEventListener("pageshow", function (e) { if (e.persisted) gsap.set($$("span", curtain), { scaleY: 0 }); });
  }

  /* ── Nav ───────────────────────────────────────── */
  function initNav() {
    var nav = $(".nav");
    if (!nav) return;
    var lightSections = $$("[data-nav-light]");
    var last = 0;
    function onScroll() {
      var y = window.pageYOffset;
      nav.classList.toggle("is-scrolled", y > 20);
      if (!root.classList.contains("menu-open")) nav.classList.toggle("is-hidden", y > 500 && y > last + 4);
      if (y < last - 4) nav.classList.remove("is-hidden");
      last = y;
      var mid = 40;
      var light = lightSections.some(function (s) { var r = s.getBoundingClientRect(); return r.top <= mid && r.bottom > mid; });
      nav.classList.toggle("is-light", light);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    var burger = $(".burger");
    if (burger) burger.addEventListener("click", function () {
      var open = root.classList.toggle("menu-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      if (lenis) { open ? lenis.stop() : lenis.start(); }
    });
    $$(".mmenu a").forEach(function (a) { a.addEventListener("click", function () { root.classList.remove("menu-open"); if (lenis) lenis.start(); }); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && root.classList.contains("menu-open")) { root.classList.remove("menu-open"); if (lenis) lenis.start(); } });

    // in-page anchors through Lenis
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href");
        if (id.length < 2) return;
        var t = $(id);
        if (!t) return;
        e.preventDefault();
        scrollToTarget(t);
      });
    });
  }

  /* ── Scroll progress + back-to-top ─────────────── */
  function initProgress() {
    var bar = $(".progress");
    var top = $(".fab__top");
    function update() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? window.pageYOffset / h : 0;
      if (bar) bar.style.transform = "scaleX(" + p + ")";
      if (top) top.classList.toggle("is-on", window.pageYOffset > 800);
    }
    window.addEventListener("scroll", update, { passive: true });
    update();
    if (top) top.addEventListener("click", function () { scrollToTarget(0); });
  }

  /* ── Cursor ────────────────────────────────────── */
  function initCursor() {
    if (!finePointer || reduce) return;
    var c = document.createElement("div"); c.className = "cursor"; c.innerHTML = '<span class="cursor__label"></span>';
    var d = document.createElement("div"); d.className = "cursor-dot";
    document.body.appendChild(c); document.body.appendChild(d);
    var label = $(".cursor__label", c);
    var x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    window.addEventListener("mousemove", function (e) {
      x = e.clientX; y = e.clientY;
      d.style.transform = "translate(" + x + "px," + y + "px)";
      root.classList.add("has-cursor");
    }, { passive: true });
    document.addEventListener("mouseleave", function () { root.classList.remove("has-cursor"); });
    (function loop() {
      cx += (x - cx) * 0.16; cy += (y - cy) * 0.16;
      c.style.transform = "translate(" + cx + "px," + cy + "px)";
      requestAnimationFrame(loop);
    })();
    document.addEventListener("mouseover", function (e) {
      var t = e.target.closest("[data-cursor], a, button, summary, label, select");
      c.classList.remove("is-hover", "is-label");
      if (!t) return;
      var l = t.getAttribute("data-cursor");
      if (l) { label.textContent = l; c.classList.add("is-label"); }
      else c.classList.add("is-hover");
    });
  }

  /* ── Magnetic buttons ──────────────────────────── */
  function initMagnetic() {
    if (!finePointer || !animate) return;
    $$("[data-magnetic]").forEach(function (el) {
      var strength = parseFloat(el.getAttribute("data-magnetic")) || 0.35;
      var xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
      var yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * strength);
        yTo((e.clientY - r.top - r.height / 2) * strength);
      });
      el.addEventListener("mouseleave", function () { xTo(0); yTo(0); });
    });
  }

  /* ── Spotlight + tilt cards ────────────────────── */
  function initCards() {
    $$(".scard").forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty("--mx", (e.clientX - r.left) + "px");
        card.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    });
    if (!finePointer || !animate) return;
    $$("[data-tilt]").forEach(function (el) {
      var max = parseFloat(el.getAttribute("data-tilt")) || 8;
      el.style.transformStyle = "preserve-3d";
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(el, { rotateY: px * max, rotateX: -py * max, transformPerspective: 900, duration: 0.6, ease: "power3.out" });
      });
      el.addEventListener("mouseleave", function () { gsap.to(el, { rotateY: 0, rotateX: 0, duration: 0.9, ease: "elastic.out(1, 0.5)" }); });
    });
  }

  /* ── Rotating word ─────────────────────────────── */
  function initRotator() {
    $$(".rotator").forEach(function (r) {
      var items = $$("span", r);
      if (items.length < 2) return;
      items[0].classList.add("is-on");
      if (!animate) return;
      gsap.set(items, { y: 0, yPercent: 110 });
      gsap.set(items[0], { yPercent: 0 });
      var i = 0;
      setInterval(function () {
        var cur = items[i]; i = (i + 1) % items.length; var nxt = items[i];
        gsap.to(cur, { yPercent: -110, duration: 0.8, ease: "expo.inOut" });
        gsap.fromTo(nxt, { yPercent: 110 }, { yPercent: 0, duration: 0.8, ease: "expo.inOut" });
      }, 2400);
    });
  }

  /* ── Hero network canvas ───────────────────────── */
  function initCanvas() {
    var canvas = $(".hero__canvas");
    if (!canvas || reduce) return;
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w, h, pts = [], mouse = { x: -9999, y: -9999 }, running = true;
    var colors = ["255,90,31", "255,46,126", "124,77,255", "255,176,32"];
    function resize() {
      w = canvas.offsetWidth; h = canvas.offsetHeight;
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.min(90, Math.round((w * h) / 16000));
      pts = [];
      for (var i = 0; i < n; i++) pts.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35, r: Math.random() * 1.8 + 0.8, c: colors[i % colors.length] });
    }
    resize();
    window.addEventListener("resize", resize);
    canvas.parentElement.addEventListener("mousemove", function (e) { var r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    canvas.parentElement.addEventListener("mouseleave", function () { mouse.x = mouse.y = -9999; });
    if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { running = en[0].isIntersecting; if (running) draw(); }).observe(canvas);
    function draw() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        var dxm = p.x - mouse.x, dym = p.y - mouse.y, dm = Math.sqrt(dxm * dxm + dym * dym);
        if (dm < 140) { p.x += dxm / dm * 1.2; p.y += dym / dm * 1.2; }
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        for (var j = i + 1; j < pts.length; j++) {
          var q = pts[j], dx = p.x - q.x, dy = p.y - q.y, d = dx * dx + dy * dy;
          if (d < 15000) {
            ctx.strokeStyle = "rgba(" + p.c + "," + (0.22 * (1 - d / 15000)) + ")";
            ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        ctx.fillStyle = "rgba(" + p.c + ",0.9)";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      requestAnimationFrame(draw);
    }
    draw();
  }

  /* ── Counters ──────────────────────────────────── */
  function formatNum(n, dec) { return n.toLocaleString("en-IN", { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
  function initCounters() {
    $$("[data-count]").forEach(function (el) {
      var end = parseFloat(el.getAttribute("data-count"));
      var dec = (el.getAttribute("data-count").split(".")[1] || "").length;
      var pre = el.getAttribute("data-prefix") || "", suf = el.getAttribute("data-suffix") || "";
      if (!animate) { el.textContent = pre + formatNum(end, dec) + suf; return; }
      var o = { v: 0 };
      el.textContent = pre + formatNum(0, dec) + suf;
      gsap.to(o, { v: end, duration: 2.2, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%", once: true },
        onUpdate: function () { el.textContent = pre + formatNum(o.v, dec) + suf; } });
    });
  }

  /* ── Scroll reveals ────────────────────────────── */
  function initReveals() {
    if (!animate) return;

    $$("[data-split]").forEach(function (el) {
      var words = splitWords(el);
      gsap.fromTo(words, { yPercent: 110, rotate: 3 }, { yPercent: 0, rotate: 0, duration: 1.2, ease: "expo.out", stagger: 0.04,
        scrollTrigger: { trigger: el, start: "top 88%", once: true } });
    });

    ScrollTrigger.batch("[data-reveal]", {
      start: "top 90%",
      once: true,
      onEnter: function (els) {
        gsap.to(els, { opacity: 1, x: 0, y: 0, scale: 1, duration: 1.1, ease: "expo.out", stagger: 0.09, overwrite: true });
      }
    });

    $$(".img-reveal").forEach(function (el) {
      var img = $("img", el);
      var tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 85%", once: true } });
      tl.to(el, { clipPath: "inset(0% 0 0 0)", duration: 1.4, ease: "expo.inOut" });
      if (img) tl.from(img, { scale: 1.3, duration: 1.8, ease: "expo.out" }, 0);
    });

    $$("[data-speed]").forEach(function (el) {
      var s = parseFloat(el.getAttribute("data-speed"));
      gsap.to(el, { yPercent: s * 100, ease: "none", scrollTrigger: { trigger: el.closest("section") || el, start: "top bottom", end: "bottom top", scrub: true } });
    });

    $$(".case__media img").forEach(function (img) {
      gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: "none", scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
    });

    // stacking case cards scale down as the next one covers them
    var cases = $$(".stack .case");
    if (cases.length > 1 && window.innerWidth > 860) {
      cases.forEach(function (c, i) {
        if (i === cases.length - 1) return;
        gsap.to(c, { scale: 0.92, opacity: 0.6, ease: "none", scrollTrigger: { trigger: cases[i + 1], start: "top bottom", end: "top " + (90 + 20), scrub: true } });
      });
    }

    // bento chart bars
    $$(".chart").forEach(function (ch) {
      gsap.from($$("i", ch), { scaleY: 0, duration: 1.4, ease: "expo.out", stagger: 0.07, scrollTrigger: { trigger: ch, start: "top 85%", once: true } });
    });

    // footer giant word
    var giant = $(".footer__giant");
    if (giant) gsap.from(giant, { yPercent: 60, opacity: 0, ease: "none", scrollTrigger: { trigger: giant, start: "top bottom", end: "bottom bottom", scrub: true } });

    // ticker skew on scroll velocity
    var tracks = $$(".marquee__track");
    if (tracks.length) {
      var skewTo = gsap.quickTo(tracks, "skewX", { duration: 0.5, ease: "power3" });
      ScrollTrigger.create({ onUpdate: function (self) { skewTo(gsap.utils.clamp(-8, 8, self.getVelocity() / -300)); } });
    }
  }

  /* ── Horizontal pinned process ─────────────────── */
  function initHScroll() {
    if (!animate) return;
    var mm = gsap.matchMedia();
    mm.add("(min-width: 901px)", function () {
      $$(".hscroll").forEach(function (sec) {
        var track = $(".hscroll__track", sec);
        var bar = $(".hscroll__bar span", sec);
        var dist = function () { return track.scrollWidth - window.innerWidth; };
        var tween = gsap.to(track, { x: function () { return -dist(); }, ease: "none",
          scrollTrigger: { trigger: sec, start: "top top", end: function () { return "+=" + dist(); }, pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
            onUpdate: function (self) { if (bar) bar.style.transform = "scaleX(" + self.progress + ")"; } } });
        $$(".step", sec).forEach(function (st) {
          gsap.from(st, { y: 80, rotate: 3, opacity: 0.3, ease: "none", scrollTrigger: { trigger: st, containerAnimation: tween, start: "left 95%", end: "left 55%", scrub: true } });
        });
      });
    });
  }

  /* ── Testimonials ──────────────────────────────── */
  function initTestimonials() {
    $$(".tslider").forEach(function (s) {
      var slides = $$(".tslide", s), dotsWrap = $(".tdots", s), i = 0, timer;
      if (!slides.length) return;
      var dots = slides.map(function (_, k) {
        var b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-label", "Show testimonial " + (k + 1));
        b.addEventListener("click", function () { go(k); });
        dotsWrap.appendChild(b); return b;
      });
      function go(k) {
        slides[i].classList.remove("is-on"); dots[i].classList.remove("is-on");
        i = k; slides[i].classList.add("is-on");
        void dots[i].offsetWidth; dots[i].classList.add("is-on");
        if (animate) gsap.fromTo(slides[i], { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.9, ease: "expo.out" });
        clearTimeout(timer); timer = setTimeout(function () { go((i + 1) % slides.length); }, 6000);
      }
      slides.forEach(function (sl) { sl.classList.remove("is-on"); });
      i = 0; slides[0].classList.add("is-on"); dots[0].classList.add("is-on");
      timer = setTimeout(function () { go(1 % slides.length); }, 6000);
    });
  }

  /* ── FAQ: one open at a time ───────────────────── */
  function initFaq() {
    $$(".faq").forEach(function (f) {
      var items = $$("details", f);
      items.forEach(function (d) {
        d.addEventListener("toggle", function () {
          if (!d.open) return;
          items.forEach(function (o) { if (o !== d) o.open = false; });
          if (animate) gsap.from($(".ans", d), { opacity: 0, y: -10, duration: 0.5, ease: "power3.out" });
          if (hasGsap) ScrollTrigger.refresh();
        });
      });
    });
  }

  /* ── Work filters ──────────────────────────────── */
  function initFilters() {
    var bar = $(".filters");
    if (!bar) return;
    var cards = $$("[data-cat]");
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      $$("button", bar).forEach(function (x) { x.classList.toggle("is-on", x === b); x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      var f = b.getAttribute("data-filter");
      var shown = [];
      cards.forEach(function (c) {
        var ok = f === "all" || c.getAttribute("data-cat").split(" ").indexOf(f) > -1;
        c.classList.toggle("is-hidden", !ok);
        if (ok) shown.push(c);
      });
      if (animate) gsap.fromTo(shown, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, ease: "expo.out", stagger: 0.06 });
      if (hasGsap) ScrollTrigger.refresh();
    });
  }

  /* ── Services sub-nav highlight ────────────────── */
  function initSvcNav() {
    var links = $$(".svc-nav a");
    if (!links.length || !("IntersectionObserver" in window)) return;
    var map = {};
    links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (l) { l.classList.remove("is-on"); });
        var a = map[en.target.id];
        if (a) { a.classList.add("is-on"); a.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }); }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    $$(".svc").forEach(function (s) { io.observe(s); });
  }

  /* ── Contact form ──────────────────────────────── */
  function initForm() {
    var form = $("#leadForm");
    if (!form) return;
    var status = $(".form__status", form);
    var btn = $("button[type=submit]", form);
    var params = new URLSearchParams(location.search);
    var pre = params.get("service");
    if (pre) { var sel = $("select[name=service]", form); if (sel) Array.prototype.forEach.call(sel.options, function (o) { if (o.value === pre) sel.value = pre; }); }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.className = "form__status";
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var data = new FormData(form);
      var budget = $$("input[name=budget]:checked", form).map(function (i) { return i.value; })[0];
      if (budget) data.set("message", (data.get("message") || "") + "\n\nBudget: " + budget);
      btn.disabled = true;
      var label = btn.innerHTML;
      btn.innerHTML = "Sending…";
      fetch(form.getAttribute("action"), { method: "POST", body: data })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res.status === "success") {
            status.textContent = "Thank you! Our team will get back to you within 24 hours.";
            status.className = "form__status ok";
            form.reset();
          } else throw new Error(res.msg || "error");
        })
        .catch(function () {
          status.innerHTML = 'Sorry, the message could not be sent. Please call <a href="tel:+919353241391">+91 93532 41391</a> or <a href="https://wa.me/919353241391" target="_blank" rel="noopener">WhatsApp us</a>.';
          status.className = "form__status err";
        })
        .then(function () { btn.disabled = false; btn.innerHTML = label; });
    });
  }

  /* ── Boot ──────────────────────────────────────── */
  function boot() {
    $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
    initNav();
    initProgress();
    initCursor();
    initMagnetic();
    initCards();
    initRotator();
    initCanvas();
    initCounters();
    initReveals();
    initHScroll();
    initTestimonials();
    initFaq();
    initFilters();
    initSvcNav();
    initForm();
    bindTransitions();
    curtainOut();
    runIntro();
    if (hasGsap) {
      window.addEventListener("load", function () { ScrollTrigger.refresh(); });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
