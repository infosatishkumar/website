import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";

export const revalidate = 60;

async function getProject(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle<Project>();
  return data;
}

export async function generateMetadata({
  params,
}: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  return { title: project ? `${project.title} — Satish Kumar` : "Project" };
}

export default async function ProjectPage({
  params,
}: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();

  return (
    <article className="mx-auto w-full max-w-6xl px-5 pt-16 sm:px-8 sm:pt-24">
      <Link
        href="/projects"
        className="text-sm text-ink-soft hover:text-ink"
      >
        ← All work
      </Link>
      <h1
        data-reveal
        className="mt-8 font-display text-6xl leading-[0.95] sm:text-8xl"
      >
        {project.title}
      </h1>

      <div
        data-reveal
        className="mt-10 grid gap-8 border-y border-line py-8 sm:grid-cols-[2fr_1fr]"
      >
        <p className="text-xl leading-relaxed text-ink-soft">
          {project.description}
        </p>
        <dl className="space-y-4 text-sm">
          {project.tags.length > 0 && (
            <div>
              <dt className="text-ink-soft">Discipline</dt>
              <dd className="mt-1">{project.tags.join(", ")}</dd>
            </div>
          )}
          {project.project_url && (
            <div>
              <dt className="text-ink-soft">Live</dt>
              <dd className="mt-1">
                <a
                  href={project.project_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-accent"
                >
                  View project ↗
                </a>
              </dd>
            </div>
          )}
          {project.repo_url && (
            <div>
              <dt className="text-ink-soft">Source</dt>
              <dd className="mt-1">
                <a
                  href={project.repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-accent"
                >
                  Repository ↗
                </a>
              </dd>
            </div>
          )}
        </dl>
      </div>

      {project.content && (
        <div
          data-reveal
          className="mt-12 max-w-2xl text-lg leading-relaxed whitespace-pre-wrap"
        >
          {project.content}
        </div>
      )}
    </article>
  );
}
