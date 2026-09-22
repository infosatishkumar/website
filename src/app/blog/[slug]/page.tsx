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
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  return { title: post ? `${post.title} — Satish Kumar` : "Post" };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{post.title}</h1>
      {post.published_at && (
        <p className="mt-2 text-sm text-zinc-500">
          {new Date(post.published_at).toLocaleDateString()}
        </p>
      )}
      <div className="prose prose-zinc mt-10 max-w-none whitespace-pre-wrap dark:prose-invert">
        {post.content}
      </div>
    </article>
  );
}
