import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { GoogleTagManager } from "@next/third-parties/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { socialImage } from "@/lib/social-metadata";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.APP_URL ??
      process.env.NEXTAUTH_URL ??
      "https://store.surpluss.co",
  ),
  title: { default: "Surpluss Catalogue", template: "%s · Surpluss" },
  description: "Curated surplus inventory for modern businesses.",
  openGraph: {
    title: "Surpluss Catalogue",
    description: "Curated surplus inventory for modern businesses.",
    siteName: "Surpluss",
    type: "website",
    images: [socialImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Surpluss Catalogue",
    description: "Curated surplus inventory for modern businesses.",
    images: [socialImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
    >
      {process.env.NEXT_PUBLIC_GTM_ID && (
        <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID} />
      )}
      <body>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
