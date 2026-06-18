import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "SandboxAI - Self-Correcting AI Compiler",
  description: "AI that writes, runs, and fixes code automatically",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body style={{ fontFamily: "var(--font-inter), 'Inter', system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}