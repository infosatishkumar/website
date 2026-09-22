import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { BlogPost } from "@/lib/types";

export const metadata: Metadata = { title: "Journal — Satish Kumar" };
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
    <section className="mx-auto w-full max-w-6xl px-5 pt-16 sm:px-8 sm:pt-24">
      <p data-reveal className="text-sm tracking-widest text-ink-soft uppercase">
        Journal
      </p>
      <h1
        data-reveal
        className="mt-4 mb-16 font-display text-6xl leading-none sm:text-9xl"
      >
        Notes &amp; <em className="text-accent">stories</em>
      </h1>

      {posts?.length ? (
        <ul className="border-t border-line">
          {posts.map((post) => (
            <li key={post.id} data-reveal className="border-b border-line">
              <Link
                href={`/blog/${post.slug}`}
                className="group grid gap-2 py-8 sm:grid-cols-[10rem_1fr] sm:gap-8"
              >
                <span className="text-sm text-ink-soft">
                  {post.published_at &&
                    new Date(post.published_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                </span>
                <span>
                  <span className="block font-display text-3xl transition-transform duration-500 group-hover:translate-x-2 group-hover:italic sm:text-4xl">
                    {post.title}
                  </span>
                  {post.excerpt && (
                    <span className="mt-2 block text-ink-soft">
                      {post.excerpt}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-soft">First entries coming soon.</p>
      )}
    </section>
  );
}
