"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RenderCore } from "../engine/renderer";
import { Showroom } from "../engine/showroom";
import { AudioEngine } from "../engine/audio";
import { Input } from "../engine/input";
import { Game, type HudState, type RaceResult, type SessionConfig } from "../engine/game";
import { NetClient } from "../engine/net";
import {
  loadSettings, saveSettings, loadProfile, saveProfile, custFor, isTouchDevice, loadoutFor,
  type Settings, type PlayerProfile,
} from "../engine/settings";
import { applyResult, type CareerEvent, type RewardSummary } from "../engine/progression";
import { getCar } from "../shared/cars";
import type { Loadout, ServerMsg, Profile } from "../shared/protocol";
import type { TrackData } from "../shared/trackGeom";
import type { TimeOfDay, Weather } from "../shared/tracks";
import Hud from "./Hud";
import TouchControls from "./TouchControls";
import MainMenu from "./screens/MainMenu";
import Garage from "./screens/Garage";
import EventSetup from "./screens/EventSetup";
import Career from "./screens/Career";
import Online from "./screens/Online";
import SettingsScreen from "./screens/SettingsScreen";
import Records from "./screens/Records";
import Results from "./screens/Results";
import Pause from "./screens/Pause";
import s from "./racing.module.css";

export type Screen = "boot" | "menu" | "garage" | "play" | "career" | "online" | "settings" | "records" | "loading" | "race" | "results" | "replay";

type RoomMsg = Extract<ServerMsg, { t: "room" }>;

interface SessionCtx {
  cfg: SessionConfig;
  event?: CareerEvent;
  daily?: boolean;
  time: TimeOfDay;
  weather: Weather;
}

const TIPS = [
  "Brake in a straight line, then trail off the brake as you turn in.",
  "Hold the handbrake briefly to kick the rear out for a drift.",
  "Wet roads cut grip by roughly a third – brake earlier and stay smooth.",
  "Nitro is strongest on long straights; it recharges while you cruise.",
  "Switch to manual gears in Settings and shift on the red RPM bar for faster drag launches.",
  "Press C to cycle cameras: chase, far, hood, bumper, cockpit and cinematic.",
  "Upgrades in the Garage raise power, grip and cut weight.",
];

