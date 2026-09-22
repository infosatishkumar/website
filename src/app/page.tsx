import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { BlogPost, Project } from "@/lib/types";
import WorkList from "@/components/WorkList";
import RotatingWord from "@/components/RotatingWord";

export const revalidate = 60;

const skills = [
  "Motion Graphics",
  "2D Animation",
  "Title Design",
  "Explainers",
  "Storytelling",
  "Brand Motion",
  "Writing",
];

export default async function Home() {
  const supabase = await createClient();
  const [{ data: projects }, { data: posts }] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("published", true)
      .order("featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(4)
      .returns<Project[]>(),
    supabase
      .from("blog_posts")
      .select("*")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(2)
      .returns<BlogPost[]>(),
  ]);

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-5 pt-16 pb-20 sm:px-8 sm:pt-28">
        <p data-reveal className="text-sm tracking-widest text-ink-soft uppercase">
          Satish Kumar — Bengaluru, India
        </p>
        <h1
          data-reveal
          className="mt-6 font-display text-[13vw] leading-[0.92] tracking-tight sm:text-[8.5rem]"
        >
          I make things
          <br />
          <RotatingWord words={["move.", "animate.", "tell stories."]} />
        </h1>
        <p
          data-reveal
          className="mt-10 max-w-xl text-lg leading-relaxed text-ink-soft"
        >
          Motion graphic designer, animator and published author. I turn ideas
          into movement — title sequences, brand motion, explainers and the
          occasional book.
        </p>
      </section>

      <div className="overflow-hidden border-y border-line py-5" aria-hidden>
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="flex items-center font-display text-3xl whitespace-nowrap italic sm:text-4xl"
                >
                  <span className="px-8">{skill}</span>
                  <span className="text-accent">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8">
        <div data-reveal className="mb-10 flex items-end justify-between">
          <h2 className="font-display text-4xl sm:text-6xl">
            Selected <em>work</em>
          </h2>
          <Link
            href="/projects"
            className="text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            All projects →
          </Link>
        </div>
        <div data-reveal>
          <WorkList projects={projects ?? []} />
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:grid-cols-[1fr_1.4fr] sm:px-8">
        <h2 data-reveal className="font-display text-4xl sm:text-6xl">
          A little <em>about</em> me
        </h2>
        <div data-reveal className="space-y-6 text-lg leading-relaxed text-ink-soft">
          <p>
            I&apos;m a designer who thinks in frames per second. My work sits
            where design, animation and storytelling meet — making ideas
            easier to understand and harder to forget.
          </p>
          <p>
            When I&apos;m not keyframing, I&apos;m writing. Being a published
            author shapes how I approach motion: every piece needs a beginning,
            a middle and an ending that lands.
          </p>
          <Link
            href="/about"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm text-paper transition-colors hover:bg-accent"
          >
            More about me →
          </Link>
        </div>
      </section>

      {posts && posts.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8">
          <h2 data-reveal className="mb-10 font-display text-4xl sm:text-6xl">
            From the <em>journal</em>
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                data-reveal
                className="group rounded-2xl bg-paper-2 p-8 transition-transform duration-500 hover:-rotate-1"
              >
                <h3 className="font-display text-3xl group-hover:italic">
                  {post.title}
                </h3>
                {post.excerpt && (
                  <p className="mt-3 text-ink-soft">{post.excerpt}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
