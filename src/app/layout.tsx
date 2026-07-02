import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import { Providers } from "@/components/system/Providers";
import { themeBootstrapScript } from "@/lib/theme/ThemeContext";
import { customizeBootstrapScript } from "@/lib/customize/CustomizeContext";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "UW Fuel",
  title: { default: "UW Fuel", template: "%s · UW Fuel" },
  description: "Meal & macro planning for UW students. Your data, your AI key.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "UW Fuel" },
  icons: { icon: "/icons/Icon-256.png", apple: "/icons/Icon-180.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#7c6cf0" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0c18" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable} ${sora.variable} h-full antialiased`}>
      <body className="min-h-full bg-bg font-sans text-ink">
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <script dangerouslySetInnerHTML={{ __html: customizeBootstrapScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
