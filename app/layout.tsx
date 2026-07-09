import "./globals.css";
import Link from "next/link";
import SiteHeader from "./components/SiteHeader";

export const metadata = {
  title: "2ndLife — Buy. Sell. Bid. Repeat.",
  description: "Give your items a second life in second hand. Jamaica's local marketplace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
        <footer className="wrap">
          <i>Give your items a second life in second hand.</i>
          <span style={{ margin: "0 8px" }}>·</span>
          <Link href="/about" style={{ textDecoration: "underline" }}>About us</Link>
        </footer>
      </body>
    </html>
  );
}
