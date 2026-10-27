const api = window.karishma;
const DAYS = ['Ravi', 'Som', 'Mangal', 'Budh', 'Guru', 'Shukra', 'Shani'];
let settings = {};

function render(s) {
  settings = s;
  for (const el of document.querySelectorAll('[data-setting]')) {
    const key = el.dataset.setting;
    if (document.activeElement === el) continue;
    if (el.type === 'checkbox') el.checked = Boolean(s[key]);
    else el.value = s[key] ?? '';
  }
  document.getElementById('anthropicKeyStatus').textContent = s.hasAnthropicKey ? '✅ Key saved — Karishma ka brain on hai' : '⚠️ Key nahi hai — Karishma sirf basic baatein karegi';
  document.getElementById('elevenKeyStatus').textContent = s.hasElevenKey ? '✅ Key saved' : 'Key nahi hai — Mac system voice use hogi';
  document.getElementById('vrmPath').textContent = s.vrmPath || 'Built-in 2D Karishma';

  const mem = document.getElementById('memories');
  mem.innerHTML = '';
  if (!s.memories.length) mem.innerHTML = '<li class="empty">Abhi kuch yaad nahi — baat karo, seekh jaayegi!</li>';
  s.memories.forEach((m, i) => {
    const li = document.createElement('li');
    li.innerHTML = '<span class="grow"></span><button class="ghost">✕</button>';
    li.querySelector('.grow').textContent = m;
    li.querySelector('button').onclick = () => api.setSettings({ memories: s.memories.filter((_, j) => j !== i) });
    mem.appendChild(li);
  });

  const list = document.getElementById('alarms');
  list.innerHTML = '';
  if (!s.alarms.length) list.innerHTML = '<li class="empty">Koi alarm nahi</li>';
  s.alarms.forEach((a) => {
    const li = document.createElement('li');
    li.innerHTML = '<input type="checkbox" /><span class="grow"></span><button class="ghost">✕</button>';
    const days = a.days && a.days.length ? a.days.map((d) => DAYS[d]).join(', ') : 'Roz';
    li.querySelector('.grow').textContent = `${a.time} · ${a.label} · ${days}`;
    const cb = li.querySelector('input');
    cb.checked = a.enabled;
    cb.onchange = () => api.setSettings({ alarms: s.alarms.map((x) => (x.id === a.id ? { ...x, enabled: cb.checked } : x)) });
    li.querySelector('button').onclick = () => api.setSettings({ alarms: s.alarms.filter((x) => x.id !== a.id) });
    list.appendChild(li);
  });
}

for (const el of document.querySelectorAll('[data-setting]')) {
  el.addEventListener('change', () => {
    const key = el.dataset.setting;
    let value = el.value;
    if (el.type === 'checkbox') value = el.checked;
    else if (el.type === 'range' || el.type === 'number') value = Number(el.value);
    api.setSettings({ [key]: value });
  });
}

for (const btn of document.querySelectorAll('[data-save-secret]')) {
  btn.addEventListener('click', async () => {
    const key = btn.dataset.saveSecret;
    const input = document.getElementById(key);
    await api.setSecret(key, input.value.trim());
    input.value = '';
    if (key === 'anthropicKey') api.testSay('Brain connect ho gaya! Ab mujhse kuch bhi poochho 🧠✨');
  });
}

const dayBox = document.getElementById('alarmDays');
DAYS.forEach((d, i) => {
  const l = document.createElement('label');
  l.innerHTML = `<input type="checkbox" value="${i}" /> ${d}`;
  dayBox.appendChild(l);
});

document.getElementById('addAlarm').onclick = () => {
  const time = document.getElementById('alarmTime').value;
  if (!time) return;
  const label = document.getElementById('alarmLabel').value.trim() || 'Alarm!';
  const days = [...dayBox.querySelectorAll('input:checked')].map((c) => Number(c.value));
  api.setSettings({ alarms: settings.alarms.concat({ id: `a${Date.now()}`, time, label, days, enabled: true }) });
  document.getElementById('alarmLabel').value = '';
};

document.getElementById('loadVoices').onclick = async () => {
  const sel = document.getElementById('voiceSelect');
  sel.innerHTML = '<option>Loading…</option>';
  const res = await api.elevenVoices();
  sel.innerHTML = '';
  if (res.error) {
    sel.innerHTML = `<option>${res.error}</option>`;
    return;
  }
  for (const v of res.voices) {
    const o = document.createElement('option');
    o.value = v.id;
    o.textContent = v.info ? `${v.name} (${v.info})` : v.name;
    if (v.id === settings.elevenVoiceId) o.selected = true;
    sel.appendChild(o);
  }
};

document.getElementById('voiceSelect').onchange = (e) => {
  if (e.target.value) api.setSettings({ elevenVoiceId: e.target.value });
};

document.getElementById('testVoice').onclick = () => {
  const name = settings.userName ? ` ${settings.userName}` : '';
  api.testSay(`Hello${name}! Main Karishma hoon. Meri awaaz kaisi lagi?`);
};

document.getElementById('pickVrm').onclick = () => api.pickVrm();
document.getElementById('clearVrm').onclick = () => api.setSettings({ vrmPath: '' });
document.getElementById('resetChat').onclick = async () => {
  await api.resetChat();
  api.testSay('Chalo, nayi shuruaat! 😊');
};

api.onSettings(render);
api.getSettings().then(render);
