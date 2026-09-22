import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { BlogPost } from "@/lib/types";

export const revalidate = 60;

async function getPost(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle<BlogPost>();
  return data;
}

export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  return { title: post ? `${post.title} — Satish Kumar` : "Journal" };
}

export default async function BlogPostPage({
  params,
}: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <article className="mx-auto w-full max-w-3xl px-5 pt-16 sm:px-8 sm:pt-24">
      <Link href="/blog" className="text-sm text-ink-soft hover:text-ink">
        ← Journal
      </Link>
      <h1
        data-reveal
        className="mt-8 font-display text-5xl leading-[1.02] sm:text-7xl"
      >
        {post.title}
      </h1>
      {post.published_at && (
        <p data-reveal className="mt-6 text-sm text-ink-soft">
          {new Date(post.published_at).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      )}
      <div
        data-reveal
        className="mt-12 border-t border-line pt-12 text-lg leading-relaxed whitespace-pre-wrap"
      >
        {post.content}
      </div>
    </article>
  );
}
