import type { Metadata, Viewport } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "./globals.css";

// Quiet Luxury type system. Both families ship Cyrillic so Ukrainian renders
// in the editorial serif as well as the sans body. Exposed as CSS vars so the
// Tailwind theme (--font-sans / --font-serif) and base rules can pick them up.
const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const playfair = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-serif",
  weight: ["500", "600", "700"],
});

// Manifest is auto-linked by Next from app/manifest.ts. Apple web-app meta +
// icons enable an installable, standalone home-screen experience.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: "Emmanuil",
    description: t("description"),
    applicationName: "Emmanuil",
    appleWebApp: { capable: true, statusBarStyle: "default", title: "Emmanuil" },
    icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  };
}

// theme-color matches the app chrome per color scheme (Quiet Luxury: light
// --background warm bone #F4F0E9, dark warm near-black #16140F); viewport-fit
// cover lets the layout's safe-area insets reach the notch/home-indicator edges.
export const viewport: Viewport = {
  themeColor: [
    { color: "#F4F0E9", media: "(prefers-color-scheme: light)" },
    { color: "#16140F", media: "(prefers-color-scheme: dark)" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Root layout: <html>/<body> + i18n provider only. The bottom-nav shell and the
// auth gate live in the (app) route group's layout so public routes like /login
// and /auth/* render without the nav.
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${manrope.variable} ${playfair.variable}`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
