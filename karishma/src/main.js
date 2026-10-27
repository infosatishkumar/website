const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  screen,
  globalShortcut,
  dialog,
  nativeImage,
  powerMonitor,
  Notification,
  shell,
} = require('electron');
const path = require('path');
const fs = require('fs');
const { Store } = require('./store');
const { Brain } = require('./brain');
const { WindowWatcher } = require('./windowWatcher');

app.setName('Karishma');

let store;
let overlay;
let settingsWin;
let tray;
let brain;
let watcher;
let display;
const reminders = []; // { id, at: epoch ms, label }
let lastHydration = Date.now();
let lastBreak = Date.now();
let lastAlarmKey = '';
let lastChimeHour = new Date().getHours();
let hidden = false;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

// ---------- Overlay window (transparent, click-through, covers the screen) ----------

function createOverlay() {
  display = screen.getPrimaryDisplay();
  const b = display.bounds;
  overlay = new BrowserWindow({
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    enableLargerThanScreen: true,
    backgroundColor: '#00000000',
    roundedCorners: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  overlay.setAlwaysOnTop(true, 'floating');
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  overlay.webContents.on('did-finish-load', () => {
    sendGeometry();
    send('settings', store.all());
    greet();
  });
}

function sendGeometry() {
  if (!overlay) return;
  const b = display.bounds;
  const w = display.workArea;
  send('geometry', {
    width: b.width,
    height: b.height,
    floor: w.y + w.height - b.y, // top of the Dock / bottom of usable area
    top: w.y - b.y, // below the menu bar
    left: w.x - b.x,
    right: w.x + w.width - b.x,
  });
}

function send(channel, payload) {
  if (overlay && !overlay.isDestroyed()) overlay.webContents.send(channel, payload);
}

function say(text, extra = {}) {
  send('say', { text, ...extra });
}

// ---------- Cursor + idle tracking ----------

function startTracking() {
  setInterval(() => {
    if (!overlay || hidden) return;
    const p = screen.getCursorScreenPoint();
    const b = display.bounds;
    send('cursor', { x: p.x - b.x, y: p.y - b.y });
  }, 33);

  setInterval(() => {
    send('idle', powerMonitor.getSystemIdleTime());
  }, 5000);
}

// ---------- Sitting on windows ----------

function setupWatcher() {
  watcher = new WindowWatcher({
    ownNames: ['Karishma', 'Electron'],
    onWindow: (win) => {
      if (!win) return send('platform', null);
      const b = display.bounds;
      const w = display.workArea;
      // Skip windows that are maximised/fullscreen or hug the menu bar: there's no edge to sit on.
      const coversScreen = win.width >= w.width - 10 && win.height >= w.height - 10;
      if (coversScreen || win.y < w.y + 30) return send('platform', null);
      send('platform', { x: win.x - b.x, y: win.y - b.y, width: win.width, app: win.app });
    },
    onPermissionError: () => {
      store.set({ sitOnWindows: false });
      say('Windows pe baithne ke liye mujhe Accessibility permission chahiye. System Settings > Privacy & Security > Accessibility mein Karishma ko allow karo, phir menu se "Sit on windows" on karo.', { duration: 14000 });
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
    },
  });
  if (store.get('sitOnWindows')) watcher.start();
}

// ---------- Alarms, reminders, wellbeing ----------

function addReminder(minutes, label) {
  reminders.push({ id: `r${Date.now()}${Math.random()}`, at: Date.now() + minutes * 60000, label });
}

function addAlarm(time, label) {
  const [h, m] = time.split(':');
  const alarms = store.get('alarms').slice();
  alarms.push({ id: `a${Date.now()}`, time: `${h.padStart(2, '0')}:${m}`, days: [], label: label || 'Alarm', enabled: true });
  store.set({ alarms });
}

function ring(label, kind) {
  send('alarm', { label, kind });
  if (Notification.isSupported()) {
    new Notification({ title: 'Karishma', body: label, silent: true }).show();
  }
}

function startScheduler() {
  setInterval(() => {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const key = `${now.toDateString()} ${hhmm}`;

    if (key !== lastAlarmKey) {
      for (const a of store.get('alarms')) {
        if (!a.enabled || a.time !== hhmm) continue;
        if (a.days && a.days.length && !a.days.includes(now.getDay())) continue;
        lastAlarmKey = key;
        ring(a.label || 'Alarm!', 'alarm');
      }
    }

    for (let i = reminders.length - 1; i >= 0; i--) {
      if (reminders[i].at <= Date.now()) {
        ring(reminders[i].label, 'reminder');
        reminders.splice(i, 1);
      }
    }

    const away = powerMonitor.getSystemIdleTime() > 300;
    if (away) {
      // Reset wellbeing timers while the user is away from the Mac.
      lastHydration = Date.now();
      lastBreak = Date.now();
    }
    const hyd = store.get('hydrationMinutes');
    if (hyd > 0 && Date.now() - lastHydration > hyd * 60000) {
      lastHydration = Date.now();
      send('wellbeing', 'water');
    }
    const brk = store.get('breakMinutes');
    if (brk > 0 && Date.now() - lastBreak > brk * 60000) {
      lastBreak = Date.now();
      send('wellbeing', 'break');
    }
    if (store.get('hourlyChime') && now.getMinutes() === 0 && now.getHours() !== lastChimeHour) {
      lastChimeHour = now.getHours();
      send('wellbeing', 'hour');
    }
  }, 10000);
}

function greet() {
  const h = new Date().getHours();
  const name = store.get('userName');
  const n = name ? ` ${name}` : '';
  let text;
  if (h < 5) text = `Itni raat ko jaag rahe ho${n}? Thoda so bhi lo na!`;
  else if (h < 12) text = `Good morning${n}! Aaj ka din mast jaayega ☀️`;
  else if (h < 17) text = `Hello${n}! Kaam kaisa chal raha hai?`;
  else if (h < 21) text = `Good evening${n}! Thak gaye kya?`;
  else text = `Hi${n}! Raat ho gayi, bas thoda aur kaam phir aaram.`;
  setTimeout(() => say(text, { action: 'wave' }), 1500);
}

// ---------- Voice (ElevenLabs) ----------

async function elevenTTS(text) {
  const key = store.getSecret('elevenKey');
  if (!key) return null;
  const voiceId = store.get('elevenVoiceId');
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: store.get('elevenModel'),
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true },
      }),
    },
  );
  if (!res.ok) throw new Error(`ElevenLabs error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer()).toString('base64');
}

async function elevenVoices() {
  const key = store.getSecret('elevenKey');
  if (!key) return { error: 'Pehle ElevenLabs API key save karo.' };
  const res = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } });
  if (!res.ok) return { error: `ElevenLabs error ${res.status}` };
  const data = await res.json();
  return {
    voices: (data.voices || []).map((v) => ({
      id: v.voice_id,
      name: v.name,
      info: [v.labels && v.labels.accent, v.labels && v.labels.gender, v.category].filter(Boolean).join(', '),
    })),
  };
}

// ---------- Tray + menus ----------

function trayIcon() {
  const img = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'trayTemplate.png'));
  img.setTemplateImage(true);
  return img;
}

function buildMenu() {
  const s = store.all();
  const toggle = (label, key, after) => ({
    label,
    type: 'checkbox',
    checked: Boolean(s[key]),
    click: (item) => {
      store.set({ [key]: item.checked });
      if (after) after(item.checked);
    },
  });
  return Menu.buildFromTemplate([
    { label: 'Karishma se baat karo…', accelerator: 'CmdOrCtrl+Shift+K', click: openChat },
    { label: hidden ? 'Karishma ko dikhao' : 'Karishma ko chhupao', accelerator: 'CmdOrCtrl+Shift+H', click: toggleHidden },
    { type: 'separator' },
    {
      label: 'Karishma, karo…',
      submenu: [
        ['Wave 👋', 'wave'],
        ['Dance 💃', 'dance'],
        ['Stretch 🙆', 'stretch'],
        ['So jao 😴', 'sleep'],
        ['Center mein aao', 'come'],
      ].map(([label, action]) => ({ label, click: () => send('action', action) })),
    },
    {
      label: 'Reminder lagao',
      submenu: [5, 10, 15, 25, 30, 60].map((m) => ({
        label: `${m} minute baad`,
        click: () => {
          addReminder(m, `${m} minute ho gaye! Yeh raha tumhara reminder ⏰`);
          say(`Theek hai, ${m} minute baad yaad dila doongi!`, { action: 'happy' });
        },
      })),
    },
    {
      label: 'Pomodoro (25 min focus)',
      click: () => {
        addReminder(25, 'Pomodoro done! 5 minute ka break lo 🍵');
        say('Focus mode on! 25 minute baad break ka time batati hoon.', { action: 'happy' });
      },
    },
    { type: 'separator' },
    {
      label: 'Size',
      submenu: [
        ['Chhoti', 0.55],
        ['Normal', 0.8],
        ['Badi', 1.1],
        ['Bahut badi', 1.5],
      ].map(([label, scale]) => ({
        label,
        type: 'radio',
        checked: Math.abs(s.scale - scale) < 0.01,
        click: () => store.set({ scale }),
      })),
    },
    {
      label: 'Outfit',
      submenu: ['teal', 'rose', 'violet', 'saffron', 'midnight'].map((o) => ({
        label: o[0].toUpperCase() + o.slice(1),
        type: 'radio',
        checked: s.outfit === o,
        click: () => store.set({ outfit: o }),
      })),
    },
    toggle('Ghoomti rahe (walk around)', 'walkAround'),
    toggle('Windows pe baithe', 'sitOnWindows', (on) => (on ? watcher.start() : watcher.stop())),
    toggle('Cursor ka peecha kare', 'followCursor'),
    toggle('Idle hone pe so jaaye', 'sleepWhenIdle'),
    toggle('Khud se baatein kare', 'chatty'),
    toggle('Awaaz (voice)', 'voiceEnabled'),
    { type: 'separator' },
    { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: openSettings },
    { label: 'Quit Karishma', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
  ]);
}

function refreshTray() {
  if (tray) tray.setContextMenu(buildMenu());
}

function openChat() {
  if (hidden) toggleHidden();
  send('open-chat');
}

function toggleHidden() {
  hidden = !hidden;
  if (hidden) overlay.hide();
  else overlay.showInactive();
  refreshTray();
}

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 560,
    height: 720,
    title: 'Karishma Settings',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#fff7fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWin.loadFile(path.join(__dirname, 'settings', 'settings.html'));
  settingsWin.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  if (app.dock) app.dock.show();
  settingsWin.on('closed', () => {
    settingsWin = null;
    if (app.dock && !store.get('showInDock')) app.dock.hide();
  });
}

// ---------- IPC ----------

function setupIpc() {
  ipcMain.on('set-ignore', (_e, ignore) => {
    if (overlay) overlay.setIgnoreMouseEvents(ignore, { forward: true });
  });

  ipcMain.on('focus-overlay', (_e, focus) => {
    if (!overlay) return;
    if (focus) {
      overlay.setIgnoreMouseEvents(false);
      app.focus({ steal: true });
      overlay.focus();
    } else {
      overlay.blur();
    }
  });

  ipcMain.on('context-menu', () => {
    buildMenu().popup({ window: overlay });
  });

  ipcMain.handle('chat', async (_e, text) => brain.chat(String(text).slice(0, 2000)));

  ipcMain.handle('tts', async (_e, text) => {
    if (!store.get('voiceEnabled')) return { off: true };
    if (store.get('voiceProvider') !== 'elevenlabs' || !store.hasSecret('elevenKey')) return { fallback: true };
    try {
      return { audio: await elevenTTS(String(text).slice(0, 1000)) };
    } catch (err) {
      console.error(err);
      return { fallback: true, error: String(err.message) };
    }
  });

  ipcMain.handle('eleven-voices', () => elevenVoices());

  ipcMain.handle('get-settings', () => store.all());

  ipcMain.handle('set-settings', (_e, patch) => {
    store.set(patch);
    return store.all();
  });

  ipcMain.handle('set-secret', (_e, { key, value }) => {
    store.setSecret(key, value);
    if (key === 'anthropicKey') brain.reset();
    return store.all();
  });

  ipcMain.handle('pick-vrm', async () => {
    const res = await dialog.showOpenDialog(settingsWin || undefined, {
      title: 'Choose a VRM model',
      filters: [{ name: 'VRM model', extensions: ['vrm'] }],
      properties: ['openFile'],
    });
    if (res.canceled || !res.filePaths[0]) return store.all();
    store.set({ vrmPath: res.filePaths[0] });
    return store.all();
  });

  ipcMain.handle('read-vrm', async () => {
    const p = store.get('vrmPath');
    if (!p || !fs.existsSync(p)) return null;
    return fs.promises.readFile(p);
  });

  ipcMain.handle('alarm-snooze', (_e, label) => {
    addReminder(5, label);
  });

  ipcMain.handle('reset-chat', () => brain.reset());

  ipcMain.on('test-say', (_e, text) => say(text, { action: 'happy' }));
  ipcMain.on('open-settings', openSettings);
}

// ---------- App lifecycle ----------

app.whenReady().then(() => {
  store = new Store();
  if (app.dock && !store.get('showInDock')) app.dock.hide();

  brain = new Brain({
    store,
    handlers: {
      setAlarm: addAlarm,
      setReminder: addReminder,
      doAction: (a) => send('action', a),
      remember: (fact) => {
        const memories = store.get('memories').concat(fact).slice(-50);
        store.set({ memories });
      },
    },
  });

  createOverlay();
  setupIpc();
  startTracking();
  startScheduler();
  setupWatcher();

  tray = new Tray(trayIcon());
  tray.setToolTip('Karishma');
  refreshTray();

  store.onChange((s) => {
    send('settings', s);
    if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('settings', s);
    refreshTray();
    app.setLoginItemSettings({ openAtLogin: Boolean(s.launchAtLogin) });
    if (app.dock && !settingsWin) {
      if (s.showInDock) app.dock.show();
      else app.dock.hide();
    }
  });

  globalShortcut.register('CommandOrControl+Shift+K', openChat);
  globalShortcut.register('CommandOrControl+Shift+H', toggleHidden);

  const onDisplayChange = () => {
    display = screen.getPrimaryDisplay();
    overlay.setBounds(display.bounds);
    sendGeometry();
  };
  screen.on('display-metrics-changed', onDisplayChange);
  screen.on('display-added', onDisplayChange);
  screen.on('display-removed', onDisplayChange);

  powerMonitor.on('resume', () => say('Wapas aa gaye! Miss kiya tumhe 💕', { action: 'happy' }));
});

app.on('second-instance', openChat);
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', (e) => e.preventDefault());
