import type { Metadata } from "next";
import ContactForm from "./ContactForm";

export const metadata: Metadata = { title: "Contact — Satish Kumar" };

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Get in touch</h1>
      <p className="mt-4 max-w-xl text-zinc-600 dark:text-zinc-400">
        Have a project in mind or just want to say hi? Send a message below.
      </p>
      <ContactForm />
    </div>
  );
}
