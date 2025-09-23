import Providers from './providers';
import localFont from 'next/font/local';
import './globals.css';

const sojournsFont = localFont({
  src: '../public/fonts/sojourns.otf',
  display: 'swap',
  variable: '--font-sojourns',
});

export const metadata = {
  title: 'Sojourns',
  description: 'Minimal Next.js scaffold',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={sojournsFont.variable}
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          margin: 0,
          padding: 0,
          backgroundColor: '#111111',
          backgroundImage: [
            'linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6))',
            'linear-gradient(to top right, #1d1d2f, #2e2c3a, #4a4e8c)',
          ].join(', '),
          backgroundAttachment: 'fixed',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          color: 'white',
          minHeight: '100vh',
          overflow: 'auto',
        }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
