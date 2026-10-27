import { SvgCharacter } from './character.js';
import { LINES, pick } from './lines.js';

// Running outside Electron (e.g. opening index.html in a browser) gets a stub API.
const noop = () => {};
const api =
  window.karishma && typeof window.karishma.chat === 'function'
    ? window.karishma
    : new Proxy({}, { get: (_t, k) => (k.startsWith('on') ? () => noop : async () => ({ fallback: true })) });

const $ = (id) => document.getElementById(id);
const el = $('karishma');
const bodyEl = $('body');
const bubbleEl = $('bubble');
const bubbleText = $('bubbleText');
const bubbleButtons = $('bubbleButtons');
const chatForm = $('chat');
const chatInput = $('chatInput');

const G = 2600; // gravity px/s^2
const SVG_FEET = 296;
const SVG_HIP = 226;

let settings = {
  scale: 0.8,
  outfit: 'teal',
  walkAround: true,
  sitOnWindows: true,
  followCursor: false,
  sleepWhenIdle: true,
  chatty: true,
  voiceEnabled: true,
  volume: 0.9,
  vrmPath: '',
  userName: '',
};
let geo = { width: innerWidth, height: innerHeight, floor: innerHeight - 4, top: 0, left: 0, right: innerWidth };
let platform = null; // { x, y, width, app } top edge of the front window
let cursor = { x: -9999, y: -9999, movedAt: 0 };
let idleSeconds = 0;

let character = new SvgCharacter(bodyEl);
character.setOutfit(settings.outfit);
let loadedVrm = '';

const k = {
  x: geo.width * 0.7,
  y: -200,
  vx: 0,
  vy: 0,
  facing: 1,
  phys: 'air', // air | drag | ground
  ground: null, // 'floor' | 'window'
  activity: 'idle', // idle | walk | sit | sleep | prejump
  until: 0, // when the current activity ends
  targetX: null,
  jumpTarget: null,
  airIntent: 'fall', // fall | jump | throw
  action: null, // { name, start, dur }
  landAt: -10,
  blinkAt: 2,
  blinkT: -1,
  lookWander: { x: 0, y: 0, at: 0 },
};

const time = () => performance.now() / 1000;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const size = () => ({ w: 200 * settings.scale, h: 300 * settings.scale, s: settings.scale });

// ---------------- Geometry helpers ----------------

function isSitting() {
  return k.phys === 'ground' && (k.activity === 'sit' || k.activity === 'sleep');
}

function charTop() {
  const { s } = size();
  return k.y - (isSitting() ? SVG_HIP : SVG_FEET) * s;
}

function hitRegion(px, py) {
  const { w, s } = size();
  const left = k.x - w / 2;
  const top = charTop();
  const a = character.hitAreas();
  const hx = left + a.head.cx * s;
  const hy = top + a.head.cy * s;
  if (Math.hypot(px - hx, py - hy) < a.head.r * s) return 'head';
  const b = a.body;
  if (px > left + b.x * s && px < left + (b.x + b.w) * s && py > top + b.y * s && py < top + (b.y + b.h) * s) {
    return 'body';
  }
  return null;
}

function rectHas(elm, px, py) {
  if (elm.classList.contains('hidden')) return false;
  const r = elm.getBoundingClientRect();
  return px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;
}

function onPlatformRange(x) {
  return platform && x > platform.x + 20 && x < platform.x + platform.width - 20;
}

// ---------------- Mouse pass-through ----------------

let ignoring = true;
let pressed = null;
let chatOpen = false;

function updateInteractive() {
  const over =
    pressed ||
    k.phys === 'drag' ||
    chatOpen ||
    hitRegion(cursor.x, cursor.y) ||
    (bubbleButtons.childElementCount > 0 && rectHas(bubbleEl, cursor.x, cursor.y));
  const ignore = !over;
  if (ignore !== ignoring) {
    ignoring = ignore;
    api.setIgnoreMouse(ignore);
  }
}

// ---------------- Speech bubble + voice ----------------

let bubbleTimer = null;
let typeTimer = null;
let alarmActive = false;
let speaking = false;
let syntheticTalkUntil = 0;
let analyser = null;
let analyserData = null;
let audioCtx = null;
let currentAudio = null;

function ctx() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function hideBubble() {
  bubbleEl.classList.add('hidden');
  bubbleEl.classList.remove('alarm');
  bubbleButtons.innerHTML = '';
}

