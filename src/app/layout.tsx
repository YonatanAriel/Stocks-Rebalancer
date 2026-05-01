import type { Metadata } from "next";
import { Inter, Outfit, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rebalancer - Smart Portfolio Allocation",
  description:
    "Calculate exactly how to invest new cash to maintain your target portfolio allocation. Built especially for long-term investors on the TASE.",
  icons: {
    icon: "/favicon.svg",
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.variable} ${mono.variable} flex flex-col antialiased bg-background`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
            <div className="absolute inset-0 bg-background" />
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -20%, color-mix(in oklch, var(--primary), transparent 85%), transparent 70%)', filter: 'blur(100px)', opacity: 0.6 }} />
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 100% 100%, color-mix(in oklch, var(--primary), transparent 90%), transparent 60%)', filter: 'blur(80px)', opacity: 0.4 }} />
          </div>
          <div className="relative z-0 flex flex-col min-h-screen">
            {children}
          </div>
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
