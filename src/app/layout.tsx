import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import { MotionConfig } from "framer-motion";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { VersionGuard } from "@/components/shared/version-guard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: "SCHOLARIO-OS — Enterprise School ERP",
    template: "%s · SCHOLARIO-OS",
  },
  description:
    "The operating system for modern schools. Admissions, academics, finance, transport & analytics in one premium platform.",
  keywords: [
    "SCHOLARIO-OS",
    "School ERP",
    "Education Management",
    "School Administration",
    "School Management System",
  ],
  authors: [{ name: "SCHOLARIO" }],
  applicationName: "SCHOLARIO-OS",
  category: "education",
  alternates: {
    canonical: "/",
    // RSS autodiscovery — readers find the public notice board feed from
    // the homepage <head> (type attr on the link element).
    types: {
      "application/rss+xml": "/api/public/notices/rss",
    },
  },
  openGraph: {
    type: "website",
    siteName: "SCHOLARIO-OS",
    title: "SCHOLARIO-OS — Enterprise School ERP",
    description:
      "The operating system for modern schools. Admissions, academics, finance, transport & analytics in one premium platform.",
    url: "/",
    images: [
      {
        url: "/og-image.jpg",
        width: 1344,
        height: 768,
        alt: "SCHOLARIO-OS — the operating system for modern schools",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SCHOLARIO-OS — Enterprise School ERP",
    description:
      "The operating system for modern schools. Admissions, academics, finance, transport & analytics in one platform.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  icons: {
    icon: "/logo.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9fdfa" },
    { media: "(prefers-color-scheme: dark)", color: "#06140f" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          {/* Global a11y (SR-UI §21/§27): every framer-motion animation
              respects the OS "prefers-reduced-motion" setting. */}
          <MotionConfig reducedMotion="user">
            {children}
            {/* VersionGuard: self-heals any tab running a stale bundle
                (polls /api/app-version and hard-reloads on mismatch). */}
            <VersionGuard />
            <SonnerToaster position="bottom-right" closeButton />
          </MotionConfig>
        </ThemeProvider>
      </body>
    </html>
  );
}
