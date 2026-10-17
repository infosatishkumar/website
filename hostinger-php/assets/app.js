/* FlowForge (PHP edition) — single-page UI. No build step, no dependencies. */
(function () {
  "use strict";

  const root = document.getElementById("root");
  const S = {
    data: null,
    page: new URLSearchParams(location.search).get("page") || "dashboard",
    draft: null,
    sel: 0,
    lastRun: null,
    sample: "",
    focused: null,
    modal: null,
    q: "",
    cat: "All",
    appQ: "",
    menu: false,
    busy: "",
  };

  // ------------------------------------------------------------ helpers --
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const apps = () => S.data.catalog.apps;
  const appBy = (k) => apps().find((a) => a.key === k);
  const opsOf = (k, kind) => (kind === "trigger" ? appBy(k)?.triggers : appBy(k)?.actions) || [];
  const uid = () => "step_" + Math.random().toString(36).slice(2, 9);

  async function api(action, payload = {}) {
    const res = await fetch("api.php", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-FlowForge": "1" },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed (" + res.status + ")");
    return data;
  }

  let toastTimer;
  function toast(msg, bad) {
    let t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      document.body.appendChild(t);
    }
    t.className = "toast" + (bad ? " bad" : "");
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.style.display = "none"), bad ? 6000 : 3200);
  }

  async function reload() {
    try {
      S.data = await api("state");
    } catch (e) {
      toast(e.message, true);
    }
    render();
  }

  const icon = (k, size = 34) => {
    const a = appBy(k);
    return `<div class="appicon" style="background:${a ? a.color : "#fff"};width:${size}px;height:${size}px">${esc(a ? a.icon : "?")}</div>`;
  };
  const pill = (status) => {
    const cls = status === "success" ? "on" : status === "error" ? "failed" : "draft";
    const label = status === "success" ? "✓ Success" : status === "error" ? "× Failed" : status === "filtered" || status === "stopped" ? "⑂ Filtered" : status;
    return `<span class="pill ${cls}">${esc(label)}</span>`;
  };
  const when = (iso) => {
    const d = new Date(iso);
    const s = (Date.now() - d) / 1000;
    if (s < 60) return "Just now";
    if (s < 3600) return Math.floor(s / 60) + " min ago";
    if (s < 86400) return Math.floor(s / 3600) + " h ago";
    return d.toLocaleString();
  };
  const json = (v) => `<pre class="json">${esc(v === undefined ? "—" : typeof v === "string" ? v : JSON.stringify(v, null, 2))}</pre>`;
  const copyField = (value) => `<div class="copyrow"><input readonly class="mono" value="${esc(value)}"><button class="secondary" data-act="copy" data-value="${esc(value)}">Copy</button></div>`;

  function flatten(value, prefix, depth = 0, out = []) {
    if (out.length > 60) return out;
    if (value && typeof value === "object" && depth < 4) {
      const entries = Array.isArray(value) ? value.slice(0, 3).map((v, i) => [String(i), v]) : Object.entries(value);
      for (const [k, v] of entries) flatten(v, prefix + "." + k, depth + 1, out);
    } else if (value !== undefined) {
      const s = typeof value === "string" ? value : JSON.stringify(value);
      out.push({ path: prefix, preview: (s || "").slice(0, 60) });
    }
    return out;
  }

  // ----------------------------------------------------- builder model --
  function newStep(app, kind) {
    const op = opsOf(app, kind)[0];
    const config = {};
    op.fields.forEach((f) => f.default && (config[f.key] = f.default));
    return { id: uid(), kind: app === "filter" ? "filter" : kind, app, op: op.key, label: op.label, config };
  }
  function step(app, kind, config = {}, op) {
    const s = newStep(app, kind);
    if (op) {
      const o = opsOf(app, kind).find((x) => x.key === op);
      s.op = o.key;
      s.label = o.label;
    }
    s.config = { ...s.config, ...config };
    return s;
  }
  function sampleFor(app) {
    if (app === "rss") return { id: "https://example.com/p/1", title: "My new blog post", link: "https://example.com/p/1", description: "A short summary of the post.", published: new Date().toUTCString() };
    if (app === "schedule") return { firedAt: new Date().toISOString(), intervalMinutes: 60 };
    if (app === "telegram") return { update_id: 1, message: { message_id: 1, text: "Hello bot", chat: { id: 123456789, type: "private" }, from: { id: 123456789, first_name: "Asha" } } };
    return { name: "Asha Verma", email: "asha@example.com", phone: "+919876543210", message: "I'd like a quote" };
  }

  const TEMPLATES = [
    {
      name: "New blog post → all socials",
      desc: "Watch your RSS feed and share each new post on LinkedIn, Facebook, Bluesky and Telegram.",
      apps: ["rss", "linkedin", "facebook", "bluesky", "telegram"],
      build: () => ({ name: "New blog post → all socials", status: "off", steps: [
        step("rss", "trigger", { feedUrl: "" }),
        step("linkedin", "action", { text: "New post: {{trigger.title}}\n\n{{trigger.description}}\n\n{{trigger.link}}" }),
        step("facebook", "action", { message: "{{trigger.title}}", link: "{{trigger.link}}" }),
        step("bluesky", "action", { text: "{{trigger.title}} {{trigger.link}}" }),
        step("telegram", "action", { chatId: "@yourchannel", text: "📝 {{trigger.title}}\n{{trigger.link}}" }),
      ] }),
    },
    {
      name: "Website lead → Sheet + Telegram alert",
      desc: "Catch form submissions by webhook, log them in Google Sheets and ping you on Telegram.",
      apps: ["webhook", "google_sheets", "telegram"],
      build: () => ({ name: "Website lead → Sheet + alert", status: "off", steps: [
        step("webhook", "trigger"),
        step("filter", "action", { left: "{{trigger.email}}", operator: "exists" }),
        step("google_sheets", "action", { values: "{{now}}\n{{trigger.name}}\n{{trigger.email}}\n{{trigger.phone}}\n{{trigger.message}}" }),
        step("telegram", "action", { text: "🔔 New lead: {{trigger.name}} ({{trigger.email}}, {{trigger.phone}})\n{{trigger.message}}" }),
      ] }),
    },
    {
      name: "AI caption → Instagram + Threads",
      desc: "Send an image URL + topic by webhook; Claude writes the caption and it's published.",
      apps: ["webhook", "claude", "instagram", "threads"],
      build: () => ({ name: "AI caption → Instagram + Threads", status: "off", steps: [
        step("webhook", "trigger"),
        step("claude", "action", { prompt: "Write an engaging Instagram caption (max 3 short lines + 5 hashtags) about: {{trigger.topic}}", system: "Reply with the caption only." }),
        step("instagram", "action", { imageUrl: "{{trigger.imageUrl}}", caption: "{{steps.2.text}}" }),
        step("threads", "action", { text: "{{steps.2.text}}", imageUrl: "{{trigger.imageUrl}}" }),
      ] }),
    },
    {
      name: "Telegram bot auto-reply with Claude",
      desc: "Every message to your bot gets an AI answer.",
      apps: ["telegram", "claude"],
      build: () => ({ name: "Telegram AI assistant", status: "off", steps: [
        step("telegram", "trigger"),
        step("claude", "action", { prompt: "{{trigger.message.text}}", system: "You are a friendly assistant. Keep answers short." }),
        step("telegram", "action", { chatId: "{{trigger.message.chat.id}}", text: "{{steps.2.text}}" }),
      ] }),
    },
    {
      name: "Daily post to X + Mastodon",
      desc: "Post a recurring message on a schedule.",
      apps: ["schedule", "x", "mastodon"],
      build: () => ({ name: "Daily reminder post", status: "off", steps: [
        step("schedule", "trigger", { minutes: "1440" }),
        step("x", "action", { text: "Good morning! Today is {{today}}." }),
        step("mastodon", "action", { status: "Good morning! Today is {{today}}." }),
      ] }),
    },
  ];

  function openBuilder(draft) {
    S.draft = JSON.parse(JSON.stringify(draft));
    S.sel = 0;
    S.lastRun = null;
    const saved = draft.id && S.data.workflows.find((w) => w.id === draft.id);
    S.sample = JSON.stringify((saved && saved.state && saved.state.lastSample) || sampleFor(draft.steps[0].app), null, 2);
    go("builder");
  }

  function go(page) {
    S.page = page;
    S.menu = false;
    render();
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------- views --
  function renderAuth(mode) {
    root.innerHTML = `<div class="login"><form class="card pad" style="width:min(420px,100%)" id="authForm">
      <div class="brand" style="padding:0;margin-bottom:18px"><div class="logo">↯</div> FlowForge</div>
      ${mode === "install"
        ? `<h2 style="margin:0 0 4px">Welcome! Create your admin password</h2>
           <p class="small" style="margin-top:0">This runs once. Only people with this password can open FlowForge.</p>
           <div class="field"><label>New password (min 8 characters)</label><input type="password" name="pw" autofocus required minlength="8"></div>
           <div class="field"><label>Repeat password</label><input type="password" name="pw2" required></div>`
        : `<h2 style="margin:0 0 4px">Sign in</h2><p class="small" style="margin-top:0">Enter your FlowForge admin password.</p>
           <div class="field"><label>Password</label><input type="password" name="pw" autofocus required></div>`}
      <div class="notice" id="authErr" style="display:none;margin-bottom:12px"></div>
      <button class="primary" style="width:100%">${mode === "install" ? "Create & continue" : "Sign in"}</button>
    </form></div>`;
    document.getElementById("authForm").onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      const err = document.getElementById("authErr");
      err.style.display = "none";
      try {
        if (mode === "install" && f.pw.value !== f.pw2.value) throw new Error("Passwords don't match.");
        await api(mode === "install" ? "install" : "login", { password: f.pw.value });
        location.reload();
      } catch (ex) {
        err.textContent = ex.message;
        err.style.display = "block";
      }
    };
  }

  const TITLES = { dashboard: "Dashboard", workflows: "Workflows", builder: "Workflow builder", integrations: "Integrations", history: "Run history", setup: "Setup" };

  function render() {
    if (!S.data) {
      root.innerHTML = `<div class="empty" style="padding-top:120px">Loading FlowForge…</div>`;
      return;
    }
    const d = S.data;
    const live = d.workflows.filter((w) => w.status === "on").length;
    const nav = (p, ico) => `<button class="${S.page === p || (p === "workflows" && S.page === "builder") ? "active" : ""}" data-act="go" data-page="${p}"><span class="ico">${ico}</span>${TITLES[p]}</button>`;
    root.innerHTML = `<div class="app">
      <aside class="sidebar ${S.menu ? "open" : ""}">
        <div class="brand"><div class="logo">↯</div> FlowForge</div>
        <div><div class="navlabel">Workspace</div><nav class="nav">${nav("dashboard", "▦")}${nav("workflows", "⤴")}${nav("integrations", "▧")}${nav("history", "◷")}</nav></div>
        <div><div class="navlabel">Manage</div><nav class="nav">${nav("setup", "⚙")}</nav></div>
        <div class="sidebarbottom"><div style="font-weight:750;margin-bottom:5px">${d.connections.length} accounts connected</div>
          <div class="small" style="margin-bottom:12px">${live} live workflow${live === 1 ? "" : "s"}</div>
          <button class="secondary" style="width:100%" data-act="go" data-page="integrations">Connect apps</button></div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div class="actions" style="flex-wrap:nowrap"><button class="secondary mobilemenu" data-act="menu">☰</button>
            <span class="crumb hide-mobile">FlowForge</span><span class="hide-mobile" style="color:#b5b9c5">/</span><b>${TITLES[S.page]}</b></div>
          <div class="topright">${d.system.https ? "" : `<span class="pill draft hide-mobile">● Enable SSL (https)</span>`}
            <button class="secondary hide-mobile" data-act="logout">Sign out</button><div class="avatar">FF</div></div>
        </header>
        <div class="content">${pageHtml()}</div>
      </main>
    </div>${modalHtml()}`;
    afterRender();
  }

  function pageHtml() {
    switch (S.page) {
      case "workflows": return workflowsPage();
      case "builder": return S.draft ? builderPage() : workflowsPage();
      case "integrations": return integrationsPage();
      case "history": return historyPage();
      case "setup": return setupPage();
      default: return dashboardPage();
    }
  }

  function workflowTable(rows, compact) {
    return `<div class="card tablewrap"><table class="table"><thead><tr><th>Workflow</th>${compact ? "" : "<th>Apps</th>"}<th>Status</th><th>Runs</th>${compact ? "" : "<th>Updated</th>"}<th></th></tr></thead><tbody>
      ${rows.map((w) => `<tr>
        <td><div class="wf-name">${icon(w.steps[0].app)}<div>${esc(w.name)}<div class="small">${esc(w.steps[0].label)} · ${w.steps.length} steps</div></div></div></td>
        ${compact ? "" : `<td><div class="actions" style="gap:4px">${[...new Set(w.steps.map((s) => s.app))].slice(0, 6).map((a) => icon(a, 26)).join("")}</div></td>`}
        <td><span class="pill ${w.status === "on" ? "on" : "draft"}">${w.status === "on" ? "● Live" : "● Off"}</span></td>
        <td>${w.runs || 0}</td>
        ${compact ? "" : `<td class="small">${when(w.updatedAt)}</td>`}
        <td><div class="actions" style="justify-content:flex-end;flex-wrap:nowrap">
          <button class="rowbtn" data-act="edit" data-id="${w.id}">Edit</button>
          ${compact ? "" : `<button class="rowbtn" data-act="toggle" data-id="${w.id}">${w.status === "on" ? "Pause" : "Turn on"}</button>
          <button class="rowbtn" data-act="dup" data-id="${w.id}">Copy</button><button class="rowbtn" data-act="del" data-id="${w.id}">Delete</button>`}
        </div></td></tr>`).join("") || `<tr><td colspan="6" class="empty">No workflows yet — start from a template or create one.</td></tr>`}
      </tbody></table></div>`;
  }

  function dashboardPage() {
    const d = S.data;
    const ok = d.runs.filter((r) => r.status === "success").length;
    const failed = d.runs.filter((r) => r.status === "error").length;
    const live = d.workflows.filter((w) => w.status === "on").length;
    return `<div class="pagehead"><div><h1>Automate your socials 👋</h1><p>Triggers, actions and real API connections — all in one place.</p></div>
        <div class="actions"><button class="secondary" data-act="go" data-page="integrations">Connect accounts</button><button class="primary" data-act="create">＋ Create workflow</button></div></div>
      <div class="stats">
        <div class="card stat"><div class="statlabel">Workflows</div><div class="statnum">${d.workflows.length}</div><div class="trend">${live} live</div></div>
        <div class="card stat"><div class="statlabel">Successful runs</div><div class="statnum">${ok}</div><div class="trend">Last ${d.runs.length} runs</div></div>
        <div class="card stat"><div class="statlabel">Failed runs</div><div class="statnum">${failed}</div><div class="small">Inspect errors in Run history</div></div>
        <div class="card stat"><div class="statlabel">Connected accounts</div><div class="statnum">${d.connections.length}</div><div class="small">Across ${new Set(d.connections.map((c) => c.app)).size} apps</div></div>
      </div>
      <div class="sectionhead"><h2>Start from a template</h2></div>
      <div class="integrationgrid" style="margin-bottom:24px">${TEMPLATES.map((t, i) => `<div class="card integration">
        <div class="actions" style="gap:4px">${t.apps.map((a) => icon(a, 28)).join("")}</div><h3>${esc(t.name)}</h3><p>${esc(t.desc)}</p>
        <div class="actions"><button class="secondary" data-act="template" data-i="${i}">Use template</button></div></div>`).join("")}</div>
      <div class="two-col">
        <div><div class="sectionhead"><h2>Your workflows</h2><button class="secondary" data-act="go" data-page="workflows">View all →</button></div>${workflowTable(d.workflows.slice(0, 5), true)}</div>
        <div><div class="sectionhead"><h2>Recent activity</h2><button class="secondary" data-act="go" data-page="history">All runs →</button></div>
          <div class="card pad">${d.runs.slice(0, 6).map((r) => `<div class="activityrow"><div class="statusdot ${r.status === "error" ? "bad" : r.status === "filtered" ? "warn" : ""}"></div>
            <div style="min-width:0"><b>${esc(r.workflowName)}</b><div class="small">${when(r.startedAt)} · ${esc(r.source)} · ${r.ms} ms</div>
            ${r.error ? `<div class="small" style="color:var(--red)">${esc(r.error.slice(0, 120))}</div>` : ""}</div></div>`).join("") || `<div class="empty">No runs yet.</div>`}</div></div>
      </div>`;
  }

  function workflowsPage() {
    const rows = S.data.workflows.filter((w) => w.name.toLowerCase().includes(S.q.toLowerCase()));
    return `<div class="pagehead"><div><h1>Workflows</h1><p>Build and manage your automations.</p></div><button class="primary" data-act="create">＋ Create workflow</button></div>
      <div class="sectionhead"><input class="search" placeholder="Search workflows…" value="${esc(S.q)}" data-bind="q"><span class="small">${rows.length} workflows</span></div>
      ${workflowTable(rows)}`;
  }

  function canvasHtml() {
    const w = S.draft;
    return `<div class="canvashead"><b>Workflow canvas</b><span class="pill">${w.steps.length} steps</span></div><div class="flowline">
      ${w.steps.map((s, i) => {
        const r = S.lastRun && S.lastRun.steps.find((x) => x.stepId === s.id);
        const acct = s.connectionId ? S.data.connections.find((c) => c.id === s.connectionId) : null;
        return `<div style="width:100%;display:flex;flex-direction:column;align-items:center">${i ? `<div class="connector"></div>` : ""}
          <button class="node ${i === S.sel ? "selected" : ""} ${r && r.status === "error" ? "err" : ""}" data-act="select" data-i="${i}">
            <div class="node-top">${icon(s.app, 36)}<div style="min-width:0"><h3>${i + 1}. ${esc(s.label)}</h3>
            <p>${esc(appBy(s.app).name)}${s.connectionId ? " · " + esc(acct ? acct.label : "account missing") : ""}</p></div>
            <span class="nodebadge">${r ? pill(r.status) : i === 0 ? "TRIGGER" : s.kind.toUpperCase()}</span></div></button></div>`;
      }).join("")}<button class="addnode" data-act="addstep">+ Add step</button></div>`;
  }

  function fieldInput(f, value, conn) {
    const bind = `data-bind="cfg" data-key="${esc(f.key)}"`;
    if (f.type === "select") {
      const opts = f.optionsFrom ? ((conn && conn.meta && conn.meta[f.optionsFrom]) || []).map((o) => [o.id, o.name]) : (f.options || []).map((o) => [o, o]);
      return `<select ${bind}>${f.optionsFrom ? `<option value="">${opts.length ? "— choose —" : "Connect an account first"}</option>` : ""}
        ${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
    }
    if (f.type === "textarea" || f.type === "json") return `<textarea ${bind} class="${f.type === "json" ? "mono" : ""}" placeholder="${esc(f.placeholder || "")}">${esc(value)}</textarea>`;
    return `<input ${bind} type="${f.type === "number" ? "number" : "text"}" value="${esc(value)}" placeholder="${esc(f.placeholder || "")}">`;
  }

  function sidePanelHtml() {
    const w = S.draft;
    const s = w.steps[S.sel];
    if (!s) return "";
    const kind = S.sel === 0 ? "trigger" : "action";
    const def = appBy(s.app);
    const op = opsOf(s.app, kind).find((o) => o.key === s.op);
    const conns = S.data.connections.filter((c) => c.app === s.app);
    const conn = conns.find((c) => c.id === s.connectionId);
    const saved = w.id && S.data.workflows.find((x) => x.id === w.id);
    let sample = null;
    try { sample = JSON.parse(S.sample); } catch (e) { /* invalid JSON */ }
    const vars = flatten(sample || {}, "trigger");
    if (S.lastRun) S.lastRun.steps.forEach((r, i) => { if (i + 2 <= S.sel + 1 && r.output !== undefined) flatten(r.output, "steps." + (i + 2), 0, vars); });
    const list = apps().filter((a) => (kind === "trigger" ? a.triggers : a.actions) && (kind === "trigger" ? a.triggers : a.actions).length);
    return `<h3>${S.sel === 0 ? "Trigger" : "Step " + (S.sel + 1)}</h3><div class="small">${esc(op ? op.desc : "")}</div>
      <div class="field"><label>App</label><select data-bind="app">${list.map((a) => `<option value="${a.key}" ${a.key === s.app ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></div>
      <div class="field"><label>${S.sel === 0 ? "Event" : "Action"}</label><select data-bind="op">${opsOf(s.app, kind).map((o) => `<option value="${o.key}" ${o.key === s.op ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select></div>
      ${def.auth !== "none" ? `<div class="field"><label>Account</label><select data-bind="conn"><option value="">— choose account —</option>
        ${conns.map((c) => `<option value="${c.id}" ${c.id === s.connectionId ? "selected" : ""}>${esc(c.label)}</option>`).join("")}</select>
        <button class="linkbtn" style="align-self:flex-start;font-size:12px" data-act="connect" data-app="${s.app}">+ Connect ${conns.length ? "another" : "a"} ${esc(def.name)} account</button></div>` : ""}
      <div class="field"><label>Step name</label><input data-bind="label" value="${esc(s.label)}"></div>
      ${(op ? op.fields : []).map((f) => `<div class="field"><label>${esc(f.label)}${f.required ? " *" : ""}</label>${fieldInput(f, s.config[f.key] ?? "", conn)}${f.help ? `<span class="helper">${esc(f.help)}</span>` : ""}</div>`).join("")}
      ${S.sel === 0 && s.app === "webhook" ? `<div class="field"><label>Your webhook URL</label>${saved ? `${copyField(saved.hookUrl)}
        <span class="helper">POST JSON or form data here (WordPress/Elementor forms, your site, Make/n8n…). While the workflow is Off, requests are only saved as sample data.</span>
        ${copyField(`curl -X POST '${saved.hookUrl}' -H 'Content-Type: application/json' -d '{"name":"Asha","email":"asha@example.com"}'`)}` : `<span class="helper">Save the workflow to get its unique URL.</span>`}</div>` : ""}
      ${S.sel === 0 && s.app === "telegram" ? `<div class="notice info">Turn the workflow On to register the bot's webhook. A Telegram bot can only feed one workflow at a time. Needs https.</div>` : ""}
      ${S.sel === 0 && (s.app === "schedule" || s.app === "rss") ? `<div class="notice info">Runs from the Hostinger cron job (see Setup).${s.app === "rss" ? " The first check only remembers existing posts; new posts after that fire the workflow." : ""}</div>` : ""}
      ${S.sel > 0 && vars.length ? `<div class="divider"></div><label class="small" style="font-weight:700">Insert data from earlier steps</label>
        <div class="chips" style="margin-top:8px">${vars.slice(0, 40).map((v) => `<button class="varchip" title="${esc(v.preview)}" data-act="var" data-path="${esc(v.path)}">${esc(v.path)}</button>`).join("")}</div>
        <p class="helper">Click a field, then a variable to append it. Run a test to see outputs of later steps.</p>` : ""}
      <div class="divider"></div><div class="actions">
        ${S.sel > 0 ? `<button class="secondary" data-act="move" data-dir="-1">↑</button><button class="secondary" data-act="move" data-dir="1">↓</button><button class="danger" data-act="rmstep">Remove step</button>` : ""}</div>`;
  }

  function lastRunHtml() {
    const r = S.lastRun;
    if (!r) return "";
    return `<div class="card pad" style="margin-top:16px"><div class="sectionhead"><h2>Last test run</h2>${pill(r.status)}</div>
      ${r.steps.map((x, i) => `<div class="steplog"><div class="actions" style="justify-content:space-between"><b>${i + 2}. ${esc(x.label)}</b><span class="small">${x.ms} ms · ${pill(x.status)}</span></div>
        ${x.error ? `<div class="notice" style="margin-top:8px">${esc(x.error)}</div>` : x.output !== undefined ? json(x.output) : ""}</div>`).join("") || `<p class="small">The workflow has no action steps yet.</p>`}</div>`;
  }

  function builderPage() {
    const w = S.draft;
    return `<div class="pagehead"><div><h1 id="bTitle">${esc(w.name || "Untitled workflow")}</h1><p>Pick a trigger, add actions, map data with {{variables}}, then test with real APIs.</p></div>
        <div class="actions"><button class="secondary" data-act="go" data-page="workflows">← Back</button>
        <button class="secondary" data-act="save" ${S.busy ? "disabled" : ""}>${S.busy === "save" ? "Saving…" : "Save"}</button>
        <button class="primary" data-act="test" ${S.busy ? "disabled" : ""}>${S.busy === "test" ? "Running…" : "▶ Test run"}</button></div></div>
      <div class="actions" style="margin-bottom:18px;gap:16px">
        <div class="field" style="margin:0;max-width:420px;flex:1"><label>Workflow name</label><input data-bind="name" value="${esc(w.name)}" placeholder="e.g. New blog post → all socials"></div>
        <span class="toggle ${w.status === "on" ? "on" : ""}" data-act="livetoggle" style="margin-top:18px"><span class="track"></span> ${w.status === "on" ? "On — live" : "Off"}</span>
      </div>
      <div class="builderwrap"><div>
        <div class="canvas" id="canvas">${canvasHtml()}</div>
        <div class="card pad" style="margin-top:16px"><div class="sectionhead"><h2>Sample trigger data</h2>
          ${["webhook", "telegram"].includes(w.steps[0].app) ? `<button class="secondary" data-act="loadsample" ${w.id ? "" : "disabled"}>Load last received</button>` : ""}</div>
          <p class="small" style="margin-top:0">Used for test runs and for the variable picker. Real runs use the data the trigger receives.</p>
          <div class="field" style="margin:0"><textarea class="mono" style="min-height:140px" data-bind="sample">${esc(S.sample)}</textarea></div></div>
        ${lastRunHtml()}
      </div><div class="card sidepanel" id="side">${sidePanelHtml()}</div></div>`;
  }

  function integrationsPage() {
    const d = S.data;
    const cats = ["All", "Social", "Messaging", "Productivity", "AI", "Core"];
    const list = apps().filter((a) => (S.cat === "All" || a.category === S.cat) && (a.name + " " + a.desc + " " + a.category).toLowerCase().includes(S.appQ.toLowerCase()));
    return `<div class="pagehead"><div><h1>Integrations</h1><p>Connect real accounts. Credentials are verified live and stored encrypted on your server.</p></div></div>
      <div class="sectionhead"><div class="chips">${cats.map((c) => `<button class="chip ${S.cat === c ? "active" : ""}" data-act="cat" data-cat="${c}">${c}</button>`).join("")}</div>
        <input class="search" placeholder="Search apps…" value="${esc(S.appQ)}" data-bind="appQ"></div>
      <div class="integrationgrid">${list.map((a) => {
        const conns = d.connections.filter((c) => c.app === a.key);
        const ready = a.auth !== "oauth" || d.providers[a.oauth].configured;
        return `<div class="card integration"><div class="integrationtop">${icon(a.key, 40)}<div><h3>${esc(a.name)}</h3>
          <div class="small">${esc(a.category)} · ${a.auth === "none" ? "built in" : a.auth === "oauth" ? "OAuth" : "API key / token"}</div></div>
          <span class="pill ${a.auth === "none" || conns.length ? "on" : ready ? "" : "draft"}" style="margin-left:auto">${a.auth === "none" ? "Ready" : conns.length ? conns.length + " connected" : ready ? "Available" : "Needs app keys"}</span></div>
          <p>${esc(a.desc)}</p>
          ${conns.map((c) => `<div class="acct"><span title="${esc(c.label)}">✓ ${esc(c.label)}</span>${c.expiresAt ? `<span class="small" style="flex:none">exp. ${new Date(c.expiresAt).toLocaleDateString()}</span>` : ""}<button class="rowbtn" data-act="disconnect" data-id="${c.id}">Remove</button></div>`).join("")}
          ${a.auth !== "none" ? `<div class="actions"><button class="${conns.length ? "secondary" : "primary"}" data-act="connect" data-app="${a.key}">${conns.length ? "+ Add account" : "Connect"}</button></div>` : ""}</div>`;
      }).join("")}</div>`;
  }

  function historyPage() {
    const runs = S.data.runs;
    return `<div class="pagehead"><div><h1>Run history</h1><p>Every execution with inputs, outputs and errors per step.</p></div>
        <div class="actions"><button class="secondary" data-act="refresh">Refresh</button><button class="danger" data-act="clearruns">Clear history</button></div></div>
      <div class="card tablewrap"><table class="table"><thead><tr><th>Result</th><th>Workflow</th><th>Source</th><th>Duration</th><th>Time</th><th></th></tr></thead><tbody>
        ${runs.map((r) => `<tr><td>${pill(r.status)}</td><td><b>${esc(r.workflowName)}</b>${r.error ? `<div class="small" style="color:var(--red);max-width:380px">${esc(r.error.slice(0, 140))}</div>` : ""}</td>
          <td class="small">${esc(r.source)}</td><td class="small">${r.ms} ms</td><td class="small">${when(r.startedAt)}</td><td><button class="rowbtn" data-act="inspect" data-id="${r.id}">Inspect</button></td></tr>`).join("") || `<tr><td colspan="6" class="empty">No runs yet.</td></tr>`}
      </tbody></table></div>`;
  }

  function setupPage() {
    const d = S.data;
    const sys = d.system;
    const anyOauth = Object.values(d.providers).some((p) => p.configured);
    const check = (good, label, hint) => `<div class="activityrow"><div class="statusdot ${good ? "" : "warn"}"></div><div><b>${label}</b><div class="small">${hint}</div></div></div>`;
    const names = { meta: "Facebook Pages (Meta)", instagram: "Instagram", threads: "Threads", linkedin: "LinkedIn", x: "X (Twitter)", google: "Google Sheets", pinterest: "Pinterest" };
    return `<div class="pagehead"><div><h1>Setup</h1><p>Everything this installation needs, in one place.</p></div></div>
      <div class="two-col"><div>
        <div class="card pad"><h2 style="margin-top:0;font-size:17px">Status</h2>
          ${check(sys.https, sys.https ? "HTTPS is on" : "HTTPS is off", sys.https ? sys.appUrl : "Turn on the free SSL in Hostinger (Websites → Security → SSL). OAuth and Telegram need https.")}
          ${check(!!sys.lastCron, sys.lastCron ? "Cron is running" : "Cron job not seen yet", sys.lastCron ? "Last run " + when(sys.lastCron) : "Needed only for Schedule and RSS triggers — set it up on the right.")}
          ${check(anyOauth, anyOauth ? "OAuth apps configured" : "No OAuth apps yet", "Token apps (Telegram, Bluesky, Discord, Slack, WhatsApp…) work without this.")}
          ${check(true, "PHP " + esc(sys.php), "Data is stored in the /data folder (protected).")}
        </div>
        <div class="card pad" style="margin-top:16px"><h2 style="margin-top:0;font-size:17px">Social app keys (one-time)</h2>
          <p class="small">Facebook, Instagram, Threads, LinkedIn, X, Pinterest and Google only allow registered apps to post. Create a free developer app on each platform, paste its redirect URL there, and its ID/secret here. After that every account connects with one click.</p>
          ${Object.entries(d.providers).map(([p, v]) => {
            const info = d.catalog.providers[p];
            return `<details style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-top:10px"><summary style="cursor:pointer;font-weight:700">${v.configured ? "✅" : "⚪"} ${names[p]}</summary>
              <ol class="small" style="padding-left:18px"><li>Open <a href="${info.consoleUrl}" target="_blank" rel="noreferrer">${info.consoleUrl}</a></li><li>${esc(info.steps.replace(/ Copy the.*$/, ""))}</li><li>Redirect / callback URL:</li></ol>
              ${copyField(v.redirectUri)}
              <form data-form="oauth" data-provider="${p}"><div class="formrow"><div class="field"><label>App / Client ID</label><input name="clientId" value="${esc(v.clientId)}" autocomplete="off"></div>
              <div class="field"><label>App / Client secret</label><input name="clientSecret" type="password" placeholder="${v.configured ? "•••••••• (saved)" : ""}" autocomplete="off"></div></div>
              <button class="primary">Save ${names[p]} keys</button></form></details>`;
          }).join("")}
        </div></div>
        <div>
        <div class="card pad"><h2 style="margin-top:0;font-size:17px">Cron job (Schedule &amp; RSS)</h2>
          <p class="small"><b>Hostinger:</b> hPanel → Advanced → <b>Cron Jobs</b> → type <b>PHP</b> → every 5 minutes → command:</p>${copyField(sys.cronCommand)}
          <p class="small">Or use any URL cron service (e.g. cron-job.org) every 5 minutes:</p>${copyField(sys.cronUrl)}
          <button class="primary" style="margin-top:12px" data-act="cronnow">Run schedule &amp; RSS check now</button></div>
        <div class="card pad" style="margin-top:16px"><h2 style="margin-top:0;font-size:17px">Site URL</h2>
          <form data-form="settings"><div class="field"><label>Public URL of this FlowForge</label><input name="appUrl" value="${esc(sys.appUrl)}"><span class="helper">Auto-detected. Change only if links show the wrong domain.</span></div><button class="secondary">Save URL</button></form></div>
        <div class="card pad" style="margin-top:16px"><h2 style="margin-top:0;font-size:17px">Change password</h2>
          <form data-form="password"><div class="field"><label>Current password</label><input type="password" name="current"></div><div class="field"><label>New password</label><input type="password" name="next" minlength="8"></div><button class="secondary">Update password</button></form>
          <div class="divider"></div><button class="danger" data-act="logout">Sign out</button></div>
        </div></div>`;
  }

  function modalHtml() {
    const m = S.modal;
    if (!m) return "";
    let inner = "";
    if (m.type === "connect") {
      const a = appBy(m.app);
      if (a.auth === "oauth") {
        const pv = S.data.providers[a.oauth];
        inner = pv.configured
          ? `<div class="actions" style="margin-bottom:8px">${icon(a.key, 40)}<h2>Connect ${esc(a.name)}</h2></div><p>You'll be sent to ${esc(a.name)} to approve access, then brought straight back here.</p>
             <div class="modalfoot"><button class="secondary" data-act="closemodal">Cancel</button><a class="primary" style="border-radius:9px;padding:10px 13px;font-weight:650;color:#fff;text-decoration:none" href="oauth.php?start=1&provider=${a.oauth}&app=${a.key}">Continue →</a></div>`
          : `<div class="actions" style="margin-bottom:8px">${icon(a.key, 40)}<h2>Connect ${esc(a.name)}</h2></div>
             <p>One-time setup needed: ${esc(a.name)} only lets registered apps post. Open <b>Setup → Social app keys</b>, follow the steps for this platform and save the keys. Then click Connect again.</p>
             <div class="modalfoot"><button class="secondary" data-act="closemodal">Close</button><button class="primary" data-act="gosetup">Open Setup</button></div>`;
      } else {
        inner = `<form data-form="connect" data-app="${a.key}"><div class="actions" style="margin-bottom:8px">${icon(a.key, 40)}<h2>Connect ${esc(a.name)}</h2></div>
          ${a.authHelp ? `<p>${esc(a.authHelp)}</p>` : ""}
          ${(a.authFields || []).map((f) => `<div class="field"><label>${esc(f.label)}${f.required ? " *" : ""}</label><input name="${f.key}" type="${f.type === "password" ? "password" : "text"}" autocomplete="off" placeholder="${esc(f.placeholder || "")}">${f.help ? `<span class="helper">${esc(f.help)}</span>` : ""}</div>`).join("")}
          <div class="notice" id="connErr" style="display:none"></div>
          <div class="modalfoot"><button type="button" class="secondary" data-act="closemodal">Cancel</button><button class="primary">Verify &amp; connect</button></div></form>`;
      }
    } else if (m.type === "inspect") {
      const r = S.data.runs.find((x) => x.id === m.id);
      inner = `<h2>Execution details</h2><p>${esc(r.workflowName)} · ${new Date(r.startedAt).toLocaleString()} · ${r.ms} ms · ${pill(r.status)}</p>
        <div class="field"><label>Trigger data (${esc(r.source)})</label>${json(r.input)}</div>
        ${r.steps.map((x, i) => `<div class="steplog"><div class="actions" style="justify-content:space-between"><b>${i + 2}. ${esc(x.label)}</b><span class="small">${x.ms} ms · ${pill(x.status)}</span></div>
          ${x.error ? `<div class="notice" style="margin-top:8px">${esc(x.error)}</div>` : x.output !== undefined ? json(x.output) : ""}</div>`).join("")}
        <div class="modalfoot"><button class="primary" data-act="closemodal">Close</button></div>`;
    }
    return `<div class="modalback" data-act="backdrop"><div class="modal" role="dialog">${inner}</div></div>`;
  }

  function afterRender() {
    // Restore focus to the field the user was typing in (search boxes).
    if (S.refocus) {
      const el = root.querySelector(`[data-bind="${S.refocus}"]`);
      if (el) { el.focus(); el.setSelectionRange?.(el.value.length, el.value.length); }
      S.refocus = null;
    }
  }

  // ----------------------------------------------------------- actions --
  async function saveDraft(status) {
    const w = S.draft;
    S.busy = "save";
    try {
      const { workflow } = await api("save_workflow", { workflow: { ...w, status: status || w.status } });
      w.id = workflow.id;
      w.status = workflow.status;
      w.steps = workflow.steps.map((s) => ({ ...s, config: { ...s.config } }));
      S.data = await api("state");
      return workflow.id;
    } catch (e) {
      toast(e.message, true);
      return null;
    } finally {
      S.busy = "";
      render();
    }
  }

  function refreshBuilderPanels() {
    const c = document.getElementById("canvas");
    if (c) c.innerHTML = canvasHtml();
  }

  const handlers = {
    go: (el) => go(el.dataset.page),
    gosetup: () => { S.modal = null; go("setup"); },
    menu: () => { S.menu = !S.menu; render(); },
    copy: (el) => { navigator.clipboard?.writeText(el.dataset.value); el.textContent = "Copied"; setTimeout(() => (el.textContent = "Copy"), 1500); },
    logout: async () => { await api("logout"); location.href = location.pathname; },
    create: () => openBuilder({ name: "Untitled workflow", status: "off", steps: [newStep("webhook", "trigger")] }),
    template: (el) => openBuilder(TEMPLATES[+el.dataset.i].build()),
    edit: (el) => openBuilder(S.data.workflows.find((w) => w.id === el.dataset.id)),
    toggle: async (el) => {
      const w = S.data.workflows.find((x) => x.id === el.dataset.id);
      try { await api("save_workflow", { workflow: { ...w, status: w.status === "on" ? "off" : "on" } }); toast(w.status === "on" ? "Workflow paused" : "Workflow is live"); } catch (e) { toast(e.message, true); }
      reload();
    },
    dup: async (el) => {
      const w = S.data.workflows.find((x) => x.id === el.dataset.id);
      await api("save_workflow", { workflow: { name: w.name + " (copy)", status: "off", steps: w.steps } });
      toast("Workflow duplicated");
      reload();
    },
    del: async (el) => {
      const w = S.data.workflows.find((x) => x.id === el.dataset.id);
      if (!confirm(`Delete "${w.name}"?`)) return;
      await api("delete_workflow", { id: w.id });
      toast("Workflow deleted");
      reload();
    },
    select: (el) => { S.sel = +el.dataset.i; render(); },
    addstep: () => { S.draft.steps.push(newStep("telegram", "action")); S.sel = S.draft.steps.length - 1; render(); },
    rmstep: () => { S.draft.steps.splice(S.sel, 1); S.sel -= 1; render(); },
    move: (el) => {
      const to = S.sel + +el.dataset.dir;
      if (to < 1 || to >= S.draft.steps.length) return;
      const st = S.draft.steps;
      [st[S.sel], st[to]] = [st[to], st[S.sel]];
      S.sel = to;
      render();
    },
    var: (el) => {
      const path = el.dataset.path;
      const key = S.focused;
      if (!key) { navigator.clipboard?.writeText(`{{${path}}}`); return toast(`Copied {{${path}}} — click into a field first to insert directly.`); }
      const s = S.draft.steps[S.sel];
      s.config[key] = (s.config[key] || "") + `{{${path}}}`;
      const input = root.querySelector(`[data-bind="cfg"][data-key="${key}"]`);
      if (input) { input.value = s.config[key]; input.focus(); }
    },
    save: async () => { if (await saveDraft()) toast("Workflow saved"); },
    test: async () => {
      let sample;
      try { sample = JSON.parse(S.sample); } catch (e) { return toast("Sample data must be valid JSON.", true); }
      const id = await saveDraft();
      if (!id) return;
      S.busy = "test";
      render();
      try {
        const { run } = await api("run_workflow", { id, sample });
        S.lastRun = run;
        S.data = await api("state");
        toast(run.status === "success" ? "Test run succeeded — real actions were performed." : run.status === "filtered" ? "Run stopped by the filter." : "Test run failed: " + run.error, run.status === "error");
      } catch (e) {
        toast(e.message, true);
      } finally {
        S.busy = "";
        render();
      }
    },
    livetoggle: async () => {
      const next = S.draft.status === "on" ? "off" : "on";
      if (await saveDraft(next)) toast(next === "on" ? "Workflow is live" : "Workflow paused");
    },
    loadsample: async () => {
      S.data = await api("state");
      const w = S.data.workflows.find((x) => x.id === S.draft.id);
      if (w && w.state && w.state.lastSample) { S.sample = JSON.stringify(w.state.lastSample, null, 2); toast("Loaded the latest received data."); }
      else toast("Nothing received yet. Send a request to the URL first.");
      render();
    },
    connect: (el) => { S.modal = { type: "connect", app: el.dataset.app }; render(); },
    disconnect: async (el) => {
      if (!confirm("Disconnect this account? Steps using it will fail until you pick another.")) return;
      await api("disconnect", { id: el.dataset.id });
      toast("Account disconnected");
      reload();
    },
    cat: (el) => { S.cat = el.dataset.cat; render(); },
    inspect: (el) => { S.modal = { type: "inspect", id: el.dataset.id }; render(); },
    closemodal: () => { S.modal = null; render(); },
    backdrop: (el, e) => { if (e.target === el) { S.modal = null; render(); } },
    refresh: () => reload(),
    clearruns: async () => { if (confirm("Clear all run history?")) { await api("clear_runs"); reload(); } },
    cronnow: async (el) => {
      el.disabled = true;
      el.textContent = "Checking…";
      try {
        const r = await api("cron_now");
        toast(`Checked ${r.checked} workflows, fired ${r.fired.length}${r.errors.length ? `, ${r.errors.length} errors: ${r.errors[0].error}` : ""}`, r.errors.length > 0);
      } catch (e) { toast(e.message, true); }
      reload();
    },
  };

  root.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el || !handlers[el.dataset.act]) return;
    if (el.dataset.act !== "backdrop") e.preventDefault();
    handlers[el.dataset.act](el, e);
  });

  root.addEventListener("focusin", (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.bind === "cfg") S.focused = el.dataset.key;
  });
  root.addEventListener("mousedown", (e) => { if (e.target.closest(".varchip")) e.preventDefault(); });

  function onInput(e) {
    const el = e.target;
    const b = el.dataset && el.dataset.bind;
    if (!b) return;
    const w = S.draft;
    const s = w && w.steps[S.sel];
    switch (b) {
      case "q": case "appQ": S[b] = el.value; S.refocus = b; render(); break;
      case "name": w.name = el.value; document.getElementById("bTitle").textContent = el.value || "Untitled workflow"; break;
      case "label": s.label = el.value; refreshBuilderPanels(); break;
      case "cfg": s.config[el.dataset.key] = el.value; break;
      case "sample": S.sample = el.value; break;
      case "conn": s.connectionId = el.value || null; if (e.type === "change") render(); break;
      case "app": if (e.type === "change") {
        const fresh = newStep(el.value, S.sel === 0 ? "trigger" : "action");
        w.steps[S.sel] = { ...fresh, id: s.id };
        if (S.sel === 0) S.sample = JSON.stringify(sampleFor(el.value), null, 2);
        render();
      } break;
      case "op": if (e.type === "change") {
        const o = opsOf(s.app, S.sel === 0 ? "trigger" : "action").find((x) => x.key === el.value);
        const defs = {};
        o.fields.forEach((f) => f.default && (defs[f.key] = f.default));
        Object.assign(s, { op: o.key, label: o.label, config: { ...defs, ...s.config } });
        render();
      } break;
    }
  }
  root.addEventListener("input", onInput);
  root.addEventListener("change", onInput);

  root.addEventListener("submit", async (e) => {
    const f = e.target.closest("form[data-form]");
    if (!f) return;
    e.preventDefault();
    const data = Object.fromEntries(new FormData(f));
    try {
      if (f.dataset.form === "connect") {
        const err = document.getElementById("connErr");
        err.style.display = "none";
        const btn = f.querySelector("button.primary");
        btn.disabled = true;
        btn.textContent = "Verifying…";
        try {
          const { connection } = await api("connect", { app: f.dataset.app, fields: data });
          S.modal = null;
          toast("Connected " + connection.label);
          await reload();
        } catch (ex) {
          err.textContent = ex.message;
          err.style.display = "block";
          btn.disabled = false;
          btn.textContent = "Verify & connect";
        }
        return;
      }
      if (f.dataset.form === "oauth") { await api("save_oauth", { provider: f.dataset.provider, ...data }); toast("Keys saved"); }
      if (f.dataset.form === "settings") { await api("save_settings", data); toast("Site URL saved"); }
      if (f.dataset.form === "password") { await api("change_password", data); toast("Password updated"); f.reset(); return; }
      reload();
    } catch (ex) {
      toast(ex.message, true);
    }
  });

  // -------------------------------------------------------------- boot --
  if (window.FF_MODE !== "app") {
    renderAuth(window.FF_MODE);
    return;
  }
  const params = new URLSearchParams(location.search);
  if (params.get("connected")) setTimeout(() => toast("Connected " + params.get("connected")), 300);
  if (params.get("error")) setTimeout(() => toast(params.get("error"), true), 300);
  if (location.search) history.replaceState(null, "", location.pathname);
  render();
  reload();
})();
