import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  weight: ["500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "PRINTR Powerball",
  description: "Hold to win. Drawn every 15 minutes.",
  icons: {
    icon: [{ url: "/logo.png", type: "image/png", sizes: "32x32" }],
    shortcut: ["/logo.png"],
    apple: [{ url: "/logo.png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${space.variable} ${jetbrains.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
