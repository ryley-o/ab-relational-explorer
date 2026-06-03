import type { Metadata } from "next";
import "./globals.css";
import { SiteChrome } from "@/components/site/SiteChrome";

export const metadata: Metadata = {
  title: "Art Blocks Relational Explorer",
  description: "Discover Art Blocks projects through semantic similarity — browse the generative art graph.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
