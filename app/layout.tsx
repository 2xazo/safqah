import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "صفقة | منصة المشتريات الذكية",
  description:
    "منصة مشتريات تنافسية مدعومة بالذكاء الاصطناعي — عروض مباشرة، موردون يتنافسون، وقرارات أسرع.",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

/**
 * Load Arabic UI fonts via CDN instead of next/font/google self-hosting.
 * vinext on Windows rewrites font CSS to absolute `C:/...` paths that browsers
 * block as file:// resources; CDN URLs avoid that bug.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Tajawal:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="safqah-theme">{children}</body>
    </html>
  );
}
