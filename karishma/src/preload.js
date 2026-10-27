const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (fn) => {
  const handler = (_e, payload) => fn(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld('karishma', {
  // overlay
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore', ignore),
  focusOverlay: (focus) => ipcRenderer.send('focus-overlay', focus),
  contextMenu: () => ipcRenderer.send('context-menu'),
  chat: (text) => ipcRenderer.invoke('chat', text),
  tts: (text) => ipcRenderer.invoke('tts', text),
  readVrm: () => ipcRenderer.invoke('read-vrm'),
  snooze: (label) => ipcRenderer.invoke('alarm-snooze', label),
  openSettings: () => ipcRenderer.send('open-settings'),
  onGeometry: on('geometry'),
  onCursor: on('cursor'),
  onIdle: on('idle'),
  onPlatform: on('platform'),
  onSay: on('say'),
  onAction: on('action'),
  onAlarm: on('alarm'),
  onWellbeing: on('wellbeing'),
  onOpenChat: on('open-chat'),

  // settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (patch) => ipcRenderer.invoke('set-settings', patch),
  setSecret: (key, value) => ipcRenderer.invoke('set-secret', { key, value }),
  pickVrm: () => ipcRenderer.invoke('pick-vrm'),
  elevenVoices: () => ipcRenderer.invoke('eleven-voices'),
  resetChat: () => ipcRenderer.invoke('reset-chat'),
  testSay: (text) => ipcRenderer.send('test-say', text),
  onSettings: on('settings'),
});
