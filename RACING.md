# Velocity Rush — 3D supercar racing (browser vertical slice)

Velocity Rush is a browser-playable 3D racing game that lives at **`/racing`** on this site.
It is built with **Three.js (WebGL 2)** inside the existing Next.js app, plus a separate
**authoritative Node.js race server** (`racing-server/`) for real online multiplayer.

The brief asked for an AAA game and recommended Unreal Engine 5 for the native version. That is
not something that can be produced in this repository; what is here is the browser prototype path
the brief also describes, built as a polished vertical slice. Everything listed under "Implemented"
works today; everything under "Not implemented" is called out explicitly instead of being faked.

---

## Quick start (local)

Requirements: **Node.js 22.18+** (the server and tests run TypeScript directly via Node's type
stripping) and a browser with WebGL 2.

```bash
npm install
npm run racing:server     # race server on ws://localhost:8787 (separate terminal)
npm run dev               # site on http://localhost:3000
```

Open <http://localhost:3000/racing>. In development the game automatically offers the local race
server (`ws://<host>:8787`) in the **Online** menu, so two browser windows (or two devices on the
same LAN) can race each other.

Tests (no browser needed):

```bash
npm run racing:physics    # every car × every track driven by the AI; checks laps, top speed, 0-100, NaNs
npm run racing:test       # needs the server running: 3 real WebSocket clients race; checks rooms,
                          # ready gating, grid, anti-cheat, reconnection, server-timed laps, results
```

---

## Controls

| Action | Keyboard (rebindable) | Gamepad | Touch |
| --- | --- | --- | --- |
| Accelerate / brake & reverse | W / S, ↑ / ↓ | RT / LT | GAS / BRAKE pedals |
| Steer | A / D, ← / → | Left stick | ◀ ▶ buttons, steering wheel, or tilt (gyro) |
| Handbrake | Space | A | HB |
| Nitro | N, Left Alt | X | NOS |
| Shift up / down (manual) | Left Shift / Left Ctrl (also E / Q) | RB / LB | G+ / G− |
| Camera (chase, far, hood, bumper, cockpit, cinematic) | C | Y | CAM |
| Look back | B | D-pad down | BACK |
| Reset car to track | R | Back | pause menu |
| Pause | Esc / P | Start | II button |
| Indicators / hazards / headlights / horn | Z / X / H / L / G | D-pad / R3 | — |

Touch layout options (Settings → Touch): steering scheme, sensitivity, button size, opacity,
left-handed swap, vibration. Gamepads rumble on impacts and slides (where the browser supports it).

---

## What is implemented

**Driving model** (`src/racing/engine/vehicle.ts`) — four-wheel planar model on the track surface:
per-wheel load transfer (longitudinal + lateral, roll distribution), Pacejka-style lateral tyre
curve with a friction ellipse for combined slip, engine torque curves (NA and turbo shapes), real
gear ratios and final drive, clutch slip at launch, rev limiter, engine braking, aero drag and
downforce (front/rear balance), rolling resistance, gravity on gradients, wet/off-road grip,
handbrake lock-up drifting, nitro, damage that costs power. Assists: ABS, traction control,
stability control, automatic/manual gearbox. Handling presets: **Arcade / Sport / Simulation**.
Collisions: barrier impulses with friction, car-to-car impulses, sparks, body deformation.

**Cars** (`src/racing/shared/cars.ts`) — five original designs (no real brands or logos):
Vantor GT (front-V8 exotic), Strada RS (AWD tuned), Aurion S (mid-V10 supercar), Kaiju X Hybrid
(1,000+ hp hypercar), Apex RS-T (track car), each with distinct mass, torque curve, gearing,
drivetrain, grip, aero and engine sound. Procedural 3D models with lofted bodies, wheel arches,
tinted glass, painted roof, interior with steering wheel and a live cockpit display, working
headlights/brake/reverse/indicator lights, nitro flames, steering, wheel spin, suspension travel,
body pitch/roll, and a detail LOD (small parts and interiors drop at distance).

**Garage** — paint (palette + free colour picker), finishes (metallic/gloss/matte/pearl),
three rim styles and colours, spoilers (none/lip/wing/GT wing), aero kit (affect downforce),
performance upgrades (engine/tyres/weight), buying cars with credits, 3D orbit inspection.

**Environments** (`src/racing/engine/world.ts`, `sky.ts`):

1. **Apex International** — professional circuit: grandstands with crowds, pit building and pit
   lane, start gantry with working start lights, curbs, gravel traps, Armco, tyre walls, billboards.
2. **Neon Harbor** — night city street circuit: instanced skyline with lit windows, neon signs,
   street lights, traffic lights, tunnel with lighting, harbour water, containers and cranes.
3. **Serra Coast** — coastal mountain pass: elevation changes, cliffs to the ocean, bridge over a
   ravine, tunnel through a headland, pine forest, guardrails, petrol station, lighthouse.
4. **Mirage Airfield** — desert airport: runway markings, drag strip, speed trap, hangars, control
   tower, parked aircraft, dunes, heat haze (Ultra).

Shared: PBR materials, procedural asphalt with normal/roughness maps, wet roads with puddles,
rain, lightning and thunder, Preetham sky with animated clouds, stars and moon, day/sunset/night,
fog, reflection probe (PMREM) regenerated with the time of day, camera-following shadow map,
skid marks, tyre smoke, dust, spray, sparks, tunnel light dimming. Free roam adds AI traffic, a
running day/night clock and changing weather.

**Game modes** — circuit race vs AI (1–7 opponents, rookie/pro/elite), sprint, time trial with a
ghost of your best lap, drift challenge (angle × speed × combo), 402 m drag race (reaction time,
ET, trap speed), speed trap, free roam, **career** (10 events with star targets and unlocks),
**daily challenge**, achievements, personal records, XP/levels/credits, results screen with a
full **replay** (cinematic trackside cameras).

