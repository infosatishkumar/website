import Header from "@/components/connector/site/Header";
import Footer from "@/components/connector/site/Footer";
import ChatWidget from "@/components/connector/site/ChatWidget";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      <ChatWidget />
    </>
  );
}
