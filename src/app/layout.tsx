import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rebalancer — Smart Portfolio Allocation",
  description:
    "Calculate exactly how to invest new cash to maintain your target portfolio allocation. Built for long-term investors on the TASE.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} dark antialiased`}>
      <body className="min-h-screen flex flex-col bg-background gradient-mesh">
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
