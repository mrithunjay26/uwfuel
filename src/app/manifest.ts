import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UW Fuel: Macro & Meal Planner",
    short_name: "UW Fuel",
    description:
      "Track campus dining, macros, and budget, powered by an AI you control. Your data lives in your own database.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ece9f7",
    theme_color: "#7c6cf0",
    categories: ["health", "food", "lifestyle", "education"],
    icons: [
      { src: "/icons/Icon-152.png", sizes: "152x152", type: "image/png" },
      { src: "/icons/Icon-167.png", sizes: "167x167", type: "image/png" },
      { src: "/icons/Icon-180.png", sizes: "180x180", type: "image/png" },
      { src: "/icons/Icon-256.png", sizes: "256x256", type: "image/png", purpose: "any" },
      { src: "/icons/Icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/Icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