function showBubble(text, { duration, buttons = [], cls = '', dots = false } = {}) {
  clearTimeout(bubbleTimer);
  clearInterval(typeTimer);
  bubbleEl.className = cls;
  bubbleText.className = dots ? 'dots' : '';
  bubbleButtons.innerHTML = '';
  for (const b of buttons) {
    const btn = document.createElement('button');
    btn.textContent = b.label;
    if (b.primary) btn.className = 'primary';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      b.onClick();
    });
    bubbleButtons.appendChild(btn);
  }
  // Typewriter effect
  const chars = [...text];
  let i = 0;
  bubbleText.textContent = '';
  typeTimer = setInterval(() => {
    i += 2;
    bubbleText.textContent = chars.slice(0, i).join('');
    if (i >= chars.length) clearInterval(typeTimer);
  }, 28);
  if (duration !== Infinity) {
    const d = duration || clamp(chars.length * 75, 3000, 14000);
    bubbleTimer = setTimeout(hideBubble, d);
  }
}

function stopVoice() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  speaking = false;
  analyser = null;
}

function cleanForSpeech(text) {
  return text.replace(/[\p{Extended_Pictographic}‍️]/gu, '').replace(/\s+/g, ' ').trim();
}

async function speak(text) {
  const clean = cleanForSpeech(text);
  stopVoice();
  if (!clean || !settings.voiceEnabled) {
    syntheticTalkUntil = time() + Math.min(clean.length * 0.06, 6);
    return;
  }
  const res = await api.tts(clean);
  if (res && res.audio) {
    const bytes = Uint8Array.from(atob(res.audio), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
    const audio = new Audio(url);
    audio.volume = settings.volume;
    try {
      const ac = ctx();
      const src = ac.createMediaElementSource(audio);
      analyser = ac.createAnalyser();
      analyser.fftSize = 512;
      analyserData = new Uint8Array(analyser.fftSize);
      src.connect(analyser);
      analyser.connect(ac.destination);
    } catch {
      analyser = null;
    }
    currentAudio = audio;
    speaking = true;
    audio.onended = () => {
      speaking = false;
      analyser = null;
      URL.revokeObjectURL(url);
    };
    audio.play().catch(() => {
      speaking = false;
    });
    return;
  }
  if (res && res.off) return;
  // System voice fallback (macOS voices such as Lekha / Veena / Rishi)
  if (!('speechSynthesis' in window)) {
    syntheticTalkUntil = time() + Math.min(clean.length * 0.06, 6);
    return;
  }
  const u = new SpeechSynthesisUtterance(clean);
  const devanagari = /[ऀ-ॿ]/.test(clean);
  const voices = speechSynthesis.getVoices();
  const want = devanagari ? ['hi-IN'] : ['en-IN', 'hi-IN', 'en-GB', 'en-US'];
  for (const lang of want) {
    const v = voices.find((x) => x.lang === lang || x.lang.replace('_', '-') === lang);
    if (v) {
      u.voice = v;
      break;
    }
  }
  u.rate = 1.03;
  u.pitch = 1.25;
  u.volume = settings.volume;
  u.onstart = () => (speaking = true);
  u.onend = () => (speaking = false);
  speechSynthesis.speak(u);
}

function say(text, opts = {}) {
  if (alarmActive && !opts.force) return;
  showBubble(text, opts);
  if (opts.action) startAction(opts.action);
  if (!opts.silent) speak(text);
}

function talkLevel(t) {
  if (analyser) {
    analyser.getByteTimeDomainData(analyserData);
    let sum = 0;
    for (const v of analyserData) sum += ((v - 128) / 128) ** 2;
    return clamp(Math.sqrt(sum / analyserData.length) * 5, 0, 1);
  }
  if (speaking || t < syntheticTalkUntil) return 0.5 + 0.5 * Math.abs(Math.sin(t * 17) * Math.sin(t * 7.3));
  return 0;
}

// ---------------- Sounds ----------------

function chime(notes = [784, 988, 1175, 1568], gap = 0.13) {
  try {
    const ac = ctx();
    const now = ac.currentTime;
    notes.forEach((freq, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      const t0 = now + i * gap;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.18 * settings.volume, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
      o.connect(g).connect(ac.destination);
      o.start(t0);
      o.stop(t0 + 0.65);
    });
  } catch {
    // audio not available
  }
}

// ---------------- Particles ----------------

function particle(emoji, cls = '') {
  const { w, s } = size();
  const p = document.createElement('div');
  p.className = `particle ${cls}`;
  p.textContent = emoji;
  p.style.left = `${k.x + rand(-w * 0.3, w * 0.3)}px`;
  p.style.top = `${charTop() + rand(10, 60) * s}px`;
  p.style.setProperty('--dx', `${rand(-30, 30)}px`);
  $('stage').appendChild(p);
  setTimeout(() => p.remove(), 2600);
}

// ---------------- Actions (expressive overlays) ----------------

const ACTION_DUR = {
  wave: 2.4,
  dance: 6,
  happy: 2.2,
  shy: 3,
  stretch: 2.6,
  think: 60,
  surprised: 1.3,
  sad: 3,
  pat: 0.7,
  poke: 1.0,
  dizzy: 2.5,
};

function startAction(name) {
  if (name === 'sleep') {
    if (k.phys === 'ground') setActivity('sleep', 10);
    return;
  }
  if (name === 'come') {
    if (k.phys === 'ground') {
      if (k.ground === 'window') jumpTo((geo.left + geo.right) / 2, geo.floor);
      else setActivity('walk', 20, (geo.left + geo.right) / 2);
    }
    return;
  }
  if (!ACTION_DUR[name]) return;
  if (k.activity === 'sleep' && name !== 'pat') setActivity(k.ground === 'window' ? 'sit' : 'idle', rand(3, 6));
  k.action = { name, start: time(), dur: ACTION_DUR[name] };
  if (name === 'happy' && k.phys === 'ground' && !isSitting()) hop(380);
  if (name === 'surprised' && k.phys === 'ground' && !isSitting()) hop(300);
}

function endAction(name) {
  if (k.action && (!name || k.action.name === name)) k.action = null;
}

// ---------------- Movement ----------------

function setActivity(activity, seconds, targetX = null) {
  k.activity = activity;
  k.until = time() + seconds;
  k.targetX = targetX;
}

function hop(power) {
  k.phys = 'air';
  k.airIntent = 'jump';
  k.vy = -power;
  k.vx = 0;
  k.jumpTarget = { x: k.x, y: k.y };
  k.ground = null;
}

function jumpTo(tx, ty) {
  const dist = Math.hypot(tx - k.x, ty - k.y);
  const T = clamp(0.55 + dist / 1800, 0.6, 1.1);
  k.vx = (tx - k.x) / T;
  k.vy = (ty - k.y - 0.5 * G * T * T) / T;
  k.facing = tx < k.x ? -1 : 1;
  k.phys = 'air';
  k.airIntent = 'jump';
  k.ground = null;
  k.jumpTarget = { x: tx, y: ty };
}

function land(ground, y) {
  const speed = Math.hypot(k.vx, k.vy);
  const thrown = k.airIntent === 'throw';
  k.phys = 'ground';
  k.ground = ground;
  k.y = y;
  k.vx = 0;
  k.vy = 0;
  k.landAt = time();
  if (ground === 'window') setActivity('sit', rand(12, 40));
  else setActivity('idle', rand(1.5, 3));
  if (thrown && speed > 1500) {
    startAction('dizzy');
    say(pick(LINES.dizzy), {});
  } else if (thrown && speed > 700 && Math.random() < 0.5) {
    say(pick(LINES.landed));
  }
  k.airIntent = 'fall';
}

function decide() {
  const t = time();
  const onWindow = k.ground === 'window';
  if (settings.followCursor && !onWindow) {
    const dx = cursor.x - k.x;
    if (Math.abs(dx) > 60) return setActivity('walk', 3, clamp(cursor.x, geo.left + 60, geo.right - 60));
    return setActivity('idle', 1);
  }
  const r = Math.random();
  if (onWindow) {
    if (r < 0.22) return jumpTo(clamp(k.x + rand(-200, 200), geo.left + 80, geo.right - 80), geo.floor);
    if (r < 0.35 && platform) {
      return setActivity('walk', 8, rand(platform.x + 40, platform.x + platform.width - 40));
    }
    if (r < 0.45) startAction(pick(['stretch', 'wave', 'happy']));
    return setActivity('sit', rand(15, 45));
  }
  if (r < 0.14 && platform && settings.sitOnWindows && platform.y > geo.top + 120) {
    k.activity = 'prejump';
    k.until = t + 0.25;
    const pad = Math.min(80, platform.width / 3);
    k.targetX = rand(platform.x + pad, platform.x + platform.width - pad);
    return;
  }
  if (r < 0.48 && settings.walkAround) {
    const { w } = size();
    return setActivity('walk', 15, rand(geo.left + w, geo.right - w));
  }
  if (r < 0.62) return setActivity('sit', rand(8, 25));
  if (r < 0.7) startAction(pick(['stretch', 'wave', 'dance', 'happy']));
  return setActivity('idle', rand(3, 7));
}

function step(dt, t) {
  const { w } = size();
  const minX = geo.left + w / 2;
  const maxX = geo.right - w / 2;

  if (k.phys === 'air') {
    k.vy += G * dt;
    const prevY = k.y;
    k.x += k.vx * dt;
    k.y += k.vy * dt;
    if (k.x < minX || k.x > maxX) {
      k.x = clamp(k.x, minX, maxX);
      k.vx *= -0.45;
    }
    const ceiling = geo.top + 300 * settings.scale;
    if (k.y < ceiling && k.vy < 0) {
      k.y = ceiling;
      k.vy *= -0.3;
    }
    if (k.vy > 0 && platform && onPlatformRange(k.x) && prevY <= platform.y && k.y >= platform.y) {
      const intended = k.jumpTarget && k.jumpTarget.y === platform.y;
      const fromAbove = k.airIntent !== 'jump' || intended;
      if (fromAbove) return land('window', platform.y);
    }
    if (k.y >= geo.floor) {
      // a bounce for hard throws
      if (k.airIntent === 'throw' && k.vy > 1400) {
        k.y = geo.floor;
        k.vy *= -0.35;
        k.vx *= 0.6;
        return;
      }
      return land('floor', geo.floor);
    }
    return;
  }

  if (k.phys !== 'ground') return;

  // Stay glued to the floor / window edge
  if (k.ground === 'floor') k.y = geo.floor;
  if (k.ground === 'window') {
    if (!platform || !onPlatformRange(k.x) || !settings.sitOnWindows) {
      k.phys = 'air';
      k.airIntent = 'fall';
      k.vy = 0;
      k.vx = 0;
      k.ground = null;
      if (Math.random() < 0.6) say(pick(LINES.fell));
      return;
    }
    k.y = platform.y;
  }

  if (k.activity === 'prejump') {
    if (t >= k.until) {
      if (platform && settings.sitOnWindows) jumpTo(k.targetX, platform.y);
      else setActivity('idle', 2);
    }
    return;
  }

  if (k.activity === 'walk' && k.targetX != null) {
    const speed = 95 * Math.sqrt(settings.scale / 0.8);
    const dx = k.targetX - k.x;
    k.facing = dx < 0 ? -1 : 1;
    if (Math.abs(dx) < 4) {
      setActivity(k.ground === 'window' ? 'sit' : 'idle', rand(2, 5));
    } else {
      k.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
      k.x = clamp(k.x, minX, maxX);
      if (k.ground === 'window' && platform) {
        k.x = clamp(k.x, platform.x + 22, platform.x + platform.width - 22);
      }
    }
  }

  // Fall asleep when the user is away
  if (settings.sleepWhenIdle && idleSeconds > 240 && k.activity !== 'sleep' && !k.action) {
    setActivity('sleep', 1e9);
  }
  if (k.activity === 'sleep' && idleSeconds < 3 && k.until > t + 1e8) {
    setActivity(k.ground === 'window' ? 'sit' : 'idle', 3);
    startAction('stretch');
    say(pick(LINES.wake));
  }

  if (t >= k.until && !k.action) decide();
}

// ---------------- Pose ----------------

const pose = {
  facing: 1,
  lean: 0,
  squashX: 1,
  squashY: 1,
  bob: 0,
  headX: 0,
  headY: 0,
  headTilt: 0,
  tail: 0,
  torsoTilt: 0,
  armL: 0,
  armR: 0,
  legL: 0,
  legR: 0,
  lookX: 0,
  lookY: 0,
  blink: 0,
  blush: 0.1,
  talk: 0,
  eyes: 'open',
  mouth: 'smile',
  sitting: false,
  grounded: true,
  walking: false,
};

const SMOOTH = ['lean', 'squashX', 'squashY', 'bob', 'headX', 'headY', 'headTilt', 'tail', 'torsoTilt', 'armL', 'armR', 'legL', 'legR', 'lookX', 'lookY', 'blush'];

let patEnergy = 0;
let patting = false;
let lastPatAt = 0;
let patSpoken = 0;
let lastCursor = { x: 0, y: 0 };
let dragVel = { x: 0, y: 0 };

function targetPose(t, dt) {
  const p = {
    lean: 0,
    squashX: 1,
    squashY: 1,
    bob: Math.sin(t * 2.1) * 1.2,
    headX: 0,
    headY: 0,
    headTilt: Math.sin(t * 0.7) * 2,
    tail: Math.sin(t * 1.3) * 2,
    torsoTilt: 0,
    armL: 2 + Math.sin(t * 2.1) * 2,
    armR: 2 + Math.sin(t * 2.1 + 0.5) * 2,
    legL: 0,
    legR: 0,
    lookX: 0,
    lookY: 0,
    blush: 0.1,
    eyes: 'open',
    mouth: 'smile',
    sitting: isSitting(),
    grounded: k.phys === 'ground',
    walking: false,
  };
  const { s } = size();

  // Where to look: the cursor if it's around, otherwise wander
  const headWX = k.x;
  const headWY = charTop() + 105 * s;
  const cdx = cursor.x - headWX;
  const cdy = cursor.y - headWY;
  const cdist = Math.hypot(cdx, cdy);
  if (t - cursor.movedAt < 4 || cdist < 400) {
    p.lookX = clamp(cdx / 350, -1, 1);
    p.lookY = clamp(cdy / 350, -1, 1);
    p.headTilt += clamp(cdx / 120, -5, 5);
  } else {
    if (t > k.lookWander.at) {
      k.lookWander = { x: rand(-1, 1), y: rand(-0.6, 0.6), at: t + rand(1.5, 4) };
    }
    p.lookX = k.lookWander.x;
    p.lookY = k.lookWander.y;
  }

  // Physical state
  if (k.phys === 'drag') {
    const vx = clamp(dragVel.x / 25, -40, 40);
    p.lean = clamp(-vx * 0.4, -18, 18);
    p.legL = clamp(-vx, -35, 35) + Math.sin(t * 6) * 6;
    p.legR = clamp(-vx, -35, 35) + Math.sin(t * 6 + 1) * 6;
    p.armL = 35 + Math.sin(t * 8) * 8;
    p.armR = 35 + Math.sin(t * 8 + 2) * 8;
    p.tail = clamp(-vx * 0.6, -15, 15);
    p.eyes = t - k.dragStart < 0.6 ? 'surprised' : 'open';
    p.mouth = t - k.dragStart > 3 ? 'sad' : 'o';
    p.bob = 0;
  } else if (k.phys === 'air') {
    const up = k.vy < 0;
    if (k.airIntent === 'jump') {
      p.armL = up ? 70 : 40;
      p.armR = up ? 70 : 40;
      p.legL = up ? -15 : 10;
      p.legR = up ? 15 : -10;
      p.eyes = 'happy';
      p.mouth = 'cat';
    } else {
      p.armL = 130 + Math.sin(t * 20) * 25;
      p.armR = 130 + Math.sin(t * 20 + 1) * 25;
      p.legL = Math.sin(t * 18) * 25;
      p.legR = -Math.sin(t * 18) * 25;
      p.eyes = 'surprised';
      p.mouth = 'o';
    }
    p.lean = clamp(k.vx / 60, -20, 20);
    p.tail = clamp(-k.vy / 80, -20, 20);
    p.bob = 0;
  } else {
    const sinceLand = t - k.landAt;
    if (sinceLand < 0.3) {
      const q = Math.sin((sinceLand / 0.3) * Math.PI);
      p.squashY = 1 - q * 0.16;
      p.squashX = 1 + q * 0.12;
    }
    if (k.activity === 'walk') {
      const ph = t * 9;
      p.walking = true;
      p.legL = Math.sin(ph) * 22;
      p.legR = -Math.sin(ph) * 22;
      p.armL = 6 - Math.sin(ph) * 14;
      p.armR = 6 + Math.sin(ph) * 14;
      p.bob = -Math.abs(Math.sin(ph)) * 3;
      p.tail = Math.sin(ph) * 5;
      p.lean = 3;
    } else if (k.activity === 'sit') {
      p.legL = Math.sin(t * 2.6) * 14;
      p.legR = Math.sin(t * 2.6 + 1.7) * 14;
      p.armL = 18;
      p.armR = 18;
    } else if (k.activity === 'sleep') {
      p.eyes = 'closed';
      p.mouth = 'o';
      p.headTilt = 14 + Math.sin(t * 0.9) * 2;
      p.bob = Math.sin(t * 1.1) * 2;
      p.armL = 10;
      p.armR = 10;
      p.legL = 4;
      p.legR = -4;
      p.lookX = 0;
      p.lookY = 0;
    } else if (k.activity === 'prejump') {
      p.squashY = 0.86;
      p.squashX = 1.08;
      p.armL = -10;
      p.armR = -10;
      p.eyes = 'happy';
    }
  }

  // Cursor play: reach for the cursor when it is close to a hand
  if (k.phys === 'ground' && !k.action && k.activity !== 'sleep' && !patting) {
    const shoulderY = charTop() + 163 * s;
    const sideR = cursor.x > k.x;
    const shoulderX = k.x + (sideR ? 24 : -24) * s;
    const dx = cursor.x - shoulderX;
    const dy = cursor.y - shoulderY;
    if (Math.hypot(dx, dy) < 170 * s && Math.abs(dx) > 10 * s) {
      const out = sideR ? dx : -dx;
      const angle = clamp((Math.atan2(out, dy) * 180) / Math.PI, -10, 175);
      if (sideR) p.armR = angle;
      else p.armL = angle;
      p.mouth = 'cat';
    }
  }

  // Expressive actions override the base pose
  const a = k.action;
  if (a) {
    const at = t - a.start;
    if (at > a.dur) {
      k.action = null;
    } else {
      const sw = Math.sin(at * 12);
      switch (a.name) {
        case 'wave':
          p.armR = 140 + sw * 22;
          p.eyes = 'happy';
          p.mouth = 'cat';
          p.headTilt = -6;
          break;
        case 'dance': {
          const b = Math.sin(at * 8);
          p.bob = -Math.abs(b) * 8;
          p.lean = Math.sin(at * 4) * 9;
          p.armL = 95 + b * 55;
          p.armR = 95 - b * 55;
          p.legL = b * 14;
          p.legR = -b * 14;
          p.tail = Math.sin(at * 4) * 12;
          p.eyes = 'happy';
          p.mouth = 'cat';
          p.blush = 0.5;
          if (Math.random() < dt * 2.2) particle(pick(['🎵', '🎶', '✨']));
          break;
        }
        case 'happy':
          p.armL = 60 + sw * 10;
          p.armR = 60 - sw * 10;
          p.eyes = 'happy';
          p.mouth = 'open';
          p.blush = 0.7;
          if (Math.random() < dt * 3) particle(pick(['💖', '✨', '💕']));
          break;
        case 'shy':
          p.blush = 1;
          p.headTilt = -10;
          p.lookX = -0.6;
          p.lookY = 0.8;
          p.armL = -12;
          p.armR = -12;
          p.mouth = 'flat';
          break;
        case 'stretch':
          p.armL = 170;
          p.armR = 170;
          p.squashY = 1.05;
          p.squashX = 0.97;
          p.eyes = 'closed';
          p.mouth = 'o';
          break;
        case 'think':
          p.armR = 125;
          p.lookX = 0.7;
          p.lookY = -0.9;
          p.headTilt = 8;
          p.mouth = 'flat';
          break;
        case 'surprised':
          p.eyes = 'surprised';
          p.mouth = 'o';
          p.armL = 45;
          p.armR = 45;
          break;
        case 'sad':
          p.mouth = 'sad';
          p.headTilt = 9;
          p.lookY = 0.8;
          p.armL = -6;
          p.armR = -6;
          break;
        case 'poke':
          p.eyes = at < 0.4 ? 'closed' : 'open';
          p.mouth = 'o';
          p.lean = Math.sin(at * 25) * 6 * (1 - at);
          break;
        case 'dizzy':
          p.eyes = 'closed';
          p.mouth = 'sad';
          p.headTilt = Math.sin(at * 5) * 14;
          p.lean = Math.sin(at * 5) * 6;
          if (Math.random() < dt * 3) particle(pick(['💫', '⭐']));
          break;
        default:
          break;
      }
    }
  }

  // Head pats win over everything else
  if (patting) {
    p.eyes = 'happy';
    p.mouth = 'cat';
    p.blush = 1;
    p.headTilt = clamp((cursor.x - k.x) / 10, -12, 12);
    p.squashY *= 0.97;
    if (Math.random() < dt * 3.5) particle(pick(['💗', '💕', '💖']));
  }

  // Blinking
  if (k.blinkT < 0 && t > k.blinkAt) k.blinkT = 0;
  let blink = 0;
  if (k.blinkT >= 0) {
    k.blinkT += dt;
    blink = Math.sin(clamp(k.blinkT / 0.14, 0, 1) * Math.PI);
    if (k.blinkT > 0.14) {
      k.blinkT = -1;
      k.blinkAt = t + rand(2, 5.5);
    }
  }
  p.blink = blink;
  p.talk = talkLevel(t);
  if (k.activity === 'sleep' && Math.random() < dt * 0.7) particle('Z', 'zzz');
  return p;
}

function updatePats(t) {
  const region = hitRegion(cursor.x, cursor.y);
  const moved = Math.hypot(cursor.x - lastCursor.x, cursor.y - lastCursor.y);
  lastCursor = { x: cursor.x, y: cursor.y };
  if (region === 'head' && k.phys !== 'drag' && !pressed && moved > 1.5) {
    patEnergy += moved;
    lastPatAt = t;
  }
  patEnergy *= 0.93;
  const was = patting;
  patting = patEnergy > 60 && t - lastPatAt < 0.6;
  if (patting && !was && k.activity === 'sleep') setActivity(k.ground === 'window' ? 'sit' : 'idle', 4);
  if (was && !patting && t - patSpoken > 6) {
    patSpoken = t;
    say(pick(LINES.pat));
  }
}

// ---------------- Render loop ----------------

let last = time();
function frame() {
  const t = time();
  const dt = Math.min(t - last, 0.05);
  last = t;

  step(dt, t);
  updatePats(t);
  const target = targetPose(t, dt);
  const f = 1 - Math.exp(-dt * 14);
  for (const key of SMOOTH) pose[key] += (target[key] - pose[key]) * f;
  pose.facing = k.facing;
  for (const key of ['eyes', 'mouth', 'sitting', 'grounded', 'walking', 'blink', 'talk']) pose[key] = target[key];
  character.apply(pose);

  const { w, h } = size();
  const left = k.x - w / 2;
  const top = charTop();
  el.style.transform = `translate(${left}px, ${top}px)`;

  // Chat and bubble float above her head; near the top of the screen the bubble moves beside her
  const headTop = top + 40 * settings.scale;
  const cx = clamp(k.x, geo.left + 150, geo.right - 150);
  const chatTop = Math.max(headTop - 46, geo.top + 8);
  chatForm.style.left = `${cx}px`;
  chatForm.style.top = `${chatTop}px`;
  const bw = bubbleEl.offsetWidth || 200;
  const bh = bubbleEl.offsetHeight || 60;
  const bottom = chatOpen ? chatTop - 14 : headTop - 12;
  const side = bottom - bh < geo.top + 8;
  bubbleEl.classList.toggle('side', side);
  if (side) {
    const right = k.x + w * 0.35 + 14;
    const flip = right + bw > geo.right - 8;
    bubbleEl.style.left = `${flip ? k.x - w * 0.35 - 14 - bw : right}px`;
    bubbleEl.style.top = `${clamp(top + 110 * settings.scale, geo.top + bh / 2 + 8, geo.floor - bh / 2 - 8)}px`;
  } else {
    bubbleEl.style.left = `${clamp(k.x, geo.left + bw / 2 + 8, geo.right - bw / 2 - 8)}px`;
    bubbleEl.style.top = `${bottom}px`;
  }
  if (h !== el._h) {
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el._h = h;
    if (character.setSize) character.setSize(w, h);
  }

  updateInteractive();
  requestAnimationFrame(frame);
}

// ---------------- Pointer: drag, throw, poke, chat ----------------

el.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  el.setPointerCapture(e.pointerId);
  pressed = { x: e.clientX, y: e.clientY, offX: e.clientX - k.x, offY: e.clientY - k.y, region: hitRegion(e.clientX, e.clientY), samples: [] };
});

