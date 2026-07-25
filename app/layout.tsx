import "./globals.css";
import Link from "next/link";
import type { Metadata, Viewport } from "next";
import SiteHeader from "./components/SiteHeader";
import PWARegister from "./components/PWARegister";
import { CURRENT_VERSION } from "@/lib/changelog";
import { SITE_URL } from "@/lib/seo";

const TITLE = "2ndLife — Buy. Sell. Bid. Repeat.";
const DESCRIPTION =
  "Give your items a second life in second hand. 2ndLife is Jamaica's local marketplace to buy, sell, rent, and bid on second-hand items across every parish.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    // Inner pages set just their own name; this appends the brand.
    template: "%s · 2ndLife",
  },
  description: DESCRIPTION,
  applicationName: "2ndLife",
  appleWebApp: { capable: true, title: "2ndLife", statusBarStyle: "default" as const },
  alternates: { canonical: "/" },
  keywords: [
    "Jamaica marketplace",
    "buy and sell Jamaica",
    "second hand Jamaica",
    "used items Jamaica",
    "classifieds Jamaica",
    "2ndLife",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    siteName: "2ndLife",
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_JM",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "2ndLife" }],
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/icon-512.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#FBF7EF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PWARegister />
        <SiteHeader />
        {children}
        <footer className="wrap">
          <i>Give your items a second life in second hand.</i>
          <span style={{ margin: "0 8px" }}>·</span>
          <Link href="/about" style={{ textDecoration: "underline" }}>About us</Link>
          <span style={{ margin: "0 8px" }}>·</span>
          <Link href="/changelog" style={{ textDecoration: "underline" }}>What&apos;s New (v{CURRENT_VERSION})</Link>
        </footer>
      </body>
    </html>
  );
}
