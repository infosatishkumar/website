import type { Metadata } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import SmoothScroll from "@/components/SmoothScroll";
import Cursor from "@/components/Cursor";
import RevealObserver from "@/components/RevealObserver";
import { jsonLdScript, personJsonLd, siteUrl, websiteJsonLd } from "@/lib/site";

const body = Geist({
  variable: "--font-body",
  subsets: ["latin"],
});

const display = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const description =
  "Satish Kumar is a creative motion graphic designer, animator, and published author based in Bengaluru.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Satish Kumar — Motion Designer & Author",
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "profile",
    url: siteUrl,
    siteName: "Satish Kumar",
    title: "Satish Kumar — Motion Designer & Author",
    description,
    firstName: "Satish",
    lastName: "Kumar",
  },
  twitter: { card: "summary_large_image", creator: "@infosatishkumar" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${body.variable} ${display.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(personJsonLd)}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(websiteJsonLd)}
        />
        <SmoothScroll />
        <Cursor />
        <RevealObserver />
        <Nav />
        <main className="flex flex-1 flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
