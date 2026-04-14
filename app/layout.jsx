export const metadata = {
  title: 'Second Layer HQ',
  description: 'Operations hub for Second Layer',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
