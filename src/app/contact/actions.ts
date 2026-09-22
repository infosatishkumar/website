"use server";

import { createClient } from "@/lib/supabase/server";

export type ContactFormState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function submitContactMessage(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || !email || !message) {
    return { status: "error", message: "All fields are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("contact_messages")
    .insert({ name, email, message });

  if (error) {
    return {
      status: "error",
      message: "Something went wrong. Please try again.",
    };
  }

  return { status: "success", message: "Thanks — I'll get back to you soon." };
}
