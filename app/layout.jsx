import "./globals.css";
import ThemeToggle from "./components/ThemeToggle";

export const metadata = {
  title: "Second Layer HQ",
  description: "Operations hub for Second Layer",
};

// Next.js 14: viewport must be exported separately. Without `width=device-width`,
// mobile browsers render at 980px wide and shrink the whole page.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

// No-flash theme init. Runs before first paint, so the correct theme is on
// <html> before any CSS-variable-driven surface renders. Dark is the default
// (brand principle 01); light is opt-in and remembered per operator.
const THEME_INIT = `
(function(){try{
  var t = localStorage.getItem('sl-theme');
  document.documentElement.setAttribute('data-theme', (t === 'light' || t === 'dark') ? t : 'dark');
}catch(e){ document.documentElement.setAttribute('data-theme','dark'); }})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="pt" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Brand duet + mono for data. The Hub previously shipped no brand
            fonts at all (body was Helvetica Neue). */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
