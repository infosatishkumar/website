"use client";

import { useActionState } from "react";
import { submitContactMessage, type ContactFormState } from "./actions";

const initialState: ContactFormState = { status: "idle" };

const fieldClass =
  "w-full border-b border-line bg-transparent py-3 text-lg outline-none transition-colors placeholder:text-ink-soft/60 focus:border-ink";

export default function ContactForm() {
  const [state, formAction, pending] = useActionState(
    submitContactMessage,
    initialState,
  );

  if (state.status === "success") {
    return (
      <div role="status" className="py-10">
        <p className="font-display text-4xl">
          Thank you <em className="text-accent">✦</em>
        </p>
        <p className="mt-3 text-ink-soft">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <label className="block">
        <span className="text-sm text-ink-soft">Your name</span>
        <input name="name" type="text" required className={fieldClass} />
      </label>
      <label className="block">
        <span className="text-sm text-ink-soft">Email</span>
        <input name="email" type="email" required className={fieldClass} />
      </label>
      <label className="block">
        <span className="text-sm text-ink-soft">Tell me about your project</span>
        <textarea
          name="message"
          rows={4}
          required
          className={`${fieldClass} resize-none`}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-ink px-8 py-4 text-paper transition-colors hover:bg-accent disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send message →"}
      </button>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-accent">
          {state.message}
        </p>
      )}
    </form>
  );
}
