import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { BlogPost } from "@/lib/types";

export const metadata: Metadata = { title: "Blog — Satish Kumar" };
export const revalidate = 60;

export default async function BlogPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("published", true)
    .order("published_at", { ascending: false })
    .returns<BlogPost[]>();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Blog</h1>
      <div className="mt-10 flex flex-col gap-4">
        {posts?.length ? (
          posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="rounded-lg border border-black/10 p-5 transition-colors hover:border-black/30 dark:border-white/10 dark:hover:border-white/30"
            >
              <h2 className="font-medium">{post.title}</h2>
              {post.published_at && (
                <p className="mt-1 text-xs text-zinc-500">
                  {new Date(post.published_at).toLocaleDateString()}
                </p>
              )}
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
    </div>
  );
}
