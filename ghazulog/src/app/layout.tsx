import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://ghazulog.com"),
  title: {
    default: "GhazuLog — Free Trading Journal & Analytics",
    template: "%s | GhazuLog",
  },
  description: "GhazuLog is a free trading journal for serious traders. Log trades, analyze performance, backtest strategies, track prop firm accounts, and get AI insights. Import from MT4, MT5, Binance, Bybit & more.",
  keywords: ["trading journal", "trade journal", "trading analytics", "backtesting", "prop firm tracker", "forex journal", "crypto trading journal", "TradeZella alternative", "free trading journal"],
  authors: [{ name: "GhazuLog" }],
  creator: "GhazuLog",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/logo-icon.png", type: "image/png" },
    ],
    apple: "/logo-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://ghazulog.com",
    siteName: "GhazuLog",
    title: "GhazuLog — Free Trading Journal & Analytics",
    description: "Log trades, analyze performance, backtest strategies, and track prop firm accounts. Free forever. Import from MT4, MT5, Binance, Bybit & more.",
    images: [{ url: "/logo-h.png", width: 1200, height: 630, alt: "GhazuLog" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "GhazuLog — Free Trading Journal & Analytics",
    description: "Log trades, analyze performance, backtest strategies. Free forever.",
    images: ["/logo-h.png"],
  },
  verification: {
    google: "XoHdPYen7bJVel9Egr0Z0hspeF66dj-AmdIhSrC-TRY",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"SoftwareApplication","name":"GhazuLog","applicationCategory":"FinanceApplication","description":"Free trading journal and analytics platform. Log trades, backtest strategies, track prop firm accounts, get AI insights.","url":"https://ghazulog.com","operatingSystem":"Web","offers":[{"@type":"Offer","name":"Free","price":"0","priceCurrency":"USD"},{"@type":"Offer","name":"Pro","price":"9.99","priceCurrency":"USD"},{"@type":"Offer","name":"Elite","price":"24","priceCurrency":"USD"}]}) }} />{children}</body>
    </html>
  );
}
