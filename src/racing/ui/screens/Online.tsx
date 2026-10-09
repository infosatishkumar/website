"use client";

import { useEffect, useMemo, useState } from "react";
import { TRACKS } from "../../shared/tracks";
import { getCar } from "../../shared/cars";
import { MAX_PLAYERS, type ClientMsg, type Profile, type RoomSettings, type ServerMsg } from "../../shared/protocol";
import { configuredServers, probeServers, type NetClient } from "../../engine/net";
import { AVATAR_COLORS, loadoutFor, type PlayerProfile, type Settings } from "../../engine/settings";
import { ProfileChip } from "./MainMenu";
import s from "../racing.module.css";

type RoomMsg = Extract<ServerMsg, { t: "room" }>;
type Probe = Awaited<ReturnType<typeof probeServers>>[number];

const DEFAULT_ROOM: RoomSettings = { track: "apex", laps: 3, maxPlayers: 8, series: 1, time: "day", weather: "dry", collisions: true };

export default function Online(props: {
  profile: PlayerProfile;
  settings: Settings;
  updateSettings: (p: Partial<Settings>) => void;
  updateProfile: (p: PlayerProfile) => void;
  status: NetClient["status"];
  room: RoomMsg | null;
  serverProfile: Profile | null;
  error: string | null;
  clearError: () => void;
  pendingCode: string;
  clearPending: () => void;
  myId: string;
  rtt: number;
  connect: (url: string) => void;
  disconnect: () => void;
  send: (m: ClientMsg) => void;
  onGarage: () => void;
  onBack: () => void;
}) {
  const { profile, settings, status, room, send } = props;
  const [custom, setCustom] = useState(settings.server);
  const servers = useMemo(() => configuredServers(settings.server), [settings.server]);
  const [probes, setProbes] = useState<Probe[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [code, setCode] = useState(props.pendingCode);
  const [roomSettings, setRoomSettings] = useState<RoomSettings>(DEFAULT_ROOM);
  const [ttTrack, setTtTrack] = useState("apex");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const online = status === "online";

  useEffect(() => {
    if (!servers.length) return;
    let alive = true;
    void probeServers(servers).then((p) => {
      if (!alive) return;
      setProbes(p);
      const best = [...p].filter((x) => x.ok).sort((a, b) => a.ping - b.ping)[0];
      setSelected((cur) => cur || (best ?? p[0]).url);
    });
    return () => { alive = false; };
  }, [servers]);

  // Auto-join from an invite link once connected.
  useEffect(() => {
    if (online && props.pendingCode && !room) {
      send({ t: "join", code: props.pendingCode, car: loadoutFor(profile) });
      props.clearPending();
    }
  }, [online, props, room, send, profile]);

  // Keep the lobby updated with the currently selected car.
  const loadoutKey = JSON.stringify(loadoutFor(profile));
  useEffect(() => {
    if (room && room.phase === "lobby") send({ t: "car", car: JSON.parse(loadoutKey) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadoutKey]);

  useEffect(() => {
    if (!room?.autoStartAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [room?.autoStartAt]);

  const me = room?.players.find((p) => p.id === props.myId);
  const host = room?.hostId === props.myId;
  const inviteUrl = room ? `${typeof location !== "undefined" ? location.origin : ""}/racing?room=${room.code}` : "";

  const header = (
    <div className={s.topBar}>
      <div>
        <div className={s.kicker}>Online · {online ? "connected" : status}{online && props.rtt ? ` · ${Math.round(props.rtt)} ms` : ""}</div>
        <h1 className={s.title}>{room ? (room.kind === "public" ? "Ranked lobby" : room.kind === "timetrial" ? "Online time trial" : "Private room") : "Multiplayer"}</h1>
      </div>
      <ProfileChip profile={profile} />
    </div>
  );

  const err = props.error && (
    <div className={`${s.notice} ${s.error}`} role="alert">
      {props.error} <button className={s.btn} style={{ padding: "3px 10px", marginLeft: 8 }} onClick={props.clearError}>OK</button>
    </div>
  );

  if (!online) {
    return (
      <div className={`${s.screen} ${s.screenDim}`}>
        {header}
        {err}
        <div className={s.split}>
          <div className={s.panel} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className={s.h2}>Choose a server</div>
            {!servers.length && (
              <div className={s.notice}>
                No race server is configured for this deployment. Online play needs the Velocity Rush server
                (<code>racing-server/</code>) running somewhere reachable – see <b>RACING.md</b>. You can paste a
                server address below (for example <code>wss://race.example.com</code>).
              </div>
            )}
            {probes?.map((p) => (
              <label key={p.url} className={`${s.card} ${selected === p.url ? s.cardActive : ""}`} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <input type="radio" name="srv" checked={selected === p.url} onChange={() => setSelected(p.url)} />
                <span style={{ flex: 1 }}>
                  <span className={s.cardTitle}>{p.name}{p.region && p.region.toLowerCase() !== p.name.toLowerCase() ? ` · ${p.region}` : ""}</span>
                  <br />
                  <span className={s.tag}>{p.url}</span>
                </span>
                <span className={s.tag}>{p.ok ? `${p.ping} ms · ${p.online} online` : "unreachable"}</span>
              </label>
            ))}
            <div className={s.field}>
              <span className={s.label}>Custom server address</span>
              <div className={s.row}>
                <input className={s.input} style={{ flex: 1 }} placeholder="wss://your-server:8787" value={custom} onChange={(e) => setCustom(e.target.value)} />
                <button className={s.btn} onClick={() => { props.updateSettings({ server: custom.trim() }); setSelected(custom.trim()); }}>Use</button>
              </div>
            </div>
            <div className={s.row}>
              <button className={`${s.btn} ${s.primary}`} disabled={!selected || status === "connecting"} onClick={() => props.connect(selected)}>
                {status === "connecting" || status === "reconnecting" ? "Connecting…" : "Connect"}
              </button>
              <button className={s.btn} onClick={props.onBack}>Back</button>
            </div>
          </div>
          <div className={s.panel}>
            <div className={s.h2}>How it works</div>
            <p className={s.muted}>
              Races run on an authoritative server: it assigns the grid, starts every car on the same clock, checks
              each lap and checkpoint, rejects impossible movement, and decides the results. Quick Match puts you in a
              ranked public lobby; private rooms get a 5-letter code you can share as an invite link.
            </p>
            {props.pendingCode && <div className={s.notice}>Invite code <b>{props.pendingCode}</b> will be joined after you connect.</div>}
          </div>
        </div>
      </div>
    );
  }

  if (!room) {
    const sp = props.serverProfile;
    return (
      <div className={`${s.screen} ${s.screenDim}`}>
        {header}
        {err}
        {sp && (
          <div className={s.row}>
            <span className={s.chip}>Online level {sp.level}</span>
            <span className={s.chip}>Rating {sp.rating}</span>
            <span className={s.chip}>{sp.wins} wins / {sp.races} races</span>
          </div>
        )}
        <div className={s.grid} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          <div className={s.panel} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className={s.h2}>Quick match</div>
            <p className={s.muted}>Ranked public race. Starts when everyone is ready, or 30 s after a second player joins. 2–{MAX_PLAYERS} players.</p>
            <button className={`${s.btn} ${s.primary}`} onClick={() => send({ t: "quick", car: loadoutFor(profile) })}>Find race</button>
          </div>
          <div className={s.panel} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className={s.h2}>Join with code</div>
            <input className={s.input} placeholder="ABCDE" maxLength={5} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="Room code" />
            <button className={s.btn} disabled={code.length !== 5} onClick={() => send({ t: "join", code, car: loadoutFor(profile) })}>Join room</button>
          </div>
          <div className={s.panel} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className={s.h2}>Private room</div>
            <RoomSettingsForm value={roomSettings} onChange={setRoomSettings} />
            <button className={s.btn} onClick={() => send({ t: "create", settings: roomSettings, car: loadoutFor(profile) })}>Create room</button>
          </div>
          <div className={s.panel} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className={s.h2}>Online time trial</div>
            <p className={s.muted}>Laps are timed and validated by the server and posted to the global leaderboard.</p>
            <div className={s.seg}>{TRACKS.map((t) => <button key={t.id} aria-pressed={ttTrack === t.id} onClick={() => setTtTrack(t.id)}>{t.name.split(" ")[0]}</button>)}</div>
            <button className={s.btn} onClick={() => send({ t: "timetrial", track: ttTrack, car: loadoutFor(profile) })}>Start</button>
          </div>
        </div>
        <div className={s.row} style={{ marginTop: "auto" }}>
          <button className={s.btn} onClick={props.onGarage}>Garage</button>
          <button className={s.btn} onClick={props.disconnect}>Disconnect</button>
          <button className={s.btn} onClick={props.onBack}>Back</button>
        </div>
      </div>
    );
  }

  const track = TRACKS.find((t) => t.id === room.settings.track)!;
  const countdown = room.autoStartAt ? Math.max(0, Math.ceil((room.autoStartAt - now) / 1000)) : null;
  return (
    <div className={`${s.screen} ${s.screenDim}`}>
      {header}
      {err}
      <div className={`${s.split} ${s.lobbySplit}`}>
        <div className={s.panel} style={{ padding: 0 }}>
          <div className={s.player} style={{ fontSize: 11, letterSpacing: "0.14em", color: "var(--muted)" }}>
            <span /> <span>DRIVER</span> <span>CAR</span> <span>STATUS</span>
          </div>
          {room.players.map((p) => (
            <div key={p.id} className={s.player} style={p.id === props.myId ? { background: "rgba(255,90,54,0.1)" } : undefined}>
              <span className={s.avatar} style={{ background: AVATAR_COLORS[p.avatar % AVATAR_COLORS.length] }}>{p.name[0]?.toUpperCase()}</span>
              <span>
                <b>{p.name}</b>{p.id === room.hostId && room.kind === "private" ? " · host" : ""}
                <br />
                <span className={s.tag}>LV {p.level} · {p.rating} · {p.connected ? `${p.ping} ms` : "reconnecting"}{room.settings.series > 1 ? ` · ${p.points} pts` : ""}</span>
              </span>
              <span className={s.tag}><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 5, background: p.car.cust.color, marginRight: 6 }} />{getCar(p.car.id).name}</span>
              <span className={p.ready ? s.ready : s.notReady}>{p.ready ? "READY" : "—"}</span>
            </div>
          ))}
        </div>
        <div className={`${s.panel} ${s.sidePanel}`}>
          {room.kind === "private" && (
            <>
              <span className={s.label}>Room code</span>
              <div className={s.code}>{room.code}</div>
              <button className={s.btn} onClick={() => {
                void navigator.clipboard?.writeText(inviteUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
              }}>{copied ? "Link copied" : "Copy invite link"}</button>
            </>
          )}
          <div>
            <div className={s.cardTitle}>{track.name}</div>
            <div className={s.tag}>
              {room.kind === "timetrial" ? "Unlimited laps" : `${room.settings.laps} lap${room.settings.laps > 1 ? "s" : ""}`} · {room.settings.time} · {room.settings.weather}
              {room.settings.series > 1 ? ` · tournament race ${room.raceIndex + 1}/${room.settings.series}` : ""} · collisions {room.settings.collisions ? "on" : "off"}
            </div>
          </div>
          {room.phase !== "lobby" && <div className={s.notice}>A race is in progress in this room. You will join the next one.</div>}
          {host && room.kind === "private" && room.phase === "lobby" && (
            <RoomSettingsForm value={room.settings} onChange={(v) => send({ t: "settings", settings: v })} />
          )}
          {countdown !== null && room.phase === "lobby" && <div className={s.notice}>Race starts in {countdown}s</div>}
          <div className={s.row}>
            {room.kind !== "timetrial" && room.phase === "lobby" && (
              <button className={`${s.btn} ${me?.ready ? "" : s.primary}`} onClick={() => send({ t: "ready", ready: !me?.ready })}>{me?.ready ? "Not ready" : "Ready"}</button>
            )}
            {host && room.kind === "private" && room.phase === "lobby" && (
              <button className={`${s.btn} ${s.primary}`} disabled={room.players.length < 2} onClick={() => send({ t: "start" })}>Start race</button>
            )}
          </div>
          {host && room.kind === "private" && room.players.length < 2 && <div className={s.muted}>Waiting for at least one more player…</div>}
          <div className={s.row} style={{ marginTop: "auto" }}>
            <button className={s.btn} onClick={props.onGarage} disabled={room.phase !== "lobby"}>Change car</button>
            <button className={s.btn} onClick={() => send({ t: "leave" })}>Leave room</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoomSettingsForm({ value, onChange }: { value: RoomSettings; onChange: (v: RoomSettings) => void }) {
  const set = (p: Partial<RoomSettings>) => onChange({ ...value, ...p });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className={s.seg}>{TRACKS.map((t) => <button key={t.id} aria-pressed={value.track === t.id} onClick={() => set({ track: t.id })}>{t.name.split(" ")[0]}</button>)}</div>
      <div className={s.row}>
        <div className={s.seg}>{[1, 2, 3, 5].map((n) => <button key={n} aria-pressed={value.laps === n} onClick={() => set({ laps: n })}>{n} lap{n > 1 ? "s" : ""}</button>)}</div>
        <div className={s.seg}>{[2, 4, 8, 12].map((n) => <button key={n} aria-pressed={value.maxPlayers === n} onClick={() => set({ maxPlayers: n })}>{n}p</button>)}</div>
      </div>
      <div className={s.row}>
        <div className={s.seg}>{(["day", "sunset", "night"] as const).map((n) => <button key={n} aria-pressed={value.time === n} onClick={() => set({ time: n })}>{n}</button>)}</div>
        <div className={s.seg}>{(["dry", "rain"] as const).map((n) => <button key={n} aria-pressed={value.weather === n} onClick={() => set({ weather: n })}>{n}</button>)}</div>
      </div>
      <div className={s.row}>
        <div className={s.seg}>{[1, 3, 5].map((n) => <button key={n} aria-pressed={value.series === n} onClick={() => set({ series: n })}>{n === 1 ? "Single race" : `Tournament ×${n}`}</button>)}</div>
        <label className={s.switch} style={{ padding: 0 }}><span>Collisions</span><input type="checkbox" checked={value.collisions} onChange={(e) => set({ collisions: e.target.checked })} /></label>
      </div>
    </div>
  );
}
