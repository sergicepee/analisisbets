import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { BRAND } from "@/lib/config";
import { I18nProvider } from "@/components/I18nProvider";
import { getLang, getTheme } from "@/lib/prefs";
import { AppSplash } from "@/components/AppSplash";

export const metadata: Metadata = {
  title: `${BRAND.name} · Análisis de fútbol`,
  description: "Estimaciones y estadísticas de fútbol para analizar partidos. No son garantías.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "PICKZONE",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
};
export function generateViewport(): Viewport {
  return { themeColor: getTheme() === "light" ? "#f4f6f8" : "#0f0f0f", width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = getLang();
  return (
    <html lang={lang} data-theme={getTheme()}>
      <head>
        <link rel="apple-touch-startup-image" href="/apple-launch.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AppSplash />
        <I18nProvider lang={lang}>
        <div className="mx-auto min-h-screen max-w-3xl pb-24 lg:max-w-[1400px] lg:pb-8">{children}</div>
        <BottomNav />
        </I18nProvider>
      </body>
    </html>
  );
}
