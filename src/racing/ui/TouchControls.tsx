"use client";

import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { Input } from "../engine/input";
import type { Settings } from "../engine/settings";
import s from "./racing.module.css";

type Key = "left" | "right" | "gas" | "brake" | "hand" | "nitro" | "up" | "down" | "look";

/**
 * On-screen controls for phones and tablets. Three steering schemes:
 * left/right buttons, a draggable steering wheel, or device tilt.
 * Size, opacity and handedness come from settings.
 */
export default function TouchControls({ input, settings, onCamera }: { input: Input; settings: Settings; onCamera: () => void }) {
  const [down, setDown] = useState<Record<Key, boolean>>({ left: false, right: false, gas: false, brake: false, hand: false, nitro: false, up: false, down: false, look: false });
  const wheelRef = useRef<HTMLDivElement>(null);
  const wheelPointer = useRef<number | null>(null);
  const wheelStart = useRef(0);
  const [wheelAngle, setWheelAngle] = useState(0);
  const [tiltOk, setTiltOk] = useState<boolean | null>(null);

  useEffect(() => {
    input.setTouch({ active: true });
    return () => input.setTouch({ active: false, steer: 0, throttle: 0, brake: 0 });
  }, [input]);

  useEffect(() => {
    input.setTouch({
      throttle: down.gas ? 1 : 0,
      brake: down.brake ? 1 : 0,
      handbrake: down.hand,
      nitro: down.nitro,
      shiftUp: down.up,
      shiftDown: down.down,
      lookBack: down.look,
      ...(settings.touchScheme === "buttons" ? { steer: (down.right ? 1 : 0) - (down.left ? 1 : 0) } : {}),
    });
  }, [down, input, settings.touchScheme]);

  useEffect(() => {
    if (settings.touchScheme === "tilt" && !input.tiltEnabled) {
      // iOS requires a user gesture for permission; the calibrate button triggers it.
      void input.enableTilt().then((ok) => setTiltOk(ok));
    }
  }, [settings.touchScheme, input]);

  const press = (k: Key, v: boolean) => (e: RPointerEvent) => {
    e.preventDefault();
    if (v) {
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
    }
    setDown((d) => (d[k] === v ? d : { ...d, [k]: v }));
  };

  const btn = (k: Key, label: string, extra = "") => (
    <div
      role="button"
      aria-label={label}
      className={`${s.tbtn} ${extra} ${down[k] ? s.tbtnOn : ""} ${k === "gas" ? s.tbtnGas : ""}`}
      onPointerDown={press(k, true)}
      onPointerUp={press(k, false)}
      onPointerCancel={press(k, false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </div>
  );

  const wheelMove = (e: RPointerEvent) => {
    if (wheelPointer.current !== e.pointerId || !wheelRef.current) return;
    const r = wheelRef.current.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const a = Math.atan2(e.clientY - cy, e.clientX - cx);
    let d = a - wheelStart.current;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const ang = Math.max(-2.1, Math.min(2.1, d));
    setWheelAngle(ang);
    input.setTouch({ steer: Math.max(-1, Math.min(1, (ang / 1.6) * settings.touchSensitivity)) });
  };

  const style = { "--ts": settings.touchSize, "--to": settings.touchOpacity } as React.CSSProperties;
  const leftSide = settings.leftHanded ? "right" : "left";
  const rightSide = settings.leftHanded ? "left" : "right";
  const edge = (side: string) => ({ [side]: `max(16px, env(safe-area-inset-${side}))` });

  return (
    <div className={s.touch} style={style}>
      <div className={s.tpad} style={edge(leftSide)}>
        {settings.touchScheme === "buttons" && (
          <>
            {btn("left", "◀", s.tbtnTall)}
            {btn("right", "▶", s.tbtnTall)}
          </>
        )}
        {settings.touchScheme === "wheel" && (
          <div
            ref={wheelRef}
            className={s.wheel}
            style={{ transform: `rotate(${wheelAngle}rad)` }}
            role="slider"
            aria-label="Steering wheel"
            aria-valuenow={Math.round(wheelAngle * 100)}
            onPointerDown={(e) => {
              e.preventDefault();
              try {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              } catch {
                /* pointer already released */
              }
              wheelPointer.current = e.pointerId;
              const r = e.currentTarget.getBoundingClientRect();
              wheelStart.current = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) - wheelAngle;
            }}
            onPointerMove={wheelMove}
            onPointerUp={() => { wheelPointer.current = null; setWheelAngle(0); input.setTouch({ steer: 0 }); }}
            onPointerCancel={() => { wheelPointer.current = null; setWheelAngle(0); input.setTouch({ steer: 0 }); }}
          />
        )}
        {settings.touchScheme === "tilt" && (
          <div className={`${s.tbtn} ${s.tbtnSmall}`} role="button" onPointerDown={() => void input.enableTilt().then(setTiltOk)}>
            {tiltOk === false ? "NO GYRO" : "TILT"}
          </div>
        )}
        {btn("hand", "HB", s.tbtnSmall)}
      </div>
      <div className={s.tpad} style={edge(rightSide)}>
        {btn("nitro", "NOS", s.tbtnSmall)}
        {btn("brake", "BRAKE", s.tbtnTall)}
        {btn("gas", "GAS", s.tbtnTall)}
      </div>
      <div className={s.tside} style={edge(rightSide)}>
        <div role="button" aria-label="Camera" className={`${s.tbtn} ${s.tbtnSmall}`} onPointerDown={(e) => { e.preventDefault(); onCamera(); }}>CAM</div>
        {btn("look", "BACK", s.tbtnSmall)}
        {!settings.autoGear && (
          <>
            {btn("up", "G+", s.tbtnSmall)}
            {btn("down", "G−", s.tbtnSmall)}
          </>
        )}
      </div>
    </div>
  );
}
