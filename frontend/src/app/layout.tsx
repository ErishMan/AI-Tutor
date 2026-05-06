import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title:       "TutorAI — Socratic Programming Tutor",
  description: "A dynamic, personalised AI programming tutor powered by a local LLM.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Satoshi — body font */}
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,600,700&display=swap"
          rel="stylesheet"
        />
        {/* JetBrains Mono — code font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* Theme initialiser — prevents flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=document.documentElement;var d=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';t.setAttribute('data-theme',d);}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}