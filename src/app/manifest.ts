import type { MetadataRoute } from "next";

// Web app manifest, served at /manifest.webmanifest and auto-linked by Next from
// this app/manifest.ts route. Colors match the Quiet Luxury theme in globals.css:
// --background warm bone #F4F0E9. The mark sits on the warm ivory app chrome.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Emmanuil",
    short_name: "Emmanuil",
    // Next.js manifest() is synchronous — locale-aware strings (getTranslations) aren't available here; English only.
    description: "Your relationship portfolio + AI assistant",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F0E9",
    theme_color: "#F4F0E9",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
