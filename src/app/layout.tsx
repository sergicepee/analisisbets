import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { BRAND, hasApiKey } from "@/lib/config";

export const metadata: Metadata = {
  title: `${BRAND.name} · Análisis de fútbol`,
  description: "Estimaciones y estadísticas de fútbol para analizar partidos. No son garantías.",
};
export const viewport: Viewport = { themeColor: "#080b0d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {!hasApiKey && (
          <div className="bg-warn/15 px-3 py-1.5 text-center text-[11px] font-medium text-warn">
            MODO DEMO · datos de ejemplo. Añade API_FOOTBALL_KEY para datos reales.
          </div>
        )}
        <div className="mx-auto min-h-screen max-w-3xl pb-24 lg:max-w-[1400px] lg:pb-8">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
