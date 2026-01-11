import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/landing/Header";

// Configure Inter font for professional typography
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "hearth - Accessibility Analysis",
  description: "Visualize accessibility renovations for your future home.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} antialiased bg-[#F0F7FF] text-slate-800`}
        style={{
          fontFamily: "var(--font-inter), Inter, sans-serif",
        }}
      >
        <Header />
        {children}
      </body>
    </html>
  );
}