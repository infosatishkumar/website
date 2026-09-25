/* Floating desktop widget. Python calls window.ui.* ; we call window.pywebview.api.* */
(function () {
  const $ = (id) => document.getElementById(id);
  const caption = $("caption");
  const menu = $("menu");
  let settings = {};
  let state = "sleeping";
  let hideTimer = null;

  const SPEED = { sleeping: 0.4, idle: 0.2, listening: 1, thinking: 1.9, working: 1.9, speaking: 1.4, error: 0.6 };
  const STATUS = {
    listening: "Boliye, sun rahi hoon…",
    thinking: "Soch rahi hoon…",
    working: "Kaam kar rahi hoon…",
  };

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

  // pywebview backend, with a stub so the page can be previewed in a normal browser.
  function api() {
    if (window.pywebview && window.pywebview.api) return window.pywebview.api;
    return {
      send_text: (t) => setTimeout(() => ui.addMessage("agent", `(preview) ${t}`), 300),
      wake: () => ui.setState("listening"),
      stop: () => ui.setState("sleeping"),
      toggle_mic: () => Promise.resolve(true),
      open_settings() {}, open_workspace() {}, minimize() {}, quit() {},
    };
  }

  // ---- caption pill: shown only while something is happening ----
  function showCaption(text, kind, holdMs) {
    clearTimeout(hideTimer);
    caption.className = `caption ${kind || ""}`;
    caption.textContent = text;
    if (holdMs) hideTimer = setTimeout(hideCaption, holdMs);
  }
  function hideCaption() {
    caption.classList.add("hidden");
  }

  window.ui = {
    setState(newState, detail) {
      state = newState;
      document.body.className = `state-${newState}`;
      if (anim) anim.setSpeed(SPEED[newState] ?? 1);
      if (newState === "error") showCaption(detail || "Kuch problem hai", "tool");
      else if (newState === "working" && detail) showCaption(`⚡ ${detail}`, "tool");
      else if (STATUS[newState] && !(newState === "listening" && caption.classList.contains("agent")
                                     && !caption.classList.contains("hidden"))) {
        showCaption(STATUS[newState], "tool");
      } else if (newState === "sleeping" || newState === "idle") {
        hideTimer = setTimeout(hideCaption, 4000);
      }
    },
    addMessage(role, text) {
      if (!text) return;
      if (role === "user") showCaption(`“${text}”`, "user");
      else if (role === "tool") showCaption(`⚡ ${text}`, "tool");
      else if (role === "system") showCaption(text, "tool", 6000);
      else showCaption(text, "agent", state === "sleeping" ? 8000 : 0);
    },
    heard(text, wakeWord) {
      if (state !== "sleeping") return;
      showCaption(`Suna: “${text}”\n(“${wakeWord}” bolkar shuru karein)`, "user", 3500);
    },
    setSettings(data) {
      settings = Object.assign(settings, data);
      document.title = settings.agent_name || "AI Agent";
      $("menu-mic").textContent = settings.mic_enabled === false ? "🎙  Mic chalu karein" : "🔇  Mic band karein";
      if (!settings.has_api_key && !ui._askedKey) {
        ui._askedKey = true;
        showCaption("Right-click › Settings me Claude API key daaliye", "tool");
      } else if (!ui._hinted && state === "sleeping") {
        ui._hinted = true;
        showCaption(`“${settings.wake_word || "Karishma"}” boliye`, "tool", 5000);
      }
    },
  };

  // ---- click to talk (a drag moves the window instead) ----
  let downAt = null;
  $("orb").addEventListener("mousedown", (e) => { downAt = [e.screenX, e.screenY]; });
  $("orb").addEventListener("mouseup", (e) => {
    if (e.button !== 0 || !downAt) return;
    const moved = Math.abs(e.screenX - downAt[0]) + Math.abs(e.screenY - downAt[1]);
    downAt = null;
    if (moved > 4) return;
    if (state === "speaking" || state === "thinking" || state === "working") api().stop();
    else api().wake();
  });

  // ---- type instead of speaking ----
  function openComposer() {
    hideCaption();
    $("composer").classList.remove("hidden");
    $("input").focus();
  }
  function closeComposer() {
    $("composer").classList.add("hidden");
    $("input").value = "";
  }
  $("composer").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("input").value.trim();
    closeComposer();
    if (text) api().send_text(text);
  });

  // ---- right-click menu ----
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    menu.classList.remove("hidden");
    const x = Math.min(e.clientX, window.innerWidth - menu.offsetWidth - 4);
    const y = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 4);
    menu.style.left = `${Math.max(4, x)}px`;
    menu.style.top = `${Math.max(4, y)}px`;
  });
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target)) menu.classList.add("hidden");
  });
  menu.addEventListener("click", async (e) => {
    const action = e.target.closest("button")?.dataset.action;
    menu.classList.add("hidden");
    if (action === "talk") api().wake();
    if (action === "type") openComposer();
    if (action === "stop") api().stop();
    if (action === "mic") {
      const enabled = await api().toggle_mic();
      ui.setSettings({ mic_enabled: enabled });
    }
    if (action === "files") api().open_workspace();
    if (action === "settings") api().open_settings();
    if (action === "hide") api().minimize();
    if (action === "quit") api().quit();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { menu.classList.add("hidden"); closeComposer(); }
  });

  ui.setState("sleeping");
})();
