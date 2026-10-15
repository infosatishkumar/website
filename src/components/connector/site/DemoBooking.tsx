"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Icon from "../Icon";
import { LogoMark } from "../Logo";

const API = "/api/index.php?action=";
const CONTACT = "contact@satishkumar.net";

/** Fallback when the site has no booking server: Mon–Sat, 10:00–18:00 IST, every 30 min. */
function localSlots(): string[] {
  const out: string[] = [];
  const now = Date.now() + 2 * 3600_000;
  for (let d = 0; d < 30; d++) {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() + d);
    const ymd = day.toISOString().slice(0, 10);
    const dow = new Date(`${ymd}T12:00:00+05:30`).getUTCDay();
    if (dow === 0) continue;
    for (let m = 10 * 60; m < 18 * 60; m += 30) {
      const t = new Date(`${ymd}T${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00+05:30`);
      if (t.getTime() > now) out.push(t.toISOString());
    }
  }
  return out;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function DemoBookingModal({ onClose }: { onClose: () => void }) {
  const [slots, setSlots] = useState<string[] | null>(null);
  const [server, setServer] = useState(true);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [day, setDay] = useState<Date | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "form" | "done">("pick");
  const [form, setForm] = useState({ name: "", email: "", company: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [when, setWhen] = useState("");
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  useEffect(() => {
    fetch(`${API}demo_slots`)
      .then((r) => (r.headers.get("content-type")?.includes("json") ? r.json() : Promise.reject()))
      .then((d: { slots: string[] }) => setSlots(d.slots))
      .catch(() => {
        setServer(false);
        setSlots(localSlots());
      });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const byDay = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of slots ?? []) {
      const k = dayKey(new Date(s));
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return m;
  }, [slots]);

  const cells = useMemo(() => {
    const first = new Date(month);
    const lead = (first.getDay() + 6) % 7; // Monday first
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))] as (Date | null)[];
  }, [month]);

  const daySlots = day ? (byDay.get(dayKey(day)) ?? []) : [];
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const fmtFull = (iso: string) =>
    new Date(iso).toLocaleString([], { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });

  const book = async () => {
    if (!slot) return;
    setBusy(true);
    setError("");
    try {
      if (!server) throw new Error("offline");
      const r = await fetch(`${API}demo_book`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-SMC": "1" },
        body: JSON.stringify({ ...form, slot }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Booking failed");
      setWhen(fmtFull(slot));
      setStep("done");
    } catch (e) {
      if (e instanceof Error && e.message !== "offline") setError(e.message);
      else {
        const body = encodeURIComponent(`Hi, I'd like a demo on ${fmtFull(slot)} (${tz}).\n\nName: ${form.name}\nCompany: ${form.company}\n\n${form.notes}`);
        window.location.href = `mailto:${CONTACT}?subject=${encodeURIComponent("Demo request")}&body=${body}`;
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-night/60 p-3" onClick={onClose} role="dialog" aria-modal="true" aria-label="Book a demo">
      <div className="menu-in relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl md:flex-row" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-muted hover:bg-canvas" aria-label="Close">
          <Icon name="close" size={20} />
        </button>
        {/* summary */}
        <div className="border-b border-line p-7 md:w-72 md:shrink-0 md:border-b-0 md:border-r">
          <LogoMark size={36} />
          <h2 className="mt-4 text-2xl font-bold text-ink">Social Media Connector Demo</h2>
          <p className="mt-3 flex items-center gap-2 font-bold text-ink-2">
            <Icon name="clock" size={18} /> 30 min
          </p>
          <p className="mt-3 flex items-start gap-2 text-sm text-ink-2">
            <Icon name="video" size={18} className="shrink-0" /> Video call — link sent after booking
          </p>
          <p className="mt-4 text-sm text-ink-2">Times are shown in your local timezone.</p>
          {slot && step !== "done" && (
            <p className="mt-5 rounded-xl bg-primary-soft p-3 text-sm font-bold text-primary">
              <Icon name="calendar" size={16} className="mr-1.5 inline" />
              {fmtFull(slot)}
            </p>
          )}
        </div>

        {/* steps */}
        <div className="flex-1 overflow-y-auto p-7">
          {step === "pick" && (
            <>
              <h3 className="text-xl font-bold text-ink">Select a date &amp; time</h3>
              {slots === null ? (
                <p className="mt-6 text-muted">Loading available times…</p>
              ) : (
                <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_190px]">
                  <div>
                    <div className="mb-4 flex items-center justify-center gap-6">
                      <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-full p-1.5 text-primary hover:bg-primary-soft" aria-label="Previous month">
                        <Icon name="chevronLeft" size={20} />
                      </button>
                      <p className="w-36 text-center font-bold text-ink">{month.toLocaleDateString([], { month: "long", year: "numeric" })}</p>
                      <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-full p-1.5 text-primary hover:bg-primary-soft" aria-label="Next month">
                        <Icon name="chevronRight" size={20} />
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                        <span key={d} className="pb-2 text-xs font-bold text-muted">{d}</span>
                      ))}
                      {cells.map((d, i) => {
                        if (!d) return <span key={`e${i}`} />;
                        const open = byDay.has(dayKey(d));
                        const sel = day && dayKey(day) === dayKey(d);
                        return (
                          <button
                            key={d.toISOString()}
                            type="button"
                            disabled={!open}
                            onClick={() => {
                              setDay(d);
                              setSlot(null);
                            }}
                            className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                              sel ? "bg-primary text-white" : open ? "bg-primary-soft text-primary hover:bg-primary-tint" : "font-normal text-muted"
                            }`}
                          >
                            {d.getDate()}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-5 text-sm font-bold text-ink">Time zone</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
                      <Icon name="globe" size={16} /> {tz}
                    </p>
                  </div>
                  <div>
                    {day ? (
                      <>
                        <p className="mb-3 text-sm font-bold text-ink">{day.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</p>
                        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                          {daySlots.map((s) =>
                            slot === s ? (
                              <div key={s} className="grid grid-cols-2 gap-2">
                                <span className="flex items-center justify-center rounded-lg bg-ink-2 py-3 text-sm font-bold text-white">{fmtTime(s)}</span>
                                <button type="button" onClick={() => setStep("form")} className="rounded-lg bg-primary py-3 text-sm font-bold text-white">
                                  Next
                                </button>
                              </div>
                            ) : (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setSlot(s)}
                                className="w-full rounded-lg border-2 border-primary-tint py-3 text-sm font-bold text-primary hover:border-primary"
                              >
                                {fmtTime(s)}
                              </button>
                            ),
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted">Pick a highlighted date to see available times.</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {step === "form" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                book();
              }}
            >
              <button type="button" onClick={() => setStep("pick")} className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-primary">
                <Icon name="chevronLeft" size={16} /> Back
              </button>
              <h3 className="text-xl font-bold text-ink">Enter details</h3>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Lbl label="Name *">
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field" />
                </Lbl>
                <Lbl label="Email *">
                  <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="field" />
                </Lbl>
                <Lbl label="Company">
                  <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="field" />
                </Lbl>
                <div className="sm:col-span-2">
                  <Lbl label="What would you like to see?">
                    <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="field" placeholder="Approvals, AI Agent, Instagram scheduling…" />
                  </Lbl>
                </div>
              </div>
              {error && <p className="mt-4 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}
              <button type="submit" disabled={busy} className="btn btn-primary mt-6 disabled:opacity-50">
                {busy ? "Booking…" : "Schedule event"}
              </button>
            </form>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center py-10 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-tint text-success">
                <Icon name="check" size={32} strokeWidth={2.6} />
              </span>
              <h3 className="mt-5 text-2xl font-bold text-ink">You are scheduled</h3>
              <p className="mt-2 text-ink-2">{when}</p>
              <p className="mt-1 text-sm text-muted">A confirmation is on its way to {form.email}.</p>
              <button type="button" onClick={onClose} className="btn btn-primary mt-6">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Lbl({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium text-ink">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

/** Button that opens the booking popup. */
export default function DemoButton({ className, children }: { className: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && <DemoBookingModal onClose={() => setOpen(false)} />}
    </>
  );
}
