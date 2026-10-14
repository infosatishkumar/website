import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./connector.css";

const dm = DM_Sans({
  variable: "--font-dm",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Social Media Connector — Plan, publish and grow every channel",
    template: "%s · Social Media Connector",
  },
  description:
    "Social Media Connector links every social profile, review site and business listing into one dashboard for scheduling, analytics, reviews and listings.",
};

export default function ConnectorRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${dm.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
