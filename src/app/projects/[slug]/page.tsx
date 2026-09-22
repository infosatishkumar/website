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
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  return { title: project ? `${project.title} — Satish Kumar` : "Project" };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        {project.title}
      </h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
        {project.description}
      </p>

      {(project.project_url || project.repo_url) && (
        <div className="mt-6 flex gap-4 text-sm">
          {project.project_url && (
            <a
              href={project.project_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              Live site
            </a>
          )}
          {project.repo_url && (
            <a
              href={project.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              Source
            </a>
          )}
        </div>
      )}

      {project.content && (
        <div className="prose prose-zinc mt-10 max-w-none whitespace-pre-wrap dark:prose-invert">
          {project.content}
        </div>
      )}
    </div>
  );
}