**Online multiplayer** (`racing-server/server.ts`, `src/racing/engine/net.ts`):

- Real players over WebSockets — no bots stand in for players.
- **Quick match** (ranked public lobbies, auto-start), **private rooms** with 5-letter codes and
  invite links (`/racing?room=CODE`), **tournament series** (3 or 5 races with points),
  **online time trial**, 2–12 players per room.
- Server-authoritative: synchronised start on the server clock, grid assignment, lap and checkpoint
  refereeing on the server's own copy of the track, finish order and results, XP and Elo rating.
- Anti-cheat: per-car speed limits derived from the car's specs and upgrades, teleport/speed
  rejection with position correction, off-course rejection, jump-start detection, physically
  impossible lap times discarded, validated respawns only, message rate limiting, input sanitising.
- Latency handling: clock sync, 110 ms interpolation buffer with extrapolation, 20 Hz state.
- Reconnection: a stable identity token; dropped players keep their slot for 45 s and rejoin the
  running race at their last validated position.
- Persistent profiles (name, level, XP, rating, wins) and a **global leaderboard** of validated laps,
  stored as JSON on the server (`DATA_DIR`).
- Regional selection: list several servers in `NEXT_PUBLIC_RACING_SERVERS`; the client pings each
  `/health` endpoint and pre-selects the lowest latency.

**Performance** — Low / Medium / Ultra presets (pixel-ratio cap, shadows on/off and resolution,
soft shadows, bloom + heat haze, particle and tree density, HRTF audio), adaptive resolution that
holds the frame rate, instanced and chunked scenery for frustum culling, car detail LOD, compiled
shaders before the start. Mobile defaults to Low.

**Audio** — fully synthesized Web Audio: engine voices built from each car's cylinder count and
character, turbo spool and blow-off, overrun crackle, hybrid whine, shift cuts, tyre squeal, wind,
road and gravel rumble, collisions, rain and thunder, ambience per environment, tunnel reverb,
3D-positioned opponent engines.

---

## Not implemented (honest scope)

- **Native builds** (Unreal Engine 5, Windows/macOS executables, Android/iOS store apps). The game
  runs in desktop and mobile browsers. Wrapping it with Capacitor (mobile) or Tauri/Electron
  (desktop) is possible but not set up here.
- Licensed/real-world car models, logos or recorded engine samples — all cars and sounds are
  original and procedural by design.
- Ray tracing / true global illumination (WebGL); the look uses PBR + environment probes + shadows.
- Player accounts with passwords/OAuth. Online identity is an anonymous device token; profiles are
  server-side but not tied to a login. (The site's Supabase project could back this in future.)
- Horizontal scaling of a single region: each server process holds its rooms in memory. Scale by
  running one process per region (or put a room directory in front of several processes).
- Friends lists / invites inside the game (invites are shareable room links).
- Tyre mesh deformation and mechanical part damage (damage dents bodywork and reduces power).
- Real-device testing on phones/tablets has not been done by this change; touch controls, tilt
  steering and quality presets were built for them and tested in desktop browser emulation only.

---

## Deploying

### Website (Vercel, as today)

Nothing changes for the site deploy. Add one environment variable in the Vercel project:

```
NEXT_PUBLIC_RACING_SERVERS=Asia|wss://race-sin.example.com,Europe|wss://race-fra.example.com
```

(It is read at build time, so redeploy after setting it.) Without it, the Online menu explains that
no server is configured and lets players paste a server address. Vercel cannot host the race server
itself because serverless functions do not keep WebSocket connections open.

### Race server

The server is a single Node process (`racing-server/server.ts`) that only needs `ws` and the shared
rules in `src/racing/shared/`. Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | HTTP + WebSocket port |
| `REGION` | `local` | Name shown to players and in `/health` |
| `DATA_DIR` | `racing-server/data` | Where profiles and the leaderboard JSON are saved |

Endpoints: `GET /health` (status, players online), `GET /leaderboard?track=<id>`, WebSocket on `/`.

**Docker** (any container host):

```bash
docker build -f racing-server/Dockerfile -t velocity-rush-server .
docker run -d -p 8787:8787 -v vr-data:/data -e REGION="Europe" velocity-rush-server
```

**Fly.io** (example config in `racing-server/fly.toml.example`):

```bash
cp racing-server/fly.toml.example fly.toml   # edit app name and region
fly launch --no-deploy
fly volumes create vr_data --size 1
fly deploy
```

Repeat per region (`--region fra`, `iad`, …) with a different `REGION` value, then list each
`wss://` URL in `NEXT_PUBLIC_RACING_SERVERS`.

**Render / Railway / a VPS** — run `npm ci --omit=dev && npm run racing:server` behind a TLS proxy.
The site is served over HTTPS, so browsers require **`wss://`** (TLS) for the race server; any
platform that terminates TLS for you (Fly, Render, Railway) works, or put Caddy/Nginx in front on a VPS.

---

## Code map

```
src/app/racing/            Next.js route (client-only dynamic import, own font)
src/racing/shared/         Rules shared by client and server: tracks, track geometry & lap
                           referee, car specs, wire protocol, XP curve
src/racing/engine/         Game engine: vehicle physics, collisions, AI, world builder, sky,
                           car models, effects, camera, audio, input, networking, renderer,
                           showroom, progression, session orchestrator (game.ts)
src/racing/ui/             React UI: app shell, HUD, touch controls, menus and screens
racing-server/             Authoritative multiplayer server, Dockerfile, tests
```
