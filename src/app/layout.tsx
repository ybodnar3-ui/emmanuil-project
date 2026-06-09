import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { BottomNav } from "@/components/bottom-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Emmanuil",
  description: "Your relationship portfolio + AI assistant",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <NextIntlClientProvider messages={messages}>
          <main className="mx-auto max-w-md px-4 pb-24 pt-6">{children}</main>
          <BottomNav />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
