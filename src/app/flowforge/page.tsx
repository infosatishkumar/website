import { connection } from "next/server";
import { isAuthed, passwordConfigured } from "@/lib/flowforge/auth";
import FlowForgeApp from "./FlowForgeApp";
import Login from "./Login";

export default async function FlowForgePage() {
  // Auth depends on runtime env and cookies, so never prerender this page.
  await connection();
  if (!(await isAuthed())) return <Login configured={passwordConfigured()} />;
  return <FlowForgeApp />;
}
