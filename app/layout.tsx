import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "reflex.dev";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return {
    metadataBase: new URL(`${protocol}://${host}`),
    title: "Reflex — Correct once. Never again.",
    description:
      "The verified memory layer for coding agents. Turn one correction into a permanent rule, regression eval, and Codex Skill.",
    applicationName: "Reflex",
    keywords: ["OpenAI", "coding agents", "AGENTS.md", "evals", "developer tools"],
    openGraph: {
      title: "Reflex — Correct once. Never again.",
      description: "One correction becomes a verified rule every coding agent inherits.",
      type: "website",
      images: [{ url: "/og.png", width: 1680, height: 945, alt: "Reflex verified memory loop" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Reflex — Correct once. Never again.",
      description: "The verified memory layer for coding agents.",
      images: ["/og.png"],
    },
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
