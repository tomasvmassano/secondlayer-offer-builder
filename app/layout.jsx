export const metadata = {
  title: 'Second Layer HQ',
  description: 'Operations hub for Second Layer',
};

// Next.js 14: viewport must be exported separately. Without
// `width=device-width`, mobile browsers render at 980px wide and shrink the
// whole page — the root cause of why everything looked microscopic on phones.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0a0a',
};

// Global mobile CSS. Server-rendered (not in useEffect) so it applies on
// first paint. Strategy: most pages set inline grid templates like
// `repeat(N, 1fr)` or `1.4fr 1fr` — inline styles beat class specificity
// UNLESS we use `!important`. So pages add `.sl-grid` / `-2` / `-3` / `-4`
// class hooks and below we force-stack them at < 768px.
//
// Also bumps input font to 16px to stop iOS from auto-zooming on focus
// (the #1 cause of "broken on iPhone"), and grows button min-height to
// hit Apple's 44px touch-target floor.
const MOBILE_CSS = `
  /* iOS auto-zoom prevention */
  @media (max-width: 768px) {
    input, textarea, select {
      font-size: 16px !important;
    }
    button:not([data-sl-compact]) {
      min-height: 38px;
    }
    body {
      -webkit-text-size-adjust: 100%;
    }
    /* Force-stack grid layouts. Pages tag their grid container with one
       of these classes; this overrides the inline gridTemplateColumns. */
    .sl-grid,
    .sl-grid-2,
    .sl-grid-3,
    .sl-grid-4 {
      grid-template-columns: 1fr !important;
    }
    /* Cards/panels frequently have padding 26-40px; squeeze on mobile. */
    .sl-card,
    .sl-pad {
      padding: 18px !important;
    }
    /* Hero number sizes feel too big on small screens. */
    .sl-hero-value {
      font-size: 32px !important;
    }
    .sl-h1 { font-size: 26px !important; }
    .sl-h2 { font-size: 20px !important; }
    /* Horizontal-scroll fallback for stubborn tables and rows. */
    .sl-hscroll {
      overflow-x: auto !important;
      -webkit-overflow-scrolling: touch;
    }
    .sl-hide-mobile { display: none !important; }
    .sl-show-mobile { display: block !important; }
    /* Top-level page wrapper — most pages set padding 40px. */
    .sl-page {
      padding: 16px !important;
    }
    /* Tab/segmented controls — let them wrap rather than overflow. */
    .sl-tabs {
      flex-wrap: wrap !important;
    }
  }

  /* Always-on rules (not mobile-gated) */
  .sl-show-mobile { display: none; }
  html, body {
    max-width: 100%;
    overflow-x: hidden;
  }
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: MOBILE_CSS }} />
      </head>
      <body style={{ margin: 0, fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
