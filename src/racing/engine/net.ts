// WebSocket client for the authoritative race server: identity, clock sync,
// automatic reconnection, regional server selection by latency, and
// snapshot buffering for smooth interpolation of remote cars.

import { PROTOCOL_VERSION, type ClientMsg, type ServerMsg, type CarState } from "../shared/protocol.ts";

export interface ServerEntry {
  name: string;
  url: string;
}

/** Parse NEXT_PUBLIC_RACING_SERVERS: "Region|wss://host,Region2|wss://host2" or a single URL. */
export function configuredServers(custom: string): ServerEntry[] {
  const out: ServerEntry[] = [];
  if (custom.trim()) out.push({ name: "Custom", url: custom.trim() });
  const env = process.env.NEXT_PUBLIC_RACING_SERVERS ?? "";
  for (const part of env.split(",").map((s) => s.trim()).filter(Boolean)) {
    const [a, b] = part.includes("|") ? part.split("|") : ["Server", part];
    out.push({ name: a.trim(), url: b.trim() });
  }
  if (!out.length && typeof location !== "undefined") {
    // Development default: a server running next to `next dev`.
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1" || /^192\.168\.|^10\./.test(location.hostname)) {
      out.push({ name: "Local", url: `ws://${location.hostname}:8787` });
    }
  }
  return out;
}

export const httpUrl = (ws: string) => ws.replace(/^ws(s?):\/\//, "http$1://").replace(/\/$/, "");

/** Measure latency to each server's /health endpoint. */
export async function probeServers(list: ServerEntry[]) {
  return Promise.all(
    list.map(async (s) => {
      const t0 = performance.now();
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 2500);
        const r = await fetch(`${httpUrl(s.url)}/health`, { signal: ctl.signal, cache: "no-store" });
        clearTimeout(timer);
        const j = await r.json();
        return { ...s, ping: Math.round(performance.now() - t0), ok: true, online: j.online as number, region: j.region as string };
      } catch {
        return { ...s, ping: Infinity, ok: false, online: 0, region: "" };
      }
    }),
  );
}

interface Snap {
  time: number;
  state: CarState;
}

export class NetClient {
  ws: WebSocket | null = null;
  url = "";
  id = "";
  token = "";
  name = "";
  avatar = 0;
  rtt = 0;
  private offset = 0;
  private offsetSamples: number[] = [];
  private handlers = new Map<string, Set<(m: ServerMsg) => void>>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private wantOpen = false;
  private attempts = 0;
  status: "idle" | "connecting" | "online" | "reconnecting" | "offline" = "idle";
  onStatus: ((s: NetClient["status"]) => void) | null = null;
  /** Interpolation buffers for remote cars. */
  buffers = new Map<string, Snap[]>();
  interpDelay = 110;

  on<T extends ServerMsg["t"]>(t: T, cb: (m: Extract<ServerMsg, { t: T }>) => void) {
    let set = this.handlers.get(t);
    if (!set) this.handlers.set(t, (set = new Set()));
    set.add(cb as (m: ServerMsg) => void);
    return () => set!.delete(cb as (m: ServerMsg) => void);
  }

  private setStatus(s: NetClient["status"]) {
    this.status = s;
    this.onStatus?.(s);
  }

  connect(url: string, name: string, avatar: number, token: string) {
    this.url = url;
    this.name = name;
    this.avatar = avatar;
    this.token = token;
    this.wantOpen = true;
    this.attempts = 0;
    this.open();
  }

  private open() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    this.setStatus(this.attempts > 0 ? "reconnecting" : "connecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.setStatus("offline");
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.send({ t: "hello", v: PROTOCOL_VERSION, name: this.name, avatar: this.avatar, token: this.token || undefined });
    };
    ws.onmessage = (ev) => {
      let m: ServerMsg;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === "welcome") {
        this.id = m.id;
        this.token = m.token;
        this.offset = m.serverTime - Date.now();
        this.attempts = 0;
        this.setStatus("online");
        this.startPing();
      } else if (m.t === "pong") {
        const now = Date.now();
        const rtt = now - m.c;
        this.rtt = this.rtt ? this.rtt * 0.7 + rtt * 0.3 : rtt;
        this.offsetSamples.push(m.s + rtt / 2 - now);
        if (this.offsetSamples.length > 9) this.offsetSamples.shift();
        const sorted = [...this.offsetSamples].sort((a, b) => a - b);
        this.offset = sorted[Math.floor(sorted.length / 2)];
      } else if (m.t === "snap") {
        for (const [id, state] of m.p) {
          if (id === this.id) continue;
          let b = this.buffers.get(id);
          if (!b) this.buffers.set(id, (b = []));
          b.push({ time: m.time, state });
          if (b.length > 40) b.shift();
        }
      }
      const set = this.handlers.get(m.t);
      if (set) for (const cb of set) cb(m);
    };
    ws.onclose = () => {
      this.stopPing();
      if (!this.wantOpen) { this.setStatus("offline"); return; }
      this.attempts++;
      if (this.attempts > 8) { this.setStatus("offline"); return; }
      this.setStatus("reconnecting");
      const delay = Math.min(8000, 500 * 2 ** this.attempts);
      this.reconnectTimer = setTimeout(() => this.open(), delay);
    };
    ws.onerror = () => { /* onclose handles retries */ };
  }

  private startPing() {
    this.stopPing();
    const ping = () => this.send({ t: "ping", c: Date.now(), rtt: Math.round(this.rtt) });
    for (let i = 0; i < 4; i++) setTimeout(ping, i * 150);
    this.pingTimer = setInterval(ping, 2000);
  }

  private stopPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  send(m: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  serverNow() {
    return Date.now() + this.offset;
  }

  /** Interpolated state for a remote car at (server now - delay). */
  sample(id: string, out: number[]): boolean {
    const b = this.buffers.get(id);
    if (!b || !b.length) return false;
    const t = this.serverNow() - this.interpDelay;
    let i = b.length - 1;
    while (i > 0 && b[i - 1].time > t) i--;
    const a = b[Math.max(0, i - 1)], c = b[i];
    if (t >= c.time || a === c) {
      // Extrapolate briefly with velocity when packets are late.
      const dt = Math.min(0.25, (t - c.time) / 1000);
      for (let k = 0; k < c.state.length; k++) out[k] = c.state[k];
      if (dt > 0) { out[0] += c.state[6] * dt; out[2] += c.state[7] * dt; }
      return true;
    }
    const u = Math.max(0, Math.min(1, (t - a.time) / (c.time - a.time || 1)));
    for (let k = 0; k < c.state.length; k++) {
      if (k === 3) {
        let d = c.state[3] - a.state[3];
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        out[3] = a.state[3] + d * u;
      } else if (k === 10 || k === 11) out[k] = c.state[k];
      else out[k] = a.state[k] + (c.state[k] - a.state[k]) * u;
    }
    return true;
  }

  clearBuffers() {
    this.buffers.clear();
  }

  disconnect() {
    this.wantOpen = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopPing();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("offline");
  }
}
