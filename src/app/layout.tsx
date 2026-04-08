import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Swarm Garden Simulator",
  description: "A Vercel and Firebase ready browser version of the Swarm Garden simulator.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
