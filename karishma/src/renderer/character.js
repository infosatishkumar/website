// Karishma's built-in 2D body: a layered SVG rig posed every frame by app.js.
// viewBox is 200x300; the feet rest at (100, 296).

const OUTFITS = {
  teal: { main: '#1fa39a', dark: '#137067', sash: '#ff6f91', trim: '#f6c453' },
  rose: { main: '#e8557a', dark: '#b2365a', sash: '#ffd166', trim: '#f6c453' },
  violet: { main: '#7b5cd6', dark: '#5638a8', sash: '#ff9ecf', trim: '#f6c453' },
  saffron: { main: '#f39a2e', dark: '#c46f12', sash: '#2bb3a3', trim: '#fff1b8' },
  midnight: { main: '#2d3a6b', dark: '#1a234a', sash: '#e0a3ff', trim: '#f6c453' },
};

const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300" class="k-svg">
  <defs>
    <radialGradient id="kIris" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#d98a3d"/>
      <stop offset="55%" stop-color="#8a4318"/>
      <stop offset="100%" stop-color="#3d1708"/>
    </radialGradient>
    <linearGradient id="kHair" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3a2340"/>
      <stop offset="100%" stop-color="#1c1222"/>
    </linearGradient>
    <linearGradient id="kSkinShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f7d4bd"/>
      <stop offset="100%" stop-color="#efc0a2"/>
    </linearGradient>
    <clipPath id="kClipL"><ellipse cx="0" cy="0" rx="11" ry="13"/></clipPath>
    <clipPath id="kClipR"><ellipse cx="0" cy="0" rx="11" ry="13"/></clipPath>
  </defs>
  <ellipse class="k-shadow" cx="100" cy="296" rx="38" ry="5" fill="rgba(0,0,0,0.18)"/>
  <g id="kRig">
    <g id="kHeadBack">
      <g id="kTail">
        <path fill="url(#kHair)" d="M50 96 Q38 170 52 238 Q76 252 100 246 Q124 252 148 238 Q162 170 150 96 Z"/>
        <path fill="none" stroke="#e86aa0" stroke-width="3" opacity=".55" d="M140 110 Q152 170 142 236"/>
      </g>
    </g>
    <g id="kLegL">
      <rect x="84" y="222" width="14" height="62" rx="7" class="k-legging"/>
      <path class="k-shoe" d="M80 286 Q82 278 92 278 Q100 279 100 287 Q92 292 80 290 Z"/>
    </g>
    <g id="kLegR">
      <rect x="102" y="222" width="14" height="62" rx="7" class="k-legging"/>
      <path class="k-shoe" d="M120 286 Q118 278 108 278 Q100 279 100 287 Q108 292 120 290 Z"/>
    </g>
    <g id="kTorso">
      <rect x="93" y="138" width="14" height="22" fill="#efc0a2"/>
      <path class="k-main" d="M72 160 Q100 150 128 160 L133 200 Q140 222 148 240 Q100 248 52 240 Q60 222 67 200 Z"/>
      <path class="k-trim" d="M52 240 Q100 248 148 240 L147 233 Q100 241 53 233 Z"/>
      <path class="k-trim-stroke" fill="none" stroke-width="2.5" d="M88 156 L100 176 L112 156"/>
      <circle class="k-trim" cx="100" cy="190" r="2"/>
      <circle class="k-trim" cx="100" cy="200" r="2"/>
      <circle class="k-trim" cx="100" cy="210" r="2"/>
      <path class="k-sash" opacity=".92" d="M74 160 Q86 156 92 162 Q112 196 136 214 L130 226 Q104 206 74 172 Z"/>
      <path class="k-sash" opacity=".8" d="M130 214 Q140 222 138 244 L130 246 Q131 230 124 222 Z"/>
    </g>
    <g id="kHead">
      <ellipse cx="49" cy="108" rx="7" ry="10" fill="#efc0a2"/>
      <ellipse cx="151" cy="108" rx="7" ry="10" fill="#efc0a2"/>
      <g class="k-jhumka">
        <circle cx="48" cy="118" r="2.4"/>
        <path d="M42 130 Q48 118 54 130 Z"/>
        <circle cx="44" cy="132" r="1.3"/><circle cx="48" cy="133" r="1.3"/><circle cx="52" cy="132" r="1.3"/>
      </g>
      <g class="k-jhumka">
        <circle cx="152" cy="118" r="2.4"/>
        <path d="M146 130 Q152 118 158 130 Z"/>
        <circle cx="148" cy="132" r="1.3"/><circle cx="152" cy="133" r="1.3"/><circle cx="156" cy="132" r="1.3"/>
      </g>
      <path fill="url(#kSkinShade)" d="M49 95 Q49 140 100 151 Q151 140 151 95 Q151 50 100 50 Q49 50 49 95 Z"/>
      <ellipse id="kBlushL" cx="72" cy="126" rx="9" ry="5" fill="#ff7f9a" opacity=".25"/>
      <ellipse id="kBlushR" cx="128" cy="126" rx="9" ry="5" fill="#ff7f9a" opacity=".25"/>
      <g id="kBrows" stroke="#3a2340" stroke-width="2.6" stroke-linecap="round" fill="none">
        <path id="kBrowL" d="M68 89 Q78 84 88 88"/>
        <path id="kBrowR" d="M112 88 Q122 84 132 89"/>
      </g>
      <circle cx="100" cy="88" r="2.4" fill="#e0245e"/>
      <g id="kEyesOpen">
        <g transform="translate(78 110)">
          <g id="kEyeL">
            <ellipse rx="11" ry="13" fill="#fff"/>
            <g clip-path="url(#kClipL)">
              <g id="kIrisL">
                <ellipse rx="8.5" ry="10.5" fill="url(#kIris)"/>
                <ellipse id="kPupilL" rx="4" ry="5.5" fill="#2a1208"/>
                <circle cx="-3" cy="-4.5" r="3" fill="#fff"/>
                <circle cx="3" cy="3.5" r="1.4" fill="#fff" opacity=".9"/>
              </g>
            </g>
            <path d="M-13 -8 Q0 -18 13 -9 L15 -12" stroke="#2b1d2e" stroke-width="3.6" fill="none" stroke-linecap="round"/>
          </g>
        </g>
        <g transform="translate(122 110)">
          <g id="kEyeR">
            <ellipse rx="11" ry="13" fill="#fff"/>
            <g clip-path="url(#kClipR)">
              <g id="kIrisR">
                <ellipse rx="8.5" ry="10.5" fill="url(#kIris)"/>
                <ellipse id="kPupilR" rx="4" ry="5.5" fill="#2a1208"/>
                <circle cx="-3" cy="-4.5" r="3" fill="#fff"/>
                <circle cx="3" cy="3.5" r="1.4" fill="#fff" opacity=".9"/>
              </g>
            </g>
            <path d="M13 -8 Q0 -18 -13 -9 L-15 -12" stroke="#2b1d2e" stroke-width="3.6" fill="none" stroke-linecap="round"/>
          </g>
        </g>
      </g>
      <g id="kEyesHappy" stroke="#2b1d2e" stroke-width="3.4" fill="none" stroke-linecap="round" style="display:none">
        <path d="M68 113 Q78 101 88 113"/>
        <path d="M112 113 Q122 101 132 113"/>
      </g>
      <g id="kEyesClosed" stroke="#2b1d2e" stroke-width="3" fill="none" stroke-linecap="round" style="display:none">
        <path d="M68 110 Q78 118 88 110"/>
        <path d="M112 110 Q122 118 132 110"/>
      </g>
      <path d="M99 122 q1.5 2 3 0" stroke="#d99a7f" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <g id="kMouths" stroke-linecap="round" stroke-linejoin="round">
        <path data-m="smile" d="M92 133 Q100 140 108 133" stroke="#9c3a46" stroke-width="2.4" fill="none"/>
        <g data-m="open">
          <path id="kMouthOpen" d="M91 132 Q100 131 109 132 Q107 143 100 144 Q93 143 91 132 Z" fill="#b8364d"/>
          <ellipse cx="100" cy="140" rx="4.5" ry="2.4" fill="#ff8fa3"/>
        </g>
        <ellipse data-m="o" cx="100" cy="136" rx="4" ry="5" fill="#b8364d"/>
        <path data-m="cat" d="M90 133 Q95 138 100 133 Q105 138 110 133" stroke="#9c3a46" stroke-width="2.4" fill="none"/>
        <path data-m="sad" d="M93 138 Q100 132 107 138" stroke="#9c3a46" stroke-width="2.4" fill="none"/>
        <path data-m="flat" d="M94 135 L106 135" stroke="#9c3a46" stroke-width="2.4" fill="none"/>
      </g>
      <path fill="url(#kHair)" d="M47 104 Q42 56 100 44 Q158 56 153 104 L150 90 Q146 74 136 66 Q140 82 132 92 Q128 74 116 64 Q118 80 108 86 Q104 70 100 62 Q94 74 84 86 Q84 76 80 66 Q70 80 68 92 Q62 78 64 66 Q52 78 50 92 Z"/>
      <path fill="url(#kHair)" d="M50 84 Q40 120 46 156 Q52 160 56 154 Q52 124 58 92 Z"/>
      <path fill="url(#kHair)" d="M150 84 Q160 120 154 156 Q148 160 144 154 Q148 124 142 92 Z"/>
      <path d="M116 64 Q124 72 124 84" stroke="#e86aa0" stroke-width="3" fill="none" opacity=".7" stroke-linecap="round"/>
      <g transform="translate(138 60)">
        <g class="k-flower">
          <circle cx="0" cy="-6" r="5"/><circle cx="6" cy="-2" r="5"/><circle cx="4" cy="5" r="5"/>
          <circle cx="-4" cy="5" r="5"/><circle cx="-6" cy="-2" r="5"/>
        </g>
        <circle r="3.4" fill="#f6c453"/>
      </g>
    </g>
    <g id="kArmL">
      <rect x="69" y="158" width="14" height="46" rx="7" class="k-dark"/>
      <path class="k-trim" d="M69 196 h14 v5 h-14z"/>
      <circle cx="76" cy="208" r="7.5" fill="#f2c7aa"/>
      <path d="M71 206 q5 6 10 0" stroke="#f6c453" stroke-width="1.6" fill="none"/>
    </g>
    <g id="kArmR">
      <rect x="117" y="158" width="14" height="46" rx="7" class="k-dark"/>
      <path class="k-trim" d="M117 196 h14 v5 h-14z"/>
      <circle cx="124" cy="208" r="7.5" fill="#f2c7aa"/>
      <path d="M119 206 q5 6 10 0" stroke="#f6c453" stroke-width="1.6" fill="none"/>
    </g>
  </g>
