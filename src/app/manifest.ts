import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DuitLo — Keuangan Pribadi",
    short_name: "DuitLo",
    description: "Pantau arus kas, investasi, dan trading dalam satu ruang keuangan pribadi yang tenang.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f4fbf6",
    theme_color: "#f4fbf6",
    orientation: "any",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/fintrack-v2/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/fintrack-v2/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/fintrack-v2/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/fintrack-v2/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Buka transaksi", short_name: "Transaksi", url: "/transactions", icons: [{ src: "/icons/fintrack-v2/icon-192.png", sizes: "192x192" }] },
      { name: "Lihat dashboard", short_name: "Dashboard", url: "/dashboard", icons: [{ src: "/icons/fintrack-v2/icon-192.png", sizes: "192x192" }] },
    ],
    share_target: {
      action: "/shared-receipt-intake",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [{ name: "receipt", accept: ["image/jpeg", "image/png", "image/webp", "application/pdf"] }] as never,
      },
    },
  };
}
