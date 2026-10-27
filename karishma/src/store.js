// Persistent settings stored as JSON in the app's userData folder.
// API keys are encrypted with the macOS Keychain via Electron safeStorage.
const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  // Look
  scale: 0.8,
  outfit: 'teal', // teal | rose | violet | saffron | midnight
  vrmPath: '', // optional custom 3D .vrm model

  // Behaviour
  walkAround: true,
  sitOnWindows: true,
  followCursor: false,
  sleepWhenIdle: true,
  chatty: true, // random little comments
  showInDock: false,
  launchAtLogin: false,

  // Reminders
  alarms: [], // { id, time: "HH:MM", days: [0-6] (empty = every day), label, enabled }
  hydrationMinutes: 60, // 0 = off
  breakMinutes: 50, // 0 = off
  hourlyChime: false,

  // Brain (Claude API)
  model: 'claude-opus-5-5',
  userName: '',
  language: 'hinglish', // hinglish | hindi | english
  memories: [], // facts Karishma remembers about you

  // Voice
  voiceEnabled: true,
  voiceProvider: 'elevenlabs', // elevenlabs | system
  elevenVoiceId: '21m00Tcm4TlvDq8ikWAM',
  elevenModel: 'eleven_flash_v2_5',
  volume: 0.9,
};

const SECRET_KEYS = ['anthropicKey', 'elevenKey'];

class Store {
  constructor() {
    this.file = path.join(app.getPath('userData'), 'karishma-settings.json');
    this.data = { ...DEFAULTS };
    this.secrets = {};
    this.listeners = new Set();
    this.load();
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.data = { ...DEFAULTS, ...raw.settings };
      for (const k of SECRET_KEYS) {
        const enc = raw.secrets && raw.secrets[k];
        if (enc) this.secrets[k] = this.decrypt(enc);
      }
    } catch {
      // first run or unreadable file: keep defaults
    }
  }

  save() {
    const secrets = {};
    for (const k of SECRET_KEYS) {
      if (this.secrets[k]) secrets[k] = this.encrypt(this.secrets[k]);
    }
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify({ settings: this.data, secrets }, null, 2));
  }

  encrypt(text) {
    if (safeStorage.isEncryptionAvailable()) {
      return { enc: true, v: safeStorage.encryptString(text).toString('base64') };
    }
    return { enc: false, v: Buffer.from(text, 'utf8').toString('base64') };
  }

  decrypt(obj) {
    try {
      const buf = Buffer.from(obj.v, 'base64');
      return obj.enc ? safeStorage.decryptString(buf) : buf.toString('utf8');
    } catch {
      return '';
    }
  }

  get(key) {
    return this.data[key];
  }

  getSecret(key) {
    return this.secrets[key] || '';
  }

  hasSecret(key) {
    return Boolean(this.secrets[key]);
  }

  setSecret(key, value) {
    if (!SECRET_KEYS.includes(key)) return;
    if (value) this.secrets[key] = value;
    else delete this.secrets[key];
    this.save();
    this.emit();
  }

  set(patch) {
    for (const [k, v] of Object.entries(patch)) {
      if (k in DEFAULTS) this.data[k] = v;
    }
    this.save();
    this.emit();
  }

  all() {
    return {
      ...this.data,
      hasAnthropicKey: this.hasSecret('anthropicKey'),
      hasElevenKey: this.hasSecret('elevenKey'),
    };
  }

  onChange(fn) {
    this.listeners.add(fn);
  }

  emit() {
    for (const fn of this.listeners) fn(this.all());
  }
}

module.exports = { Store, DEFAULTS };
