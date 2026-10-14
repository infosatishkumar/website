"use client";

import { useState } from "react";
import Icon from "../Icon";
import { LogoMark } from "../Logo";

const quick = ["How does the free trial work?", "Can I manage client accounts?", "Which networks are supported?"];

const answers: Record<string, string> = {
  [quick[0]]: "Every plan has a 14-day free trial with no card required. You can cancel any time.",
  [quick[1]]: "Yes — Premium and Ultimate include client groups, approvals and white-label reports.",
  [quick[2]]: "Facebook, Instagram, X, LinkedIn, TikTok, YouTube, Pinterest, Threads, Bluesky and Google Business Profile.",
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(true);
  const [log, setLog] = useState<{ from: "bot" | "me"; text: string }[]>([
    { from: "bot", text: "Hi! 👋 How can I help you today?" },
  ]);

  const ask = (q: string) =>
    setLog((l) => [
      ...l,
      { from: "me", text: q },
      { from: "bot", text: answers[q] ?? "Thanks! A specialist will reply by email shortly." },
    ]);

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3">
      {open && (
        <div className="menu-in flex h-[460px] w-[min(360px,calc(100vw-40px))] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl">
          <div className="flex items-center gap-3 bg-primary p-4 text-white">
            <LogoMark size={34} />
            <div className="flex-1">
              <p className="font-bold">Connector support</p>
              <p className="flex items-center gap-1.5 text-xs text-white/80">
                <span className="h-2 w-2 rounded-full bg-success" /> Typically replies in minutes
              </p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat">
              <Icon name="close" />
            </button>
          </div>
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto bg-canvas p-4">
            {log.map((m, k) => (
              <p
                key={k}
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.from === "bot" ? "self-start rounded-bl-sm bg-white text-ink" : "self-end rounded-br-sm bg-primary text-white"
                }`}
              >
                {m.text}
              </p>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line p-3">
            {quick.map((q) => (
              <button key={q} type="button" onClick={() => ask(q)} className="rounded-full border border-primary px-3 py-1 text-xs font-medium text-primary hover:bg-primary-soft">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
      {!open && teaser && (
        <div className="menu-in relative rounded-xl border border-line bg-white px-4 py-3 pr-9 text-sm font-medium text-ink shadow-xl">
          Hello, how can I help you today?
          <button type="button" className="absolute right-2 top-2 text-muted" onClick={() => setTeaser(false)} aria-label="Dismiss">
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setTeaser(false);
        }}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105"
        aria-label={open ? "Close chat" : "Open chat"}
      >
        <Icon name={open ? "close" : "chat"} size={26} />
      </button>
    </div>
  );
}
