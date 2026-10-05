import type { Metadata } from "next";
// Self-hosted (EU: no Google Fonts CDN; servers often run offline).
import "@fontsource-variable/manrope";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "LabelPilot Server",
  description:
    "Дизайнер этикеток, номенклатура, упаковки, штрихкоды и пользователи — локально.",
  icons: {
    icon: "/icons/logo.svg",
  },
};

// Applies the saved theme before the first paint so a dark-theme user never sees a
// light flash. Light is the default (lib/theme.ts owns the key).
const THEME_BOOT = `try{if(localStorage.getItem("lp_theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
