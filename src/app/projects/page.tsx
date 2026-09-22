import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";

export const metadata: Metadata = { title: "Projects — Satish Kumar" };
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
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {projects?.length ? (
          projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.slug}`}
              className="rounded-lg border border-black/10 p-5 transition-colors hover:border-black/30 dark:border-white/10 dark:hover:border-white/30"
            >
              <h2 className="font-medium">{project.title}</h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {project.description}
              </p>
              {project.tags.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-zinc-600 dark:bg-white/10 dark:text-zinc-400"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              )}
            </Link>
          ))
        ) : (
          <p className="text-sm text-zinc-500">No projects published yet.</p>
        )}
      </div>
    </div>
  );
}
