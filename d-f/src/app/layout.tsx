import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/manrope";
import "@fontsource-variable/inter";
import "./globals.css";
import { Header, MobileNav, Sidebar } from "@/components/shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Civic Network", template: "%s · Civic Network" },
  description: "Report local problems, support existing cases, and follow progress in your neighbourhood.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F5F8F6",
};

const themeInit = `try{var t=localStorage.getItem('cn-theme')||'light';document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <div className="app">
          <Sidebar />
          <div className="main-col">
            <Header />
            <main id="main" className="workspace">
              {children}
            </main>
          </div>
        </div>
        <MobileNav />
      </body>
    </html>
  );
}
