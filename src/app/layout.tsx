import type { Metadata } from "next";
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import Script from "next/script";

import "./globals.css";

const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument-sans" });
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "zoxa console",
  description: "Configure and talk to zoxa voice agents over the public WebSocket API.",
  robots: { index: false, follow: false },
};

// Applied before paint so the theme never flashes. Dark unless the user chose light.
const THEME_SCRIPT = `try{if(localStorage.getItem("zoxa-console:theme")!=="light")document.documentElement.classList.add("dark")}catch(e){document.documentElement.classList.add("dark")}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <Script id="theme" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}
