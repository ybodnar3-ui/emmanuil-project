import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "./globals.css";

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

// theme-color matches the white app chrome (--background = #ffffff); viewport-fit
// cover lets the layout's safe-area insets reach the notch/home-indicator edges.
export const viewport: Viewport = {
  themeColor: "#ffffff",
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
    <html lang={locale}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
