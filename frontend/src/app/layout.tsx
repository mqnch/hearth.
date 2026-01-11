import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import Header from "@/components/landing/Header";

// Configure Space Grotesk for headers and body text (Geist Sans alternative)
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Use Space Grotesk as mono as well (Geist Mono alternative)
// Can be updated later if a better mono font is needed
const spaceGroteskMono = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "hearth. - Accessibility Analysis",
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
        className={`${spaceGrotesk.variable} ${spaceGroteskMono.variable} antialiased bg-[#FFF8E7] text-slate-800`}
        style={{
          fontFamily: "var(--font-sans), sans-serif",
        }}
      >
        <Header />
        {children}
      </body>
    </html>
  );
}