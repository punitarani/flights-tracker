import * as Sentry from "@sentry/nextjs";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { TRPCProvider } from "@/lib/trpc/provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://graypane.com"),
  title: {
    default: "GrayPane – Flight Search & Alerts",
    template: "%s | GrayPane by Graypane",
  },
  description:
    "Track flight prices, monitor fare trends, and manage alerts seamlessly on graypane.com.",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/icon",
    shortcut: "/icon",
    apple: "/apple-icon",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://graypane.com",
    siteName: "Graypane",
    title: "Flight Search & Alerts",
    description:
      "Monitor flight prices, explore fare history, and stay ahead with personalized alerts.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "GrayPane flight pricing dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Flight Search & Alerts",
    description:
      "Track fare trends and manage flight alerts with the GrayPane dashboard on graypane.com.",
    images: [
      {
        url: "/twitter-image",
        width: 1200,
        height: 630,
        alt: "GrayPane flight pricing dashboard",
      },
    ],
  },
  other: {
    ...Sentry.getTraceData(),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preconnect"
          href="https://cdn.apple-mapkit.com"
          crossOrigin=""
        />
        <link rel="dns-prefetch" href="https://cdn.apple-mapkit.com" />
        <link
          rel="preload"
          as="script"
          href="https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NuqsAdapter>
            <TRPCProvider>
              {children}
              <Analytics />
              <Toaster richColors closeButton />
            </TRPCProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  );
}
