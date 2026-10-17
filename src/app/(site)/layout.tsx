import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import SmoothScroll from "@/components/SmoothScroll";
import Cursor from "@/components/Cursor";
import RevealObserver from "@/components/RevealObserver";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SmoothScroll />
      <Cursor />
      <RevealObserver />
      <Nav />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
    </>
  );
}
