import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Project, BlogPost } from "@/lib/types";

export const revalidate = 60;

export default async function Home() {
  const supabase = await createClient();

  const [{ data: projects }, { data: posts }] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("published", true)
      .order("featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(3)
      .returns<Project[]>(),
    supabase
      .from("blog_posts")
      .select("*")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(3)
      .returns<BlogPost[]>(),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <section>
        <h1 className="text-4xl font-semibold tracking-tight">
          Hi, I&apos;m Satish Kumar.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          Creative motion graphic designer, published author, and animator.
          I build visual stories and the sites that show them off.
        </p>
      </section>

      <section className="mt-16">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Featured projects</h2>
          <Link
            href="/projects"
            className="text-sm text-zinc-500 hover:text-foreground"
          >
            View all
          </Link>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {projects?.length ? (
            projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.slug}`}
                className="rounded-lg border border-black/10 p-5 transition-colors hover:border-black/30 dark:border-white/10 dark:hover:border-white/30"
              >
                <h3 className="font-medium">{project.title}</h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {project.description}
                </p>
              </Link>
            ))
          ) : (
            <p className="text-sm text-zinc-500">
              No projects published yet.
            </p>
          )}
        </div>
      </section>

      <section className="mt-16">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Latest from the blog</h2>
          <Link
            href="/blog"
            className="text-sm text-zinc-500 hover:text-foreground"
          >
            View all
          </Link>
        </div>
        <div className="mt-6 flex flex-col gap-4">
          {posts?.length ? (
            posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="rounded-lg border border-black/10 p-5 transition-colors hover:border-black/30 dark:border-white/10 dark:hover:border-white/30"
              >
                <h3 className="font-medium">{post.title}</h3>
                {post.excerpt && (
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {post.excerpt}
                  </p>
                )}
              </Link>
            ))
          ) : (
            <p className="text-sm text-zinc-500">No posts published yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
