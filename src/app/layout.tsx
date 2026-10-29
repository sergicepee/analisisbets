import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { BRAND } from "@/lib/config";
import { I18nProvider } from "@/components/I18nProvider";
import { getLang, getTheme } from "@/lib/prefs";

export const metadata: Metadata = {
  title: `${BRAND.name} · Análisis de fútbol`,
  description: "Estimaciones y estadísticas de fútbol para analizar partidos. No son garantías.",
};
export const viewport: Viewport = { themeColor: "#080b0d", width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = getLang();
  return (
    <html lang={lang} data-theme={getTheme()}>
      <body>
        <I18nProvider lang={lang}>
        <div className="mx-auto min-h-screen max-w-3xl pb-24 lg:max-w-[1400px] lg:pb-8">{children}</div>
        <BottomNav />
        </I18nProvider>
      </body>
    </html>
  );
}
