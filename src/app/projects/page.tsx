import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";
import WorkList from "@/components/WorkList";

export const metadata: Metadata = { title: "Work — Satish Kumar" };
export const revalidate = 60;

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("published", true)
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .returns<Project[]>();

  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-16 pb-10 sm:px-8 sm:pt-24">
      <p data-reveal className="text-sm tracking-widest text-ink-soft uppercase">
        Work · {projects?.length ?? 0} projects
      </p>
      <h1
        data-reveal
        className="mt-4 mb-16 font-display text-6xl leading-none sm:text-9xl"
      >
        Things I&apos;ve <em className="text-accent">made</em>
      </h1>
      <div data-reveal>
        <WorkList projects={projects ?? []} />
      </div>
    </section>
  );
}
