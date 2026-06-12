import type { MetadataRoute } from "next";

// Web app manifest, served at /manifest.webmanifest and auto-linked by Next from
// this app/manifest.ts route. Colors match the shadcn theme in globals.css:
// --background oklch(1 0 0) = #ffffff. The dark mark sits on the white app chrome.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Emmanuil",
    short_name: "Emmanuil",
    description: "Your relationship portfolio + AI assistant",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
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
