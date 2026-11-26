import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Yasmin Taxi | Arbetsschema',
  description: 'Arbetsschema för Yasmin Taxi.',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Yasmin Taxi' },
};

export const viewport: Viewport = {
  themeColor: '#f5f7f4',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="sv"><body>{children}</body></html>;
}
