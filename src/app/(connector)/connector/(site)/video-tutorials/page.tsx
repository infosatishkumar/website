import type { Metadata } from "next";
import VideoGallery from "@/components/connector/site/VideoGallery";
import { Container, CtaBand, PageIntro } from "@/components/connector/site/Sections";
import { videos } from "@/lib/connector/data";

export const metadata: Metadata = { title: "Video tutorials" };

export default function VideoTutorialsPage() {
  return (
    <>
      <PageIntro eyebrow="Video tutorials" title="Learn by watching" sub="Short, focused walkthroughs for every feature." />
      <section className="py-20">
        <Container>
          <VideoGallery videos={videos} />
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
