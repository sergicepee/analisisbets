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
    startupImage: [
      { url: "/startup/iphone-428x926-3x.png", media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/startup/iphone-428x926-3x-landscape.png", media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" },
      { url: "/startup/iphone-414x896-3x.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/startup/iphone-414x896-3x-landscape.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" },
      { url: "/startup/iphone-414x896-2x.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { url: "/startup/iphone-414x896-2x-landscape.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" },
      { url: "/startup/iphone-390x844-3x.png", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/startup/iphone-390x844-3x-landscape.png", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" },
      { url: "/startup/iphone-375x812-3x.png", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/startup/iphone-375x812-3x-landscape.png", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" },
      { url: "/startup/iphone-414x736-3x.png", media: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/startup/iphone-414x736-3x-landscape.png", media: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" },
      { url: "/startup/iphone-375x667-2x.png", media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { url: "/startup/iphone-375x667-2x-landscape.png", media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" },
      { url: "/startup/iphone-320x568-2x.png", media: "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { url: "/startup/iphone-320x568-2x-landscape.png", media: "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" },
      { url: "/startup/iphone-320x480-2x.png", media: "(device-width: 320px) and (device-height: 480px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { url: "/startup/iphone-320x480-2x-landscape.png", media: "(device-width: 320px) and (device-height: 480px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" },
    ],
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
};
export const viewport: Viewport = { themeColor: "#080b0d", width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = getLang();
  return (
    <html lang={lang} data-theme={getTheme()}>
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