</svg>`;

export class SvgCharacter {
  constructor(container) {
    container.innerHTML = SVG;
    this.svg = container.querySelector('svg');
    const $ = (id) => this.svg.getElementById(id);
    this.parts = {
      rig: $('kRig'),
      head: $('kHead'),
      headBack: $('kHeadBack'),
      tail: $('kTail'),
      torso: $('kTorso'),
      armL: $('kArmL'),
      armR: $('kArmR'),
      legL: $('kLegL'),
      legR: $('kLegR'),
      eyesOpen: $('kEyesOpen'),
      eyesHappy: $('kEyesHappy'),
      eyesClosed: $('kEyesClosed'),
      eyeL: $('kEyeL'),
      eyeR: $('kEyeR'),
      irisL: $('kIrisL'),
      irisR: $('kIrisR'),
      pupilL: $('kPupilL'),
      pupilR: $('kPupilR'),
      blushL: $('kBlushL'),
      blushR: $('kBlushR'),
      browL: $('kBrowL'),
      browR: $('kBrowR'),
      mouthOpen: $('kMouthOpen'),
    };
    this.mouths = {};
    for (const el of this.svg.querySelectorAll('[data-m]')) this.mouths[el.dataset.m] = el;
    this.shadow = this.svg.querySelector('.k-shadow');
    this.lastMouth = null;
    this.lastEyes = null;
  }

  setOutfit(name) {
    const o = OUTFITS[name] || OUTFITS.teal;
    const s = this.svg.style;
    s.setProperty('--k-main', o.main);
    s.setProperty('--k-dark', o.dark);
    s.setProperty('--k-sash', o.sash);
    s.setProperty('--k-trim', o.trim);
  }

  // Head and body hit areas in the 200x300 design space.
  hitAreas() {
    return { head: { cx: 100, cy: 100, r: 56 }, body: { x: 52, y: 150, w: 96, h: 146 } };
  }

  apply(p) {
    const P = this.parts;
    const f = p.facing < 0 ? -1 : 1;
    P.rig.setAttribute(
      'transform',
      `translate(100 296) rotate(${p.lean}) scale(${f * p.squashX} ${p.squashY}) translate(-100 ${-296 + p.bob})`,
    );
    const head = `translate(${p.headX} ${p.headY}) rotate(${p.headTilt} 100 145)`;
    P.head.setAttribute('transform', head);
    P.headBack.setAttribute('transform', head);
    P.tail.setAttribute('transform', `rotate(${p.tail} 100 90)`);
    P.torso.setAttribute('transform', `rotate(${p.torsoTilt} 100 240)`);
    P.armL.setAttribute('transform', `rotate(${8 + p.armL} 76 163)`);
    P.armR.setAttribute('transform', `rotate(${-8 - p.armR} 124 163)`);
    const legScale = p.sitting ? 0.72 : 1;
    P.legL.setAttribute('transform', `rotate(${p.legL} 91 226) translate(0 ${226 * (1 - legScale)}) scale(1 ${legScale})`);
    P.legR.setAttribute('transform', `rotate(${p.legR} 109 226) translate(0 ${226 * (1 - legScale)}) scale(1 ${legScale})`);
    this.shadow.style.display = p.grounded && !p.sitting ? '' : 'none';

    // Eyes
    if (p.eyes !== this.lastEyes) {
      P.eyesOpen.style.display = p.eyes === 'open' || p.eyes === 'surprised' ? '' : 'none';
      P.eyesHappy.style.display = p.eyes === 'happy' ? '' : 'none';
      P.eyesClosed.style.display = p.eyes === 'closed' ? '' : 'none';
      const pr = p.eyes === 'surprised' ? 'scale(0.6)' : '';
      P.pupilL.setAttribute('transform', pr);
      P.pupilR.setAttribute('transform', pr);
      this.lastEyes = p.eyes;
    }
    const lx = Math.max(-1, Math.min(1, p.lookX)) * 3.6 * f;
    const ly = Math.max(-1, Math.min(1, p.lookY)) * 3;
    P.irisL.setAttribute('transform', `translate(${lx} ${ly})`);
    P.irisR.setAttribute('transform', `translate(${lx} ${ly})`);
    const open = Math.max(0.08, 1 - p.blink);
    P.eyeL.setAttribute('transform', `scale(1 ${open})`);
    P.eyeR.setAttribute('transform', `scale(1 ${open})`);

    // Brows lift when surprised, droop when sad
    const by = p.eyes === 'surprised' ? -4 : p.mouth === 'sad' ? 2 : 0;
    const bt = p.mouth === 'sad' ? 8 : 0;
    P.browL.setAttribute('transform', `translate(0 ${by}) rotate(${-bt} 78 88)`);
    P.browR.setAttribute('transform', `translate(0 ${by}) rotate(${bt} 122 88)`);

    // Mouth: talking forces the open mouth scaled by amplitude
    const mouth = p.talk > 0.05 ? 'open' : p.mouth;
    if (mouth !== this.lastMouth) {
      for (const [k, el] of Object.entries(this.mouths)) el.style.display = k === mouth ? '' : 'none';
      this.lastMouth = mouth;
    }
    if (mouth === 'open') {
      const a = p.talk > 0.05 ? 0.35 + p.talk * 0.75 : 1;
      P.mouthOpen.parentNode.setAttribute('transform', `translate(0 132) scale(1 ${a}) translate(0 -132)`);
    }

    P.blushL.setAttribute('opacity', 0.22 + p.blush * 0.6);
    P.blushR.setAttribute('opacity', 0.22 + p.blush * 0.6);
  }
}

export { OUTFITS };
