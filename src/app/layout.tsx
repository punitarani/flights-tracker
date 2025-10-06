import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
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
    default: "Fli – Flight Tracker & Alerts",
    template: "%s | Fli by Graypane",
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
    siteName: "Fli by Graypane",
    title: "Fli – Flight Tracker & Alerts",
    description:
      "Monitor flight prices, explore fare history, and stay ahead with personalized alerts.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Fli flight pricing dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@graypane",
    title: "Fli – Flight Tracker & Alerts",
    description:
      "Track fare trends and manage flight alerts with the Fli dashboard on graypane.com.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Fli flight pricing dashboard",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NuqsAdapter>
          <TRPCProvider>
            {children}
            <Analytics />
          </TRPCProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
