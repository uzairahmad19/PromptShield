import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Assuming you use Inter or similar
import "./globals.css"; // Next.js default stylesheet, move your index.css contents here

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PromptShield UI",
  description: "Semantic guardrail pipeline interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}