el.addEventListener('pointermove', (e) => {
  if (!pressed) return;
  const t = time();
  if (k.phys !== 'drag' && Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) > 5) {
    k.phys = 'drag';
    k.ground = null;
    k.activity = 'idle';
    k.dragStart = t;
    k.action = null;
    el.classList.add('dragging');
    if (Math.random() < 0.45) say(pick(LINES.pickedUp));
  }
  if (k.phys === 'drag') {
    k.x = e.clientX - pressed.offX;
    k.y = e.clientY - pressed.offY;
    pressed.samples.push({ x: e.clientX, y: e.clientY, t });
    while (pressed.samples.length > 2 && t - pressed.samples[0].t > 0.1) pressed.samples.shift();
    const a = pressed.samples[0];
    const span = Math.max(t - a.t, 0.016);
    dragVel = { x: (e.clientX - a.x) / span, y: (e.clientY - a.y) / span };
  }
});

let clickTimer = null;
el.addEventListener('pointerup', (e) => {
  if (!pressed) return;
  const p = pressed;
  pressed = null;
  el.classList.remove('dragging');
  if (k.phys === 'drag') {
    k.phys = 'air';
    k.airIntent = 'throw';
    const recent = p.samples.length && time() - p.samples[p.samples.length - 1].t < 0.08;
    k.vx = recent ? clamp(dragVel.x, -3200, 3200) : 0;
    k.vy = recent ? clamp(dragVel.y, -3200, 3200) : 0;
    k.jumpTarget = null;
    return;
  }
  // A click: wait briefly to tell single from double clicks
  clearTimeout(clickTimer);
  if (e.detail >= 2) {
    openChat();
    return;
  }
  clickTimer = setTimeout(() => {
    if (p.region === 'head') {
      startAction('shy');
      say(pick(LINES.headPoke));
    } else {
      startAction('poke');
      say(pick(LINES.poke));
    }
  }, 260);
});

