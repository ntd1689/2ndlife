import type { MetadataRoute } from "next";

// Web App Manifest — makes the site installable as a PWA on Android/desktop
// (and via Add to Home Screen on iOS). Served by Next at /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "2ndLife — Buy. Sell. Bid. Repeat.",
    short_name: "2ndLife",
    description: "Jamaica's local marketplace for buying, selling, and renting second-hand.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FBF7EF",
    theme_color: "#FBF7EF",
    categories: ["shopping", "business"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
