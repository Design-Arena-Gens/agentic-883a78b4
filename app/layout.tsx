export const metadata = {
  title: "SVG Garmin Watchface",
  description: "Interactive Garmin-style SVG watchface with useful complications",
};

import "./globals.css";
import React from "react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <main className="panel">
            <div className="header">
              <h1>Garmin-Style SVG Watchface</h1>
              <span className="small">Interactive demo suitable for web/Vercel</span>
            </div>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
