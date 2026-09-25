/* UI for the Mac AI agent. Python calls window.ui.* ; we call window.pywebview.api.* */
(function () {
  const $ = (id) => document.getElementById(id);
  const log = $("log");
  let settings = {};
  let state = "sleeping";

  const STATUS = {
    sleeping: () => `“${settings.wake_word || "Karishma"}” boliye`,
    listening: () => "Sun rahi hoon…",
    thinking: () => "Soch rahi hoon…",
    working: () => "Kaam kar rahi hoon…",
    speaking: () => "Bol rahi hoon…",
    idle: () => "Mic band hai",
    error: () => "Kuch problem hai",
  };
  const SPEED = { sleeping: 0.35, idle: 0.2, listening: 1, thinking: 1.9, working: 1.9, speaking: 1.4, error: 0.6 };

  // ---- Lottie orb animation ----
  const anim = window.lottie
    ? lottie.loadAnimation({
        container: $("lottie"),
        renderer: "svg",
        loop: true,
        autoplay: true,
        path: "animation.json",
        rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
      })
    : null;

  // ---- backend (pywebview) with a stub so the page also opens in a normal browser ----
  function api() {
    if (window.pywebview && window.pywebview.api) return window.pywebview.api;
    return {
      send_text: (t) => setTimeout(() => ui.addMessage("agent", `(preview) aapne kaha: ${t}`), 300),
      wake: () => ui.setState("listening"),
      stop: () => ui.setState("sleeping"),
      toggle_mic: () => Promise.resolve(true),
      get_settings: () => Promise.resolve(settings),
      save_settings: (d) => Promise.resolve(Object.assign(settings, d)),
      test_voice() {}, open_workspace() {}, clear_chat() {}, minimize() {}, quit() {},
    };
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function renderText(text) {
    // Light formatting: **bold**, links, file paths stay readable.
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1" target="_blank">$1</a>');
  }

  window.ui = {
    setState(newState, detail) {
      state = newState;
      document.body.className = `state-${newState}`;
      $("status").textContent = (STATUS[newState] || (() => newState))();
      $("detail").textContent = detail || "";
      if (anim) anim.setSpeed(SPEED[newState] ?? 1);
    },
    addMessage(role, text) {
      if (!text) return;
      const el = document.createElement("div");
      el.className = `msg ${role}`;
      el.innerHTML = renderText(text);
      log.appendChild(el);
      while (log.children.length > 120) log.removeChild(log.firstChild);
      log.scrollTop = log.scrollHeight;
    },
    setSettings(data) {
      settings = Object.assign(settings, data);
      $("agent-name").textContent = settings.agent_name || "Agent";
      document.title = settings.agent_name || "AI Agent";
      $("btn-mic").classList.toggle("off", settings.mic_enabled === false);
      $("status").textContent = (STATUS[state] || (() => state))();
      if (!settings.has_api_key && !ui._askedKey) {
        ui._askedKey = true;
        ui.addMessage("system", "Pehle ⚙︎ Settings me apni Claude API key daaliye.");
      }
    },
  };

  // ---- controls ----
  $("orb").addEventListener("click", () => {
    if (state === "speaking" || state === "thinking" || state === "working") api().stop();
    else api().wake();
  });

  $("composer").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("input").value.trim();
    if (!text) return;
    $("input").value = "";
    api().send_text(text);
  });

  $("btn-stop").addEventListener("click", () => api().stop());
  $("btn-mic").addEventListener("click", async () => {
    const enabled = await api().toggle_mic();
    $("btn-mic").classList.toggle("off", !enabled);
  });
  $("btn-min").addEventListener("click", () => api().minimize());
  $("btn-close").addEventListener("click", () => api().quit());

  // ---- settings sheet ----
  const FIELDS = ["agent_name", "wake_word", "user_name", "voice", "speech_rate", "stt_language",
                  "conversation_timeout", "model", "effort"];

  async function openSettings() {
    const data = await api().get_settings();
    Object.assign(settings, data);
    const voiceSel = $("s-voice");
    voiceSel.innerHTML = '<option value="">Auto (Indian voice)</option>';
    (data.voices || []).forEach((v) => {
      const [name, locale] = v.split("|");
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = `${name} — ${locale}`;
      voiceSel.appendChild(opt);
    });
    FIELDS.forEach((f) => { if ($(`s-${f}`)) $(`s-${f}`).value = data[f] ?? ""; });
    $("s-speak_replies").checked = data.speak_replies !== false;
    $("s-api_key").value = "";
    $("key-hint").textContent = data.has_api_key ? `(saved ${data.api_key_hint})` : "(zaroori)";
    $("settings").classList.remove("hidden");
  }

  async function saveSettings() {
    const data = {};
    FIELDS.forEach((f) => { data[f] = $(`s-${f}`).value; });
    data.speak_replies = $("s-speak_replies").checked;
    const key = $("s-api_key").value.trim();
    if (key) data.api_key = key;
    const saved = await api().save_settings(data);
    ui.setSettings(saved);
    $("settings").classList.add("hidden");
    ui.addMessage("system", "Settings save ho gayi ✓");
  }

  $("btn-settings").addEventListener("click", openSettings);
  $("btn-save").addEventListener("click", saveSettings);
  $("btn-cancel").addEventListener("click", () => $("settings").classList.add("hidden"));
  $("btn-test-voice").addEventListener("click", async () => {
    await api().save_settings({ voice: $("s-voice").value, speech_rate: $("s-speech_rate").value });
    api().test_voice();
  });
  $("btn-workspace").addEventListener("click", () => api().open_workspace());
  $("btn-clear").addEventListener("click", () => {
    api().clear_chat();
    log.innerHTML = "";
    $("settings").classList.add("hidden");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") $("settings").classList.add("hidden");
  });

  ui.setState("sleeping");
})();
