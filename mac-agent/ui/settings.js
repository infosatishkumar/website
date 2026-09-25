(function () {
  const $ = (id) => document.getElementById(id);
  const FIELDS = ["agent_name", "wake_word", "user_name", "voice", "speech_rate", "stt_language",
                  "conversation_timeout", "model", "effort"];

  function fill(data) {
    const voiceSel = $("s-voice");
    voiceSel.innerHTML = '<option value="">Auto (Indian voice)</option>';
    (data.voices || []).forEach((v) => {
      const [name, locale] = v.split("|");
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = `${name} — ${locale}`;
      voiceSel.appendChild(opt);
    });
    FIELDS.forEach((f) => { $(`s-${f}`).value = data[f] ?? ""; });
    $("s-speak_replies").checked = data.speak_replies !== false;
    $("s-api_key").value = "";
    $("key-hint").textContent = data.has_api_key ? `(saved ${data.api_key_hint})` : "(zaroori)";
  }

  function collect() {
    const data = {};
    FIELDS.forEach((f) => { data[f] = $(`s-${f}`).value; });
    data.speak_replies = $("s-speak_replies").checked;
    const key = $("s-api_key").value.trim();
    if (key) data.api_key = key;
    return data;
  }

  async function init() {
    fill(await window.pywebview.api.get_settings());
  }

  $("btn-save").addEventListener("click", async () => {
    await window.pywebview.api.save_settings(collect());
    window.pywebview.api.close_settings();
  });
  $("btn-cancel").addEventListener("click", () => window.pywebview.api.close_settings());
  $("btn-test-voice").addEventListener("click", async () => {
    await window.pywebview.api.save_settings({ voice: $("s-voice").value, speech_rate: $("s-speech_rate").value });
    window.pywebview.api.test_voice();
  });
  $("btn-clear").addEventListener("click", () => {
    window.pywebview.api.clear_chat();
    $("saved").textContent = "Purani baat-cheet saaf ho gayi ✓";
  });

  if (window.pywebview && window.pywebview.api) init();
  else window.addEventListener("pywebviewready", init);
})();