export default function RacingApp() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coreRef = useRef<RenderCore | null>(null);
  const showroomRef = useRef<Showroom | null>(null);
  const gameRef = useRef<Game | null>(null);
  const netRef = useRef<NetClient | null>(null);
  const sessionRef = useRef<SessionCtx | null>(null);

  const [settings, setSettingsState] = useState<Settings>(() => loadSettings());
  const [profile, setProfileState] = useState<PlayerProfile>(() => loadProfile());
  const [screen, setScreenState] = useState<Screen>("boot");
  const [returnTo, setReturnTo] = useState<Screen>("menu");
  const [hud, setHud] = useState<HudState | null>(null);
  const [track, setTrack] = useState<TrackData | null>(null);
  const [load, setLoad] = useState({ p: 0, label: "" });
  const [tip, setTip] = useState(TIPS[0]);
  const [result, setResult] = useState<RaceResult | null>(null);
  const [rewards, setRewards] = useState<RewardSummary | null>(null);
  const [paused, setPaused] = useState(false);
  const [garageCar, setGarageCar] = useState(profile.selectedCar);
  const [touch] = useState(() => isTouchDevice());
  const [audio] = useState(() => new AudioEngine());
  const [input] = useState(() => new Input(settings));
  const [game, setGame] = useState<Game | null>(null);
  const [session, setSession] = useState<SessionCtx | null>(null);
  const [webglError, setWebglError] = useState<string | null>(() => {
    const c = document.createElement("canvas");
    return c.getContext("webgl2") ? null : "WebGL 2 is not supported by this browser/device";
  });
  // Online state
  const [netStatus, setNetStatus] = useState<NetClient["status"]>("idle");
  const [room, setRoom] = useState<RoomMsg | null>(null);
  const [serverProfile, setServerProfile] = useState<Profile | null>(null);
  const [netError, setNetError] = useState<string | null>(null);
  // Invite links: /racing?room=CODE
  const [pendingCode, setPendingCode] = useState(() => (new URLSearchParams(location.search).get("room") ?? "").toUpperCase());
  const [myId, setMyId] = useState("");
  const [rtt, setRtt] = useState(0);

  const screenRef = useRef(screen);
  const profileRef = useRef(profile);
  const settingsRef = useRef(settings);
  const roomRef = useRef(room);
  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { roomRef.current = room; }, [room]);

  const setScreen = useCallback((sc: Screen) => {
    audio.click();
    setScreenState(sc);
  }, [audio]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    const n = { ...settingsRef.current, ...patch };
    settingsRef.current = n;
    saveSettings(n);
    setSettingsState(n);
    if (coreRef.current && coreRef.current.quality !== n.quality) coreRef.current.setQuality(n.quality);
    if (coreRef.current) coreRef.current.adaptive = n.adaptiveResolution;
    audio.setLevels(n);
    audio.hrtf = n.quality === "ultra";
    input.setSettings(n);
    gameRef.current?.updateSettings(n);
  }, [audio, input]);

  const updateProfile = useCallback((p: PlayerProfile) => {
    profileRef.current = p;
    saveProfile(p);
    setProfileState(p);
  }, []);

  // ---------------------------------------------------------------------
  // Renderer, showroom loop, resize, input
  // ---------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current!;
    let core: RenderCore;
    try {
      core = new RenderCore(canvas, settingsRef.current.quality);
    } catch (e) {
      void Promise.resolve().then(() => setWebglError(String(e instanceof Error ? e.message : e)));
      return;
    }
    core.adaptive = settingsRef.current.adaptiveResolution;
    coreRef.current = core;
    const showroom = new Showroom(core.renderer, settingsRef.current.quality);
    showroomRef.current = showroom;
    const p = profileRef.current;
    showroom.setCar(getCar(p.selectedCar), custFor(p, p.selectedCar));
    input.setSettings(settingsRef.current);
    input.attach();
    audio.setLevels(settingsRef.current);
    const resize = () => {
      const el = rootRef.current!;
      core.resize(el.clientWidth, el.clientHeight);
      showroom.resize(el.clientWidth, el.clientHeight);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(rootRef.current!);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (gameRef.current) return; // the game renders itself
      if (screenRef.current === "loading") return;
      // A race may have changed exposure / post effects; the studio uses its own.
      core.renderer.toneMappingExposure = 0.9;
      core.hazeAmount = 0;
      showroom.update(dt);
      core.render(showroom.scene, showroom.camera, now / 1000);
    };
    raf = requestAnimationFrame(loop);
    // Lock page scrolling while the game is open.
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onVis = () => {
      if (document.hidden) {
        audio.suspend();
        if (gameRef.current && !gameRef.current.cfg.online && screenRef.current === "race") {
          setPaused(true);
          gameRef.current.setPaused(true);
        }
      } else audio.resume();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      input.detach();
      document.removeEventListener("visibilitychange", onVis);
      document.documentElement.style.overflow = prevOverflow;
      gameRef.current?.dispose();
      gameRef.current = null;
      netRef.current?.disconnect();
      showroom.dispose();
      core.dispose();
      audio.dispose();
    };
  }, [audio, input]);

  // Keep the showroom car in sync with garage / selection.
  useEffect(() => {
    const sh = showroomRef.current;
    if (!sh) return;
    const id = screen === "garage" ? garageCar : profile.selectedCar;
    sh.setCar(getCar(id), custFor(profile, id));
    if (screen === "garage" && canvasRef.current) sh.enterGarage(canvasRef.current);
    else sh.exitGarage();
  }, [screen, garageCar, profile]);

  // ---------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------
  const togglePause = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const sc = screenRef.current;
    if (sc === "race") {
      setPaused((p) => {
        const n = !p;
        g.setPaused(n);
        return n;
      });
    }
  }, []);

  const disposeGame = useCallback(() => {
    gameRef.current?.dispose();
    gameRef.current = null;
    setGame(null);
    setHud(null);
    setPaused(false);
    audio.setEnvironment(null, false);
  }, [audio]);

  const handleResult = useCallback((r: RaceResult) => {
    const ctx = sessionRef.current;
    if (!ctx) return;
    const { profile: np, summary } = applyResult(profileRef.current, r, { event: ctx.event, daily: ctx.daily, time: ctx.time, weather: ctx.weather });
    updateProfile(np);
    setRewards(summary);
    setResult(r);
    setPaused(false);
    gameRef.current?.setPaused(false);
    setScreenState("results");
  }, [updateProfile]);

  const startSession = useCallback(async (cfg: SessionConfig, extra: { event?: CareerEvent; daily?: boolean } = {}) => {
    const core = coreRef.current;
    if (!core) return;
    audio.start();
    audio.hrtf = settingsRef.current.quality === "ultra";
    disposeGame();
    const ctx: SessionCtx = { cfg, ...extra, time: cfg.time, weather: cfg.weather };
    sessionRef.current = ctx;
    setSession(ctx);
    setResult(null);
    setRewards(null);
    setTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
    setLoad({ p: 0, label: "Preparing" });
    setScreenState("loading");
    const g = new Game(core, audio, input, settingsRef.current, cfg);
    g.onHud = setHud;
    g.onResult = handleResult;
    g.onPause = togglePause;
    input.onAction = (a) => {
      if (a === "pause") togglePause();
      else gameRef.current?.onAction(a);
    };
    try {
      await g.load((p, label) => setLoad({ p, label }));
    } catch (e) {
      console.error(e);
      g.dispose();
      setNetError(`Could not load the track: ${e instanceof Error ? e.message : String(e)}`);
      setScreenState("menu");
      return;
    }
    gameRef.current = g;
    setGame(g);
    if (process.env.NODE_ENV !== "production") (window as unknown as { __vr?: Game }).__vr = g;
    setTrack(g.track);
    g.start();
    setScreenState("race");
  }, [audio, input, disposeGame, handleResult, togglePause]);

  /** Leave the session. `leaveRoom` also drops out of the online room (mid-race exit). */
  const quit = useCallback((to: Screen = "menu", leaveRoom = false) => {
    if (leaveRoom && gameRef.current?.cfg.online) netRef.current?.send({ t: "leave" });
    disposeGame();
    setResult(null);
    setScreen(to);
  }, [disposeGame, setScreen]);

  const restart = useCallback(() => {
    const ctx = sessionRef.current;
    if (!ctx || ctx.cfg.online) return;
    void startSession(ctx.cfg, { event: ctx.event, daily: ctx.daily });
  }, [startSession]);

  // ---------------------------------------------------------------------
  // Online
  // ---------------------------------------------------------------------
  const net = useCallback(() => {
    if (!netRef.current) {
      const n = new NetClient();
      n.onStatus = setNetStatus;
      n.on("pong", () => setRtt(Math.round(n.rtt)));
      n.on("welcome", (m) => {
        setMyId(m.id);
        setServerProfile(m.profile);
        setNetError(null);
        if (m.token !== profileRef.current.netToken) updateProfile({ ...profileRef.current, netToken: m.token });
      });
      n.on("profile", (m) => setServerProfile(m.profile));
      n.on("room", (m) => setRoom(m));
      n.on("error", (m) => setNetError(m.msg));
      n.on("left", (m) => {
        setRoom(null);
        setNetError(m.reason);
      });
      n.on("start", (m) => {
        const g = gameRef.current;
        // A reconnect re-sends the start of the race we're already in.
        if (g?.cfg.online && g.cfg.online.startAt === m.startAt) return;
        const r = roomRef.current;
        const players = new Map<string, { name: string; car: Loadout; avatar: number }>();
        for (const p of r?.players ?? []) players.set(p.id, { name: p.name, car: p.car, avatar: p.avatar });
        const me = players.get(n.id);
        const cfg: SessionConfig = {
          mode: "online", track: m.settings.track, laps: m.settings.laps, opponents: 0, skill: "pro",
          time: m.settings.time, weather: m.settings.weather, dynamicTime: false, dynamicWeather: false, traffic: false,
          car: me?.car ?? loadoutFor(profileRef.current), playerName: profileRef.current.name,
          online: { net: n, grid: m.grid, startAt: m.startAt, players, kind: m.kind, laps: m.settings.laps, collisions: m.settings.collisions },
        };
        void startSession(cfg);
      });
      netRef.current = n;
    }
    return netRef.current;
  }, [startSession, updateProfile]);

  const connect = useCallback((url: string) => {
    const p = profileRef.current;
    setNetError(null);
    net().connect(url, p.name || "Driver", p.avatar, p.netToken);
  }, [net]);

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  const inGame = screen === "race" || screen === "results" || screen === "replay";
  const showVignette = !inGame && screen !== "loading" && screen !== "boot";

  return (
    <div ref={rootRef} className={s.root} data-lenis-prevent onContextMenu={(e) => e.preventDefault()}>
      <canvas ref={canvasRef} className={s.canvas} />
      {showVignette && <div className={s.vignette} />}
      {webglError && (
        <div className={s.boot}>
          <div className={s.bootInner}>
            <h1 className={s.title}>WebGL unavailable</h1>
            <p className={s.muted}>This game needs WebGL 2 graphics. Enable hardware acceleration in your browser or try another browser/device. ({webglError})</p>
          </div>
        </div>
      )}
      {screen === "boot" && !webglError && (
        <BootScreen
          profile={profile}
          onStart={(name) => {
            audio.start();
            if (name !== profile.name) updateProfile({ ...profile, name });
            setScreen(pendingCode ? "online" : "menu");
          }}
        />
      )}
      {screen === "menu" && (
        <MainMenu profile={profile} onNav={(sc) => { if (sc === "garage") setGarageCar(profile.selectedCar); setReturnTo("menu"); setScreen(sc); }} error={netError} clearError={() => setNetError(null)} />
      )}
      {screen === "garage" && (
        <Garage
          profile={profile}
          carId={garageCar}
          setCarId={setGarageCar}
          updateProfile={updateProfile}
          onView={(v) => showroomRef.current?.view(v)}
          onBack={() => setScreen(returnTo === "garage" ? "menu" : returnTo)}
        />
      )}
      {screen === "play" && (
        <EventSetup
          profile={profile}
          onBack={() => setScreen("menu")}
          onGarage={() => { setGarageCar(profile.selectedCar); setReturnTo("play"); setScreen("garage"); }}
          onStart={(cfg) => void startSession({ ...cfg, car: loadoutFor(profile), playerName: profile.name })}
        />
      )}
      {screen === "career" && (
        <Career
          profile={profile}
          onBack={() => setScreen("menu")}
          onStart={(ev, daily) => void startSession({
            mode: ev.mode, track: ev.track, laps: ev.laps, opponents: ev.opponents, skill: ev.skill, time: ev.time, weather: ev.weather,
            dynamicTime: false, dynamicWeather: false, traffic: false, car: loadoutFor(profile), playerName: profile.name,
            duration: ev.duration, label: ev.name,
          }, { event: ev, daily })}
        />
      )}
      {screen === "online" && (
        <Online
          profile={profile}
          settings={settings}
          updateSettings={updateSettings}
          updateProfile={updateProfile}
          status={netStatus}
          room={room}
          serverProfile={serverProfile}
          error={netError}
          clearError={() => setNetError(null)}
          pendingCode={pendingCode}
          clearPending={() => setPendingCode("")}
          myId={myId}
          rtt={rtt}
          connect={connect}
          disconnect={() => { netRef.current?.disconnect(); setRoom(null); }}
          send={(m) => net().send(m)}
          onGarage={() => { setGarageCar(profile.selectedCar); setReturnTo("online"); setScreen("garage"); }}
          onBack={() => setScreen("menu")}
        />
      )}
      {screen === "settings" && (
        <SettingsScreen settings={settings} updateSettings={updateSettings} profile={profile} updateProfile={updateProfile} input={input} onBack={() => setScreen(returnTo === "settings" ? "menu" : returnTo)} />
      )}
      {screen === "records" && <Records profile={profile} settings={settings} onBack={() => setScreen("menu")} />}
      {screen === "loading" && (
        <div className={s.loading} role="status" aria-live="polite">
          <div className={s.kicker}>Loading</div>
          <h1 className={s.title}>{session?.cfg.label ?? session?.cfg.track ?? ""}</h1>
          <div className={s.muted}>{load.label}…</div>
          <div className={s.loadBar}><div className={s.loadFill} style={{ width: `${Math.round(load.p * 100)}%` }} /></div>
          <div className={s.tip}>Tip: {tip}</div>
        </div>
      )}
      {(screen === "race" || screen === "replay") && hud && track && (
        <Hud hud={hud} track={track} units={settings.units} showFps={settings.showFps} touch={touch && screen === "race"} onPause={togglePause} />
      )}
      {screen === "race" && touch && game && !paused && (
        <TouchControls input={input} settings={settings} onCamera={() => game.onAction("camera")} />
      )}
      {screen === "race" && paused && game && (
        <Pause
          game={game}
          settings={settings}
          updateSettings={updateSettings}
          onResume={togglePause}
          onRestart={session?.cfg.online ? null : restart}
          onEnd={game.cfg.mode === "freeroam" || game.cfg.mode === "timetrial" ? () => game.endSession() : null}
          onQuit={() => quit(game.cfg.online ? "online" : "menu", true)}
        />
      )}
      {screen === "results" && result && (
        <Results
          result={result}
          rewards={rewards}
          profile={profile}
          event={session?.event}
          onReplay={() => { if (game?.startReplay()) setScreenState("replay"); }}
          onRestart={session?.cfg.online ? null : restart}
          onContinue={() => quit(session?.cfg.online ? "online" : session?.event ? "career" : "menu")}
          online={!!session?.cfg.online}
        />
      )}
      {screen === "replay" && (
        <div className={s.overlay} style={{ justifyContent: "flex-end", alignItems: "center", padding: 24 }}>
          <div className={s.row}>
            <button className={s.btn} onClick={() => game?.onAction("camera")}>Switch camera</button>
            <button className={`${s.btn} ${s.primary}`} onClick={() => { game?.stopReplay(); setScreenState("results"); }}>Exit replay</button>
          </div>
        </div>
      )}
      {(screen === "race" || screen === "replay") && <div className={s.rotate}>Rotate your device to landscape</div>}
    </div>
  );
}

function BootScreen({ profile, onStart }: { profile: PlayerProfile; onStart: (name: string) => void }) {
  const [name, setName] = useState(profile.name);
  const go = () => onStart(name.trim().slice(0, 16) || "Driver");
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") { if (e.key === "Enter") go(); return; }
      go();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  return (
    <div className={s.boot}>
      <div className={s.bootInner}>
        <div className={s.kicker}>Browser racing · online multiplayer</div>
        <div className={s.brandMark}>Velocity<span>/</span>Rush</div>
        <p className={s.muted} style={{ maxWidth: 520 }}>
          Original supercars, real-time physics, four detailed environments and online races against real players.
        </p>
        <div className={s.field} style={{ width: "min(320px, 80vw)" }}>
          <label className={s.label} htmlFor="vr-name">Driver name</label>
          <input id="vr-name" className={s.input} value={name} maxLength={16} placeholder="Driver" onChange={(e) => setName(e.target.value)} />
        </div>
        <button className={`${s.btn} ${s.primary}`} onClick={go}>Start engine</button>
        <div className={s.press}>Press any key</div>
      </div>
    </div>
  );
}