el.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  api.contextMenu();
});

function openChat() {
  chatOpen = true;
  chatForm.classList.remove('hidden');
  api.focusOverlay(true);
  setTimeout(() => chatInput.focus(), 60);
  if (bubbleEl.classList.contains('hidden')) {
    say(pick(LINES.chatOpen), { silent: true, duration: 4000 });
  }
  if (k.activity === 'sleep') setActivity(k.ground === 'window' ? 'sit' : 'idle', 5);
}

function closeChat() {
  if (!chatOpen) return;
  chatOpen = false;
  chatForm.classList.add('hidden');
  chatInput.blur();
  api.focusOverlay(false);
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  stopVoice();
  startAction('think');
  showBubble('Soch rahi hoon', { dots: true, duration: Infinity });
  const reply = await api.chat(text);
  endAction('think');
  say(typeof reply === 'string' ? reply : '🙂', { force: true });
});

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeChat();
});
window.addEventListener('blur', closeChat);

// ---------------- Alarms & wellbeing ----------------

let alarmLoop = null;
function stopAlarm() {
  alarmActive = false;
  clearInterval(alarmLoop);
  hideBubble();
  endAction();
}

function ringAlarm({ label, kind }) {
  stopVoice();
  alarmActive = true;
  const icon = kind === 'alarm' ? '⏰' : '🔔';
  showBubble(`${icon} ${label}`, {
    duration: Infinity,
    cls: 'alarm',
    buttons: [
      { label: 'Snooze 5 min', onClick: () => { api.snooze(label); stopAlarm(); say('Theek hai, 5 minute aur! 😴'); } },
      { label: 'Theek hai!', primary: true, onClick: () => { stopAlarm(); say(pick(LINES.alarmDone), { action: 'happy' }); } },
    ],
  });
  if (k.activity === 'sleep') setActivity(k.ground === 'window' ? 'sit' : 'idle', 3);
  speak(kind === 'alarm' ? `${label}! Uth jao!` : `Reminder: ${label}`);
  chime();
  let rings = 0;
  clearInterval(alarmLoop);
  alarmLoop = setInterval(() => {
    rings += 1;
    chime();
    startAction(rings % 2 ? 'wave' : 'surprised');
    if (rings > 40) stopAlarm();
  }, 2500);
}

api.onAlarm(ringAlarm);

api.onWellbeing((kind) => {
  if (alarmActive) return;
  if (kind === 'water') {
    chime([1046, 1318]);
    say(pick(LINES.water), { action: 'happy' });
    for (let i = 0; i < 3; i++) setTimeout(() => particle('💧'), i * 250);
  } else if (kind === 'break') {
    chime([880, 1046]);
    say(pick(LINES.break), { action: 'stretch' });
  } else if (kind === 'hour') {
    chime([1318, 1046]);
    const h = new Date().getHours();
    const h12 = ((h + 11) % 12) + 1;
    say(`${h12} baj gaye! ${pick(LINES.hour)}`);
  }
});

// ---------------- Wiring to the main process ----------------

api.onGeometry((g) => {
  geo = g;
  if (k.ground === 'floor') k.y = geo.floor;
  if (k.y < -100) k.x = clamp(geo.right - 260, geo.left + 100, geo.right - 100);
});

api.onCursor((c) => {
  if (c.x !== cursor.x || c.y !== cursor.y) cursor.movedAt = time();
  cursor.x = c.x;
  cursor.y = c.y;
});

api.onIdle((s) => {
  idleSeconds = s;
});

let lastApp = '';
let lastAppComment = 0;
api.onPlatform((p) => {
  const prev = platform;
  platform = p;
  if (prev && p && k.ground === 'window') {
    // Ride along when the window moves
    k.x += p.x - prev.x;
  }
  if (p && p.app !== lastApp) {
    lastApp = p.app;
    const t = time();
    if (settings.chatty && t - lastAppComment > 300 && Math.random() < 0.25 && !chatOpen) {
      lastAppComment = t;
      say(pick(LINES.appComment).replace('{app}', p.app));
    }
  }
});

api.onSay((m) => say(m.text, { action: m.action, duration: m.duration }));
api.onAction((a) => startAction(a));
api.onOpenChat(openChat);

async function applyVrm(path) {
  if (path === loadedVrm) return;
  loadedVrm = path;
  if (!path) {
    character = new SvgCharacter(bodyEl);
    character.setOutfit(settings.outfit);
    el._h = 0;
    return;
  }
  try {
    const bytes = await api.readVrm();
    if (!bytes) throw new Error('file not found');
    const { VrmCharacter } = await import('./vrm.js');
    character = await VrmCharacter.load(bodyEl, bytes);
    el._h = 0;
    say('Naya look kaisa laga? 💃', { action: 'happy' });
  } catch (err) {
    console.error(err);
    character = new SvgCharacter(bodyEl);
    character.setOutfit(settings.outfit);
    el._h = 0;
    say('Yeh VRM model load nahi hua 😢 Koi doosra try karo?');
  }
}

api.onSettings((s) => {
  settings = { ...settings, ...s };
  character.setOutfit(settings.outfit);
  applyVrm(settings.vrmPath || '');
});

// Random chatter every few minutes
function scheduleChatter() {
  setTimeout(() => {
    if (settings.chatty && !chatOpen && !alarmActive && k.activity !== 'sleep' && bubbleEl.classList.contains('hidden')) {
      const h = new Date().getHours();
      const pool = h >= 23 || h < 5 ? LINES.lateNight : LINES.random;
      say(pick(pool).replace('{name}', settings.userName || 'dost'));
    }
    scheduleChatter();
  }, rand(180, 420) * 1000);
}

api.getSettings().then((s) => {
  if (s && typeof s === 'object' && 'scale' in s) {
    settings = { ...settings, ...s };
    character.setOutfit(settings.outfit);
    applyVrm(settings.vrmPath || '');
  }
});

scheduleChatter();
requestAnimationFrame(frame);

// Exposed for debugging from DevTools
window.__k = { k, say, startAction, openChat, ringAlarm };